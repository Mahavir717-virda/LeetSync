import type {
  LeetCodeSubmission,
  ProblemManifest,
  LanguageSolutionGroup,
  Solution,
  LegacyProblemManifest,
  TopicTag,
  FolderTopic,
} from '@/types';
import { buildLanguageScopedPath, DEFAULT_SOLUTION_LABEL } from '@/utils/filename';
import { getProblemDirectory } from '@/utils/folder-strategy';
import { primaryTopicResolver } from '@/utils/topic-resolver';

// ─── Schema Version ────────────────────────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 2;

// ─── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a fresh schemaVersion=2 manifest for a problem's first ever submission.
 * Called when no manifest.json exists in the GitHub repo yet.
 */
export function createManifest(submission: LeetCodeSubmission): ProblemManifest {
  const topicTags = submission.topicTags ?? [];
  const folderTopic = primaryTopicResolver.resolveFolder(topicTags);

  return {
    slug: submission.titleSlug,
    title: submission.title,
    number: submission.questionNumber,
    difficulty: submission.difficulty,
    tags: topicTags.map(t => t.name), // kept for backwards compatibility
    folderTopic,
    topicTags,
    problemMetadata: submission._rawMetadata ? {
      difficulty: submission.difficulty,
      topicTags,
      paidOnly: submission._rawMetadata.paidOnly,
      categoryTitle: submission._rawMetadata.categoryTitle,
      likes: submission._rawMetadata.likes,
      dislikes: submission._rawMetadata.dislikes,
      capturedAt: new Date().toISOString()
    } : undefined,
    url: submission.url.split('/description')[0].split('/submissions')[0],
    solutionGroups: [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    organizationStrategyVersion: 1,
  };
}

// ─── Update ────────────────────────────────────────────────────────────────────

/**
 * Add or update a Solution entry in the manifest.
 */
export function updateManifest(
  manifest: ProblemManifest,
  newSolution: Solution,
  action: 'first_save' | 'save_as_new' | 'replace'
): ProblemManifest {
  const existingGroupIdx = manifest.solutionGroups.findIndex(
    (g) => g.language === newSolution.language
  );

  if (action === 'replace' && existingGroupIdx !== -1) {
    // Update the existing solution entry in-place
    const updatedGroups = manifest.solutionGroups.map((g) => {
      if (g.language !== newSolution.language) return g;
      return {
        ...g,
        solutions: g.solutions.map((s) =>
          s.id === newSolution.id ? newSolution : s
        ),
      };
    });
    return { ...manifest, solutionGroups: updatedGroups };
  }

  // first_save or save_as_new — append new solution to the group
  if (existingGroupIdx === -1) {
    // No group for this language yet — create one
    const newGroup: LanguageSolutionGroup = {
      language: newSolution.language,
      solutions: [newSolution],
    };
    return { ...manifest, solutionGroups: [...manifest.solutionGroups, newGroup] };
  }

  // Group exists — append the new solution
  const updatedGroups = manifest.solutionGroups.map((g) => {
    if (g.language !== newSolution.language) return g;
    return { ...g, solutions: [...g.solutions, newSolution] };
  });
  return { ...manifest, solutionGroups: updatedGroups };
}

// ─── Solution Factory ──────────────────────────────────────────────────────────

/**
 * Build a new Solution object from a LeetCode submission.
 */
export function buildSolution(
  submission: LeetCodeSubmission,
  label: string,
  filePath: string,
  isDefault: boolean,
  commitSha: string
): Solution {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label,
    language: submission.language,
    filePath,
    createdAt: now,
    updatedAt: now,
    isDefault,
    runtime: submission.runtime,
    runtimePercentile: submission.runtimePercentile,
    memory: submission.memory,
    memoryPercentile: submission.memoryPercentile,
    commitSha,
    previousCommitSha: null,
    submissionId: submission.submissionId,
  };
}

/**
 * Build an updated Solution for a Replace action.
 */
export function buildReplacedSolution(
  existing: Solution,
  submission: LeetCodeSubmission,
  newCommitSha: string
): Solution {
  return {
    ...existing,
    runtime: submission.runtime,
    runtimePercentile: submission.runtimePercentile,
    memory: submission.memory,
    memoryPercentile: submission.memoryPercentile,
    commitSha: newCommitSha,
    previousCommitSha: existing.commitSha,
    updatedAt: new Date().toISOString(),
    submissionId: submission.submissionId,
  };
}

