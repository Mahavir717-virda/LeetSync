/**
 * Versioned filename generation and utility functions.
 */

import { LANGUAGE_EXTENSIONS, LANGUAGE_NAMES } from './constants';

/**
 * Generate a versioned filename for a submission.
 *
 * Format: v{version}_{timestamp}_{status}.{ext}
 * Example: v2_2026-07-18T14-32-00_accepted.py
 */
export function generateVersionedFilename(
  version: number,
  timestamp: string,
  status: string,
  language: string
): string {
  const safeDatetime = formatTimestampForFilename(timestamp);
  const safeStatus = status?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  const ext = getLanguageExtension(language);
  return `v${version}_${safeDatetime}_${safeStatus}${ext}`;
}

/**
 * Convert an ISO timestamp to a filesystem-safe string.
 * "2026-07-18T14:32:00Z" → "2026-07-18T14-32-00"
 */
export function formatTimestampForFilename(isoTimestamp: string): string {
  return isoTimestamp
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace(/Z$/, '');
}

/**
 * Get the file extension for a LeetCode language slug.
 */
export function getLanguageExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language?.toLowerCase()] ?? '.txt';
}

/**
 * Get the display name for a LeetCode language slug.
 */
export function getLanguageName(language: string): string {
  return LANGUAGE_NAMES[language?.toLowerCase()] ?? language;
}

/**
 * Sanitize a problem title into a kebab-case slug.
 * "Two Sum" → "two-sum"
 * "3Sum Closest" → "3sum-closest"
 */
export function sanitizeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build the problem folder name with zero-padded number.
 * (1, "two-sum") → "0001-two-sum"
 */
export function buildProblemFolder(questionNumber: number, slug: string): string {
  const paddedNumber = String(questionNumber).padStart(4, '0');
  return `${paddedNumber}-${slug}`;
}

/**
 * Build the full path for a submission file in the repo.
 */
export function buildSubmissionPath(
  questionNumber: number,
  slug: string,
  language: string,
  filename: string
): string {
  const folder = buildProblemFolder(questionNumber, slug);
  const langFolder = getLanguageName(language)?.toLowerCase().replace(/[^a-z0-9+#]/g, '').replace(/\+/g, 'plus').replace(/#/g, 'sharp') || 'unknown';
  return `problems/${folder}/${langFolder}/${filename}`;
}

/**
 * Build the manifest.json path for a problem.
 */
export function buildManifestPath(questionNumber: number, slug: string): string {
  const folder = buildProblemFolder(questionNumber, slug);
  return `problems/${folder}/manifest.json`;
}

/**
 * Build the README.md path for a problem.
 */
export function buildReadmePath(questionNumber: number, slug: string): string {
  const folder = buildProblemFolder(questionNumber, slug);
  return `problems/${folder}/README.md`;
}

/**
 * Generate a unique hash for a submission ID to deduplicate.
 */
export function submissionHash(submissionId: string): string {
  // Simple hash — submission IDs are unique from LeetCode's side
  return `lc_${submissionId}`;
}

/**
 * Format a date for display in README tables.
 * "2026-07-18T14:32:00Z" → "2026-07-18"
 */
export function formatDateForDisplay(isoTimestamp: string): string {
  return isoTimestamp.split('T')[0];
}

/**
 * Get a difficulty badge emoji.
 */
export function difficultyBadge(difficulty?: string): string {
  if (!difficulty) return '⚪';
  switch (difficulty.toLowerCase()) {
    case 'easy': return '🟢';
    case 'medium': return '🟡';
    case 'hard': return '🔴';
    default: return '⚪';
  }
}
