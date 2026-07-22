/**
 * LeetSync Filename & Path Utilities
 *
 * Provides all filename generation, path building, and language mapping
 * functions used across the sync engine and migration system.
 *
 * Key additions over the original:
 *  - Language-scoped subfolder isolation (cpp/, python/, java/, etc.)
 *  - Label-based filename generation (brute-force.cpp, optimal.py)
 *  - Categorized solution label taxonomy (Optimization / Algorithm / Strategy)
 *  - UTF-8 safe Base64 encoding for GitHub API payloads
 */

import { LANGUAGE_EXTENSIONS, LANGUAGE_NAMES } from './constants';

// ─── Solution Label Taxonomy ───────────────────────────────────────────────────

/**
 * Categorized solution labels shown as grouped chip sections in the conflict dialog.
 * Categories are rendered with their emoji header in the popup UI.
 */
export const SOLUTION_LABEL_GROUPS = {
  '⚡ Optimization': [
    'Brute Force', 'Better', 'Optimal',
  ],
  '🧠 Algorithm': [
    'DFS', 'BFS', 'DP', 'Greedy',
    'Binary Search', 'Trie', 'Segment Tree', 'Union Find',
  ],
  '🔁 Strategy': [
    'Recursive', 'Iterative', 'Memoization', 'Tabulation',
    'Two Pointer', 'Sliding Window',
  ],
} as const;

/** Flat array of all predefined labels for quick lookup and validation. */
export const ALL_SOLUTION_LABELS: string[] = Object.values(SOLUTION_LABEL_GROUPS).flat();

export type SolutionLabelGroup = keyof typeof SOLUTION_LABEL_GROUPS;
export type SolutionLabel = typeof ALL_SOLUTION_LABELS[number] | string;

/** The reserved label for the auto-saved first solution. Never offered as a chip. */
export const DEFAULT_SOLUTION_LABEL = 'Default' as const;

// ─── Language Folder Mapping ───────────────────────────────────────────────────

/**
 * Maps LeetCode language slugs to clean, lowercase subfolder names.
 * Used to create language-scoped directories under each problem folder.
 *
 * Example: "python3" → "python"  |  "cpp" → "cpp"  |  "csharp" → "csharp"
 */
const LANGUAGE_FOLDER_MAP: Record<string, string> = {
  // Python
  python3:    'python',
  python:     'python',
  // C-family
  cpp:        'cpp',
  c:          'c',
  csharp:     'csharp',
  // JVM
  java:       'java',
  kotlin:     'kotlin',
  scala:      'scala',
  // JS/TS
  javascript: 'javascript',
  typescript: 'typescript',
  // Systems
  rust:       'rust',
  go:         'go',
  swift:      'swift',
  // Scripting
  ruby:       'ruby',
  php:        'php',
  // Other
  dart:       'dart',
  racket:     'racket',
  erlang:     'erlang',
  elixir:     'elixir',
  bash:       'bash',
};

/**
 * Get the language subfolder name from a LeetCode language slug.
 * Falls back to the raw slug lowercased if not in the map.
 *
 * "python3" → "python"
 * "cpp"     → "cpp"
 * "java"    → "java"
 */
export function getLanguageFolder(language: string): string {
  return LANGUAGE_FOLDER_MAP[language?.toLowerCase()] ?? language?.toLowerCase() ?? 'unknown';
}

// ─── Filename Generation ───────────────────────────────────────────────────────

/**
 * Build a filename from a user-chosen solution label and language.
 *
 * "Default"      + "cpp"     → "solution.cpp"
 * "Brute Force"  + "cpp"     → "brute-force.cpp"
 * "Two Pointer"  + "python3" → "two-pointer.py"
 * "DP"           + "java"    → "dp.java"
 * "Optimal v2"   + "rust"    → "optimal-v2.rs"
 */
export function buildLabeledFilename(label: string, language: string): string {
  const ext = getLanguageExtension(language);
  if (label === DEFAULT_SOLUTION_LABEL) return `solution${ext}`;
  const slug = label
    .toLowerCase()
    .replace(/\s+/g, '-')       // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '') // strip non-alphanumeric except hyphens
    .replace(/-+/g, '-')        // collapse multiple hyphens
    .replace(/^-|-$/g, '');     // trim leading/trailing hyphens
  return `${slug}${ext}`;
}

/**
 * Build the full repo-relative path for a labeled solution file using
 * language-scoped subfolders.
 *
 * problemDir: "Array/Easy/0001-two-sum"
 * language:   "cpp"
 * label:      "Optimal"
 * → "Array/Easy/0001-two-sum/cpp/optimal.cpp"
 *
 * problemDir: "Array/Easy/0001-two-sum"
 * language:   "python3"
 * label:      "Default"
 * → "Array/Easy/0001-two-sum/python/solution.py"
 */
