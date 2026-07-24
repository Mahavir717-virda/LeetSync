/**
 * LeetSync Core Sync Engine
 *
 * Takes a detected submission, performs collision detection, and pushes
 * the named solution file + manifest + README to GitHub.
 *
 * Now uses the Solution model (schemaVersion=2) with language-scoped subfolders
 * and intelligent collision detection with a 60-second conflict resolution window.
 */

import type { LeetCodeSubmission, ProblemManifest, ConflictResolution } from '@/types';
import { getSettings } from '@/utils/storage';
import { addRecentSync, addSubmissionHash, hasSubmissionHash } from '@/utils/storage';
import { submissionHash, buildLanguageScopedPath, buildManifestPath, buildReadmePath, getLanguageName, DEFAULT_SOLUTION_LABEL } from '@/utils/filename';
import { getProblemDirectory } from '@/utils/folder-strategy';
import { githubApi } from './github-api';
import { generateProblemReadme } from '@/generators/readme';
import {
  createManifest,
  updateManifest,
  buildSolution,
  buildReplacedSolution,
  getDefaultSolution,
  isLegacyManifest,
  migrateLegacyManifest,
  normalizeManifest,
} from '@/generators/manifest';
import { resolveUniqueLabel } from './label-resolver';
import { addToQueue, acquireLock, releaseLock } from './queue';
import { fetchLeetCodeMetadata } from './migration/metadata-fetcher';
import { topicIndex } from '@/utils/topic-index';
import type { TopicTag } from '@/types';
import { getProblemPreference, setProblemPreference } from '@/utils/preference-manager';

// ─── Conflict Resolution Helpers ──────────────────────────────────────────────

const CONFLICT_RESOLUTION_KEY = 'LEETSYNC_CONFLICT_RESOLUTION';
const CONFLICT_TIMEOUT_MS = 60_000;

const FOLDER_SELECTION_RESOLUTION_KEY = 'LEETSYNC_FOLDER_SELECTION_RESOLUTION';
const SELECTION_TIMEOUT_MS = 60_000;

/**
 * Send a FOLDER_SELECTION_REQUIRED message to the content script and wait up to 60 seconds
 * for the user to resolve the folder choice.
 */
async function requestFolderSelection(
  submission: LeetCodeSubmission
): Promise<string | null> {
  await new Promise<void>((resolve) =>
    chrome.storage.local.remove(FOLDER_SELECTION_RESOLUTION_KEY, resolve)
  );

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs.find(t => t.url?.includes('leetcode.com/problems/'));
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'FOLDER_SELECTION_REQUIRED',
        payload: { submission },
      });
    }
  } catch (_) {}

  const startTime = Date.now();
  while (Date.now() - startTime < SELECTION_TIMEOUT_MS) {
    await new Promise((res) => setTimeout(res, 500));
    const result = await new Promise<any>((resolve) =>
      chrome.storage.local.get(FOLDER_SELECTION_RESOLUTION_KEY, resolve)
    );
    const resolution = result[FOLDER_SELECTION_RESOLUTION_KEY];
    if (resolution && resolution.submissionId === submission.submissionId) {
      await new Promise<void>((resolve) =>
        chrome.storage.local.remove(FOLDER_SELECTION_RESOLUTION_KEY, resolve)
      );
      return resolution.selectedFolder;
    }
  }

  return null;
}

/**
 * Send a COLLISION_DETECTED message to the content script and wait up to 60 seconds
 * for the user to resolve the conflict.
 *
 * Falls back to 'replace' if the user doesn't respond.
 */
async function requestConflictResolution(
  submission: LeetCodeSubmission,
  existingLabel: string,
  existingLabels: string[]
): Promise<ConflictResolution> {
  // Clear any stale resolution from a previous sync
  await new Promise<void>((resolve) =>
    chrome.storage.local.remove(CONFLICT_RESOLUTION_KEY, resolve)
  );

  // Notify active tab's content script to show dialog overlay
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs.find(t => t.url?.includes('leetcode.com/problems/'));
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'COLLISION_DETECTED',
        payload: { submission, existingLabel, existingLabels },
      });
    }
  } catch (_) {}

  // Poll chrome.storage.local for up to 60 seconds for a resolution
  const startTime = Date.now();
  while (Date.now() - startTime < CONFLICT_TIMEOUT_MS) {
    await new Promise((res) => setTimeout(res, 500));
    const result = await new Promise<any>((resolve) =>
      chrome.storage.local.get(CONFLICT_RESOLUTION_KEY, resolve)
    );
    const resolution = result[CONFLICT_RESOLUTION_KEY] as ConflictResolution | undefined;
    if (resolution && resolution.submissionId === submission.submissionId) {
      await new Promise<void>((resolve) =>
        chrome.storage.local.remove(CONFLICT_RESOLUTION_KEY, resolve)
      );
      return resolution;
    }
  }

  // Timeout — default to replace (zero friction for users who don't see the dialog)
  console.log('[LeetSync Sync] Conflict resolution timed out — defaulting to Replace.');
  return { submissionId: submission.submissionId, action: 'replace' };
}

