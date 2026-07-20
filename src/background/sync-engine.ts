/**
 * LeetSync Core Sync Engine
 *
 * Takes a detected submission, computes the version, and pushes
 * the versioned file + manifest + README to GitHub.
 */

import type { LeetCodeSubmission, ProblemManifest, ManifestSubmission } from '@/types';
import { getSettings } from '@/utils/storage';
import { addRecentSync, addSubmissionHash, hasSubmissionHash } from '@/utils/storage';
import { submissionHash } from '@/utils/filename';
import {
  generateVersionedFilename,
  buildSubmissionPath,
  buildManifestPath,
  buildReadmePath,
  getLanguageName,
} from '@/utils/filename';
import { githubApi } from './github-api';
import { generateProblemReadme } from '@/generators/readme';
import { createManifest, updateManifest } from '@/generators/manifest';
import { addToQueue } from './queue';

/**
 * Process a detected submission — the main sync pipeline.
 *
 * Steps:
 * 1. Validate & deduplicate
 * 2. Get or create manifest for this problem
 * 3. Compute version number
 * 4. Push solution file
 * 5. Update manifest.json
 * 6. Update per-problem README.md
 * 7. Record in recent syncs
 */
export async function syncSubmission(
  submission: LeetCodeSubmission
): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();

  // ─── Guard: Auth check ─────────────────────────────────────
  if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
    console.warn('[LeetSync Sync] Not authenticated or no repo selected, queueing');
    await addToQueue(submission);
    return { success: false, error: 'Not authenticated or no repo configured' };
  }

  // ─── Guard: Sync mode check ────────────────────────────────
  if (settings.syncMode === 'accepted_only' && submission.status !== 'Accepted') {
    console.log(`[LeetSync Sync] Skipping non-accepted submission (${submission.status})`);
    return { success: true }; // Not an error, just filtered out
  }

  // ─── Guard: Deduplication ──────────────────────────────────
  const hash = submissionHash(submission.submissionId);
  if (await hasSubmissionHash(hash)) {
    console.log('[LeetSync Sync] Duplicate submission, skipping:', submission.submissionId);
    return { success: true };
  }

  const token = settings.githubToken;
  const owner = settings.repoOwner;
  const repo = settings.repoName;

  try {
    // ─── Step 1: Fetch or create manifest ──────────────────────
    const manifestPath = buildManifestPath(submission.questionNumber, submission.titleSlug);
    let manifest: ProblemManifest;
    let manifestSha: string | undefined;

    const existingManifest = await githubApi.getFileContent(token, owner, repo, manifestPath);

    if (existingManifest?.content) {
      // Parse existing manifest
      const decoded = githubApi.decodeFileContent(existingManifest.content);
      manifest = JSON.parse(decoded) as ProblemManifest;
      manifestSha = existingManifest.sha;
    } else {
      // Create new manifest
      manifest = createManifest(submission);
    }

    // ─── Step 2: Compute version number ────────────────────────
    const existingInSameLang = manifest.submissions.filter(
      (s) => s.language === submission.language
    );
    const versionNumber = existingInSameLang.length + 1;

    // ─── Step 3: Generate versioned filename and push code ─────
    const filename = generateVersionedFilename(
      versionNumber,
      submission.timestamp,
      submission.status,
      submission.language
    );
    const filePath = buildSubmissionPath(
      submission.questionNumber,
      submission.titleSlug,
      submission.language,
      filename
    );

    const commitMessage = `${submission.title}: v${versionNumber} ${submission.status.toLowerCase()} (${getLanguageName(submission.language)}, ${submission.runtime})`;

    const fileResult = await githubApi.createOrUpdateFile(
      token,
      owner,
      repo,
      filePath,
      submission.code,
      commitMessage
    );

    // ─── Step 4: Update manifest ───────────────────────────────
    const newEntry: ManifestSubmission = {
      version: versionNumber,
      language: submission.language,
      timestamp: submission.timestamp,
      status: submission.status,
      runtime: submission.runtime,
      runtimePercentile: submission.runtimePercentile,
      memory: submission.memory,
      memoryPercentile: submission.memoryPercentile,
      commitSha: fileResult.commit.sha,
      filePath,
    };

    const updatedManifest = updateManifest(manifest, newEntry);
    const manifestContent = JSON.stringify(updatedManifest, null, 2);

    await githubApi.createOrUpdateFile(
      token,
      owner,
      repo,
      manifestPath,
      manifestContent,
      `Update manifest: ${submission.title} v${versionNumber}`,
      manifestSha
    );

    // ─── Step 5: Update per-problem README ─────────────────────
    const readmePath = buildReadmePath(submission.questionNumber, submission.titleSlug);
    const existingReadme = await githubApi.getFileContent(token, owner, repo, readmePath);
    const readmeContent = generateProblemReadme(updatedManifest);

    await githubApi.createOrUpdateFile(
      token,
      owner,
      repo,
      readmePath,
      readmeContent,
      `Update README: ${submission.title}`,
      existingReadme?.sha
    );

    // ─── Step 6: Record success ────────────────────────────────
    await addSubmissionHash(hash);
    await addRecentSync({
      problemTitle: submission.title,
      problemSlug: submission.titleSlug,
      language: submission.language,
      version: versionNumber,
      status: submission.status,
      runtime: submission.runtime,
      timestamp: submission.timestamp,
      success: true,
    });

    console.log(`[LeetSync Sync] ✅ Synced: ${submission.title} v${versionNumber} (${getLanguageName(submission.language)})`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('[LeetSync Sync] ❌ Sync failed:', errorMessage);

    // Queue for retry
    await addToQueue(submission);

    // Record failure
    await addRecentSync({
      problemTitle: submission.title,
      problemSlug: submission.titleSlug,
      language: submission.language,
      version: 0,
      status: submission.status,
      runtime: submission.runtime,
      timestamp: submission.timestamp,
      success: false,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}