export function buildLanguageScopedPath(
  problemDir: string,
  language: string,
  label: string
): string {
  const langFolder = getLanguageFolder(language);
  const filename = buildLabeledFilename(label, language);
  return `${problemDir}/${langFolder}/${filename}`;
}

// ─── Legacy Path Builders (kept for backward compatibility) ───────────────────

/**
 * Generate a versioned filename for a submission (legacy flat structure).
 * Format: v{version}_{timestamp}_{status}.{ext}
 * Example: v2_2026-07-18T14-32-00_accepted.py
 * @deprecated Use buildLabeledFilename + buildLanguageScopedPath instead.
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
 * Build a flat solution filename: "0001-two-sum.py" or "0001-two-sum_v2.py".
 * @deprecated Use buildLabeledFilename + buildLanguageScopedPath instead.
 */
export function buildFlatSolutionFilename(
  questionNumber: number,
  slug: string,
  language: string,
  version: number
): string {
  const paddedNumber = String(questionNumber).padStart(4, '0');
  const ext = getLanguageExtension(language);
  const versionSuffix = version > 1 ? `_v${version}` : '';
  return `${paddedNumber}-${slug}${versionSuffix}${ext}`;
}

/**
 * Build the full path for a submission file in the repo (legacy layout).
 * @deprecated Use buildLanguageScopedPath instead.
 */
export function buildSubmissionPath(
  baseDirectory: string,
  language: string,
  filename: string,
  flat: boolean = false
): string {
  if (flat) {
    return `${baseDirectory}/${filename}`;
  }
  const langFolder = getLanguageName(language)?.toLowerCase().replace(/[^a-z0-9+#]/g, '').replace(/\+/g, 'plus').replace(/#/g, 'sharp') || 'unknown';
  return `${baseDirectory}/${langFolder}/${filename}`;
}

// ─── Manifest & README Paths ───────────────────────────────────────────────────

/**
 * Build the manifest.json path for a problem directory.
 * "Array/Easy/0001-two-sum" → "Array/Easy/0001-two-sum/manifest.json"
 */
export function buildManifestPath(baseDirectory: string): string {
  return `${baseDirectory}/manifest.json`;
}

/**
 * Build the README.md path for a problem directory.
 * "Array/Easy/0001-two-sum" → "Array/Easy/0001-two-sum/README.md"
 */
export function buildReadmePath(baseDirectory: string): string {
  return `${baseDirectory}/README.md`;
}

// ─── UTF-8 Safe Base64 Encoding ───────────────────────────────────────────────

/**
 * UTF-8 safe Base64 encoder for GitHub API file content payloads.
 *
 * The native btoa() fails on multi-byte characters (e.g., C++ headers,
 * emoji in Python docstrings, Korean/Chinese comments). This function
 * safely encodes any Unicode string to Base64.
 *
 * Usage: Always use this instead of btoa() when encoding source code.
 */
export function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

/**
 * Decode a Base64-encoded string (from GitHub API file content) to UTF-8.
 * Handles content returned with newlines (GitHub splits base64 with \n).
 */
export function base64ToUtf8(base64: string): string {
  return decodeURIComponent(
    atob(base64.replace(/\n/g, '')).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  );
}

// ─── Utility Helpers ───────────────────────────────────────────────────────────

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

/** Get the file extension for a LeetCode language slug. */
export function getLanguageExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language?.toLowerCase()] ?? '.txt';
}

/** Get the display name for a LeetCode language slug. */
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

/** Build the problem folder name from question number and slug. */
export function buildProblemFolder(questionNumber: number, slug: string): string {
  const paddedNumber = String(questionNumber).padStart(4, '0');
  return `${paddedNumber}-${slug}`;
}

/**
 * Generate a stable deduplication hash for a LeetCode submission ID.
 * Stored in chrome.storage.local to prevent re-syncing the same submission.
 */
export function submissionHash(submissionId: string): string {
  return `lc_${submissionId}`;
}

/**
 * Format a date for display in README tables.
 * "2026-07-18T14:32:00Z" → "2026-07-18"
 */
export function formatDateForDisplay(isoTimestamp: string): string {
  return isoTimestamp.split('T')[0];
}

/** Get a difficulty badge emoji. */
export function difficultyBadge(difficulty?: string): string {
  if (!difficulty) return '⚪';
  switch (difficulty.toLowerCase()) {
    case 'easy':   return '🟢';
    case 'medium': return '🟡';
    case 'hard':   return '🔴';
    default:       return '⚪';
  }
}
