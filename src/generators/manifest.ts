/**
 * Problem Manifest Generator
 *
 * Creates and updates the manifest.json file for each problem folder.
 */

import type { LeetCodeSubmission, ProblemManifest, ManifestSubmission } from '@/types';

/**
 * Create a fresh manifest from a first submission.
 */
export function createManifest(submission: LeetCodeSubmission): ProblemManifest {
  return {
    slug: submission.titleSlug,
    title: submission.title,
    number: submission.questionNumber,
    difficulty: submission.difficulty,
    tags: submission.tags,
    url: submission.url.split('/description')[0].split('/submissions')[0],
    submissions: [],
  };
}

/**
 * Add a new submission entry to an existing manifest.
 * Returns a new manifest object (immutable update).
 */
export function updateManifest(
  manifest: ProblemManifest,
  newEntry: ManifestSubmission
): ProblemManifest {
  return {
    ...manifest,
    submissions: [...manifest.submissions, newEntry],
  };
}

/**
 * Get the next version number for a language in this manifest.
 */
export function getNextVersion(manifest: ProblemManifest, language: string): number {
  const existing = manifest.submissions.filter((s) => s.language === language);
  return existing.length + 1;
}

/**
 * Get all unique languages used in this manifest.
 */
export function getLanguages(manifest: ProblemManifest): string[] {
  return [...new Set(manifest.submissions.map((s) => s.language))];
}

/**
 * Get the latest submission for each language.
 */
export function getLatestSubmissions(manifest: ProblemManifest): ManifestSubmission[] {
  const latest = new Map<string, ManifestSubmission>();
  for (const submission of manifest.submissions) {
    const existing = latest.get(submission.language);
    if (!existing || submission.version > existing.version) {
      latest.set(submission.language, submission);
    }
  }
  return Array.from(latest.values());
}