// ─── Main Sync Pipeline ────────────────────────────────────────────────────────

/**
 * Process a detected submission — the main sync pipeline.
 *
 * Steps:
 * 1. Validate & deduplicate
 * 2. Fetch or create manifest (upgrade legacy if needed)
 * 2b. Collision detection & conflict resolution
 * 3. Push solution file to GitHub
 * 4. Update manifest.json
 * 5. Update per-problem README.md
 * 6. Record success
 */
export async function syncSubmission(
  submission: LeetCodeSubmission
): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();

  // ─── Guard: Auth check ─────────────────────────────────────────
  if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
    console.warn('[BG] No GitHub token or repo selected.');
    await addToQueue(submission);
    return { success: false, error: 'Not authenticated or no repo configured' };
  }

  // ─── Guard: Sync mode check ────────────────────────────────────
  if (settings.syncMode === 'accepted_only' && submission.status !== 'Accepted') {
    console.log(`[BG] Skipping non-accepted submission (${submission.status})`);
    return { success: true };
  }

  // ─── Guard: Deduplication ──────────────────────────────────────
  const hash = submissionHash(submission.submissionId);
  if (await hasSubmissionHash(hash)) {
    console.log('[LeetSync Sync] Duplicate submission, skipping:', submission.submissionId);
    return { success: true };
  }

  // ─── Acquire sequential mutex ──────────────────────────────────
  const queueJobId = `sync_${submission.submissionId}`;
  const locked = await acquireLock(queueJobId);
  if (!locked) {
    console.log('[LeetSync Sync] Another sync is in progress — queuing:', submission.title);
    await addToQueue(submission);
    return { success: true };
  }

  const token = settings.githubToken;
  const owner = settings.repoOwner;
  const repo = settings.repoName;
  const folderStructure = settings.folderStructure || 'Topic/Difficulty';

  try {
    console.log(`[LeetSync Sync] 🚀 Starting sync for: "${submission.title}" (${submission.language})`);

    // Enrich missing topic tags or difficulty from LeetCode GraphQL before constructing baseDirectory
    if ((!submission.topicTags || submission.topicTags.length === 0 || !submission.difficulty) && submission.titleSlug) {
      try {
        const meta = await fetchLeetCodeMetadata(submission.titleSlug);
        if (meta) {
          if (Array.isArray(meta.topicTags) && meta.topicTags.length > 0) {
            submission.topicTags = meta.topicTags;
          }
          if (meta.difficulty) {
            submission.difficulty = meta.difficulty;
          }
          if (meta.questionNumber && (!submission.questionNumber || submission.questionNumber === 0)) {
            submission.questionNumber = meta.questionNumber;
          }
        }
      } catch (err) {
        console.warn('[LeetSync Sync] Could not fetch GraphQL metadata for tags:', err);
      }
    }

    // ─── Resolve Target Folder Preference ──────────────────────
    let chosenFolder = await getProblemPreference(submission.questionNumber);

    if (!chosenFolder && submission.topicTags && submission.topicTags.length > 1) {
      console.log(`[LeetSync Sync] Multi-topic problem without preference — requesting folder selection.`);
      const userSelected = await requestFolderSelection(submission);
      if (userSelected) {
        chosenFolder = userSelected;
        await setProblemPreference(submission.questionNumber, userSelected);
      }
    }

    const customMappings = chosenFolder 
      ? { ...(settings.topicMappings || {}), [submission.topicTags[0]?.slug ?? '']: chosenFolder }
      : settings.topicMappings;

    const baseDirectory = getProblemDirectory(submission, folderStructure, customMappings, submission.language);

    // ─── Step 1: Fetch or create manifest ──────────────────────
    const manifestPath = buildManifestPath(baseDirectory);
    let manifest: ProblemManifest;
    let manifestSha: string | undefined;

    console.log(`[LeetSync Sync] [Step 1/5] Fetching manifest: ${manifestPath}`);
    const existingManifestFile = await githubApi.getFileContent(token, owner, repo, manifestPath);

    if (existingManifestFile?.content) {
      const decoded = githubApi.decodeFileContent(existingManifestFile.content);
      const parsed = JSON.parse(decoded);
      manifestSha = existingManifestFile.sha;

      // Auto-upgrade legacy schemaVersion=1 manifests or normalise schemaVersion=2
      manifest = normalizeManifest(parsed);
    } else {
      console.log('[LeetSync Sync] [Step 1/5] No manifest found — creating new.');
      manifest = createManifest(submission);
    }

    // ─── Step 2b: Collision Detection ──────────────────────────
    const existingDefault = getDefaultSolution(manifest, submission.language);
    const existingGroup = manifest.solutionGroups.find(g => g.language === submission.language);
    const existingLabels = existingGroup?.solutions.map(s => s.label) ?? [];

    let resolvedLabel: string = DEFAULT_SOLUTION_LABEL;
    let conflictAction: 'first_save' | 'save_as_new' | 'replace' = 'first_save';
    let existingFileSha: string | undefined;
    let existingSolution = existingDefault;

    if (existingDefault) {
      // COLLISION — ask the popup for resolution
      console.log(`[LeetSync Sync] [Step 2b] Collision detected for "${submission.language}" — requesting resolution.`);
      const resolution = await requestConflictResolution(
        submission, existingDefault.label, existingLabels
      );

      if (resolution.action === 'replace') {
        conflictAction = 'replace';
        resolvedLabel = existingDefault.label;
        existingFileSha = (await githubApi.getFileContent(token, owner, repo, existingDefault.filePath))?.sha;
        console.log(`[LeetSync Sync] [Step 2b] Resolution: Replace "${resolvedLabel}"`);
      } else {
        // save_as_new — resolve unique label to avoid duplicates
        conflictAction = 'save_as_new';
        resolvedLabel = resolveUniqueLabel(
          resolution.label ?? 'Solution',
          existingGroup?.solutions ?? []
        );
        console.log(`[LeetSync Sync] [Step 2b] Resolution: Save As New "${resolvedLabel}"`);
      }
    }

    // ─── Step 3: Generate path and push code ───────────────────
    const filePath = buildLanguageScopedPath(baseDirectory, submission.language, resolvedLabel);
    const problemDisplay = `${submission.questionNumber}. ${submission.title}`;

    let commitMessage: string;
    if (conflictAction === 'replace') {
      commitMessage = `Update: ${problemDisplay} — ${resolvedLabel} (${getLanguageName(submission.language)})`;
    } else if (conflictAction === 'save_as_new') {
      commitMessage = `Add: ${problemDisplay} — ${resolvedLabel} (${getLanguageName(submission.language)})`;
    } else {
      commitMessage = `Add: ${problemDisplay} (${getLanguageName(submission.language)}, ${submission.difficulty})`;
    }

    console.log(`[LeetSync Sync] [Step 3/5] Pushing solution: ${filePath}`);
    const fileResult = await githubApi.createOrUpdateFile(
      token, owner, repo, filePath,
      submission.code, commitMessage, existingFileSha
    );
    const newCommitSha = fileResult.commit.sha;
    console.log(`[LeetSync Sync] [Step 3/5] Pushed! Commit: ${newCommitSha}`);

    // ─── Step 4: Update manifest ───────────────────────────────
    let newSolution;
    if (conflictAction === 'replace' && existingSolution) {
      newSolution = buildReplacedSolution(existingSolution, submission, newCommitSha);
    } else {
      const isDefault = conflictAction === 'first_save';
      newSolution = buildSolution(submission, resolvedLabel, filePath, isDefault, newCommitSha);
    }

    const updatedManifest = updateManifest(manifest, newSolution, conflictAction);

    console.log('[LeetSync Sync] [Step 4/5] Pushing updated manifest.json...');
    await githubApi.createOrUpdateFile(
      token, owner, repo, manifestPath,
      JSON.stringify(updatedManifest, null, 2),
      `Update manifest: ${problemDisplay}`,
      manifestSha
    );
    console.log('[LeetSync Sync] [Step 4/5] Manifest updated.');
    topicIndex.add(updatedManifest);

    // ─── Step 5: Update per-problem README ─────────────────────
    const readmePath = buildReadmePath(baseDirectory);
    const existingReadme = await githubApi.getFileContent(token, owner, repo, readmePath);
    const readmeContent = generateProblemReadme(updatedManifest);

    console.log('[LeetSync Sync] [Step 5/5] Pushing updated README.md...');
    await githubApi.createOrUpdateFile(
      token, owner, repo, readmePath, readmeContent,
      `Update README: ${problemDisplay}`, existingReadme?.sha
    );
    console.log('[LeetSync Sync] [Step 5/5] README updated.');

    // ─── Step 6: Record success ────────────────────────────────
    await addSubmissionHash(hash);
    await addRecentSync({
      problemTitle: submission.title,
      problemSlug: submission.titleSlug,
      language: submission.language,
      label: resolvedLabel,
      action: conflictAction === 'replace' ? 'replace' : conflictAction === 'save_as_new' ? 'save_as_new' : 'first_save',
      status: submission.status,
      runtime: submission.runtime,
      timestamp: submission.timestamp,
      success: true,
      commitSha: newCommitSha,
    });

    console.log(`[LeetSync Sync] ✅ Synced: ${problemDisplay} — "${resolvedLabel}" (${getLanguageName(submission.language)})`);

    // Notify active LeetCode tab to trigger in-page celebration overlay
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SYNC_COMPLETED',
            payload: {
              problemTitle: submission.title,
              problemSlug: submission.titleSlug,
              commitSha: newCommitSha,
              repoOwner: owner,
              repoName: repo,
              difficulty: submission.difficulty,
              language: submission.language,
            },
          }).catch(() => {});
        }
      });
    } catch (_) {}

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('[LeetSync Sync] ❌ Sync failed:', errorMessage);

    await addToQueue(submission);
    await addRecentSync({
      problemTitle: submission.title,
      problemSlug: submission.titleSlug,
      language: submission.language,
      label: DEFAULT_SOLUTION_LABEL,
      action: 'first_save',
      status: submission.status,
      runtime: submission.runtime,
      timestamp: submission.timestamp,
      success: false,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  } finally {
    await releaseLock();
  }
}