// ─── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Find the language group for a given language slug. Returns undefined if none.
 */
export function getLanguageGroup(
  manifest: ProblemManifest,
  language: string
): LanguageSolutionGroup | undefined {
  return manifest.solutionGroups.find((g) => g.language === language);
}

/**
 * Get the default (isDefault=true) solution for a language group.
 * Returns undefined if no group or no default exists.
 */
export function getDefaultSolution(
  manifest: ProblemManifest,
  language: string
): Solution | undefined {
  return getLanguageGroup(manifest, language)?.solutions.find((s) => s.isDefault);
}

/**
 * Get all unique languages present in this manifest.
 */
export function getLanguages(manifest: ProblemManifest): string[] {
  return manifest.solutionGroups.map((g) => g.language);
}

/**
 * Get the total solution count across all language groups.
 */
export function getTotalSolutionCount(manifest: ProblemManifest): number {
  return manifest.solutionGroups.reduce((sum, g) => sum + g.solutions.length, 0);
}

// ─── Legacy Migration ──────────────────────────────────────────────────────────

/**
 * Upgrade a schemaVersion=1 manifest (flat ManifestSubmission[]) to schemaVersion=2.
 */
export function migrateLegacyManifest(legacy: LegacyProblemManifest): ProblemManifest {
  const groupMap = new Map<string, Solution[]>();

  for (const sub of legacy.submissions) {
    if (!groupMap.has(sub.language)) {
      groupMap.set(sub.language, []);
    }
    const group = groupMap.get(sub.language)!;
    const isFirst = group.length === 0;
    const label = isFirst
      ? DEFAULT_SOLUTION_LABEL
      : (sub.label ?? `Solution v${group.length + 1}`);

    group.push({
      id: crypto.randomUUID(),
      label,
      language: sub.language,
      filePath: sub.filePath,
      createdAt: sub.timestamp,
      updatedAt: sub.timestamp,
      isDefault: isFirst,
      runtime: sub.runtime,
      runtimePercentile: sub.runtimePercentile,
      memory: sub.memory,
      memoryPercentile: sub.memoryPercentile,
      commitSha: sub.commitSha,
      previousCommitSha: null,
      submissionId: `legacy_${sub.version}_${sub.language}`,
    });
  }

  const solutionGroups: LanguageSolutionGroup[] = Array.from(groupMap.entries()).map(
    ([language, solutions]) => ({ language, solutions })
  );

  const topicTags: TopicTag[] = (legacy.tags ?? []).map(t => ({
    name: t,
    slug: t.toLowerCase().replace(/\s+/g, '-'),
  }));

  const folderTopic = primaryTopicResolver.resolveFolder(topicTags);

  return {
    slug: legacy.slug,
    title: legacy.title,
    number: legacy.number,
    difficulty: legacy.difficulty,
    tags: legacy.tags,
    folderTopic,
    topicTags,
    url: legacy.url,
    solutionGroups,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    organizationStrategyVersion: 1,
  };
}

/**
 * Normalise a raw manifest parsed from GitHub.
 * Handles schemaVersion=1 (tags[]) and schemaVersion=2 (topicTags) gracefully.
 */
export function normalizeManifest(raw: any): ProblemManifest {
  if (isLegacyManifest(raw)) {
    return migrateLegacyManifest(raw);
  }

  // Backfill topicTags from legacy tags[]
  const topicTags: TopicTag[] = Array.isArray(raw.topicTags) && raw.topicTags.length > 0
    ? raw.topicTags
    : (raw.tags ?? []).map((t: string) => ({
        name: t,
        slug: t.toLowerCase().replace(/\s+/g, '-'),
      }));

  // Backfill folderTopic
  const folderTopic: FolderTopic = raw.folderTopic ?? {
    strategy: 'PRIMARY_TOPIC',
    value: primaryTopicResolver.resolveFolder(topicTags).value,
  };

  return {
    ...raw,
    topicTags,
    folderTopic,
    organizationStrategyVersion: raw.organizationStrategyVersion ?? 1,
    schemaVersion: raw.schemaVersion ?? CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Detect whether a parsed JSON object is a legacy schemaVersion=1 manifest.
 */
export function isLegacyManifest(obj: any): obj is LegacyProblemManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray(obj.submissions) &&
    (!obj.schemaVersion || obj.schemaVersion < 2)
  );
}
