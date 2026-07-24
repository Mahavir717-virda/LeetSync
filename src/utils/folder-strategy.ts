import type { LeetCodeSubmission } from '../types/submission';
import type { FolderStructure } from '../types/settings';
import { getLanguageName, sanitizeSlug } from './filename';

const TOPIC_PRIORITY = [
  'String',
  'Array',
  'Hash Table',
  'Linked List',
  'Tree',
  'Graph',
  'Heap',
  'Stack',
  'Queue',
  'Binary Search',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Trie',
  'Math',
  'Bit Manipulation',
  'Geometry',
  'Database',
  'Shell',
  'Concurrency'
];

/** Map of normalized lower-case tag aliases to canonical display names */
const CANONICAL_TOPICS: Record<string, string> = {
  'string': 'String',
  'array': 'Array',
  'hash-table': 'Hash Table',
  'hashtable': 'Hash Table',
  'linked-list': 'Linked List',
  'linkedlist': 'Linked List',
  'tree': 'Tree',
  'binary-tree': 'Tree',
  'graph': 'Graph',
  'heap': 'Heap',
  'priority-queue': 'Heap',
  'stack': 'Stack',
  'queue': 'Queue',
  'binary-search': 'Binary Search',
  'dynamic-programming': 'Dynamic Programming',
  'dp': 'Dynamic Programming',
  'greedy': 'Greedy',
  'backtracking': 'Backtracking',
  'trie': 'Trie',
  'math': 'Math',
  'bit-manipulation': 'Bit Manipulation',
  'geometry': 'Geometry',
  'database': 'Database',
  'shell': 'Shell',
  'concurrency': 'Concurrency',
};

/**
 * Format and normalize raw contest slugs/names into clean display folder names.
 * "weekly-contest-463" → "Weekly Contest 463"
 * "biweekly-contest-165" → "Biweekly Contest 165"
 */
export function formatContestName(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();
  if (!clean) return null;

  return clean
    .replace(/_/g, '-')
    .split('-')
    .map(word => /^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize and categorize problem difficulty.
 * Guaranteed to return 'Easy' | 'Medium' | 'Hard' | 'Imported'. Never returns 'Unknown'.
 */
export function normalizeDifficulty(diff?: string | null): 'Easy' | 'Medium' | 'Hard' | 'Imported' {
  if (!diff || typeof diff !== 'string') return 'Imported';
  const clean = diff.trim().toLowerCase();
  switch (clean) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    default:
      return 'Imported';
  }
}

/**
 * Clean up topic names for valid folder creation.
 */
export function sanitizeFolderName(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'General';
  const cleaned = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return cleaned || 'General';
}

/**
 * Sanitize a language display name for use as a folder name.
 * "C++" → "Cpp", "C#" → "Csharp", "Python" → "Python"
 */
export function sanitizeLanguageFolder(language?: string | null): string {
  if (!language || typeof language !== 'string') return 'Other';
  const displayName = getLanguageName(language) || language || 'Other';
  const sanitized = displayName
    .replace(/\+\+/g, 'pp')
    .replace(/#/g, 'sharp')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
  return sanitized || 'Other';
}

/**
 * Determine the primary topic for a submission based on priority.
 * Performs case-insensitive matching against canonical topics.
 */
export function getPrimaryTopic(tags?: string[] | null): string {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return 'General';

  const normalizedTags = tags
    .filter(Boolean)
    .map(t => t.toString().trim())
    .filter(t => t.length > 0);

  if (normalizedTags.length === 0) return 'General';

  // If "String" or "string" is in the tags, String takes top priority!
  const hasStringTag = normalizedTags.some(t => t.toLowerCase() === 'string');
  if (hasStringTag) {
    return 'String';
  }

  let highestPriorityIndex = Infinity;
  let bestTopic = normalizedTags[0];

  for (const tag of normalizedTags) {
    const lowerTag = tag.toLowerCase().replace(/\s+/g, '-');
    const canonicalName = CANONICAL_TOPICS[lowerTag] || tag;
    
    // Case-insensitive match against TOPIC_PRIORITY
    const priorityIndex = TOPIC_PRIORITY.findIndex(
      p => p.toLowerCase() === canonicalName.toLowerCase() || p.toLowerCase() === lowerTag
    );

    if (priorityIndex !== -1 && priorityIndex < highestPriorityIndex) {
      highestPriorityIndex = priorityIndex;
      bestTopic = canonicalName;
    }
  }

  return sanitizeFolderName(bestTopic);
}

/**
 * Resolve the base directory for a problem using a progressive fallback chain.
 * Handles Contest folder routing automatically when contestName is present.
 */
export function getProblemDirectory(
  submission: Partial<LeetCodeSubmission> & {
    titleSlug?: string;
    title?: string;
    questionNumber?: number;
    contestName?: string | null;
  },
  structure: FolderStructure,
  _language?: string
): string {
  // 1. Diagnostic log for missing metadata tracing
  if (!submission.titleSlug || !submission.difficulty) {
    console.warn('[LeetSync Path Generator] Submission contains missing metadata fields:', {
      title: submission.title,
      titleSlug: submission.titleSlug,
      difficulty: submission.difficulty,
      questionNumber: submission.questionNumber,
      contestName: submission.contestName,
    });
  }

  // 2. Progressive Fallback Chain for Slug
  const rawSlug =
    submission.titleSlug ??
    (submission.title ? sanitizeSlug(submission.title) : null) ??
    (submission.questionNumber ? `problem-${submission.questionNumber}` : null) ??
    'imported-problem';

  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '') || 'imported-problem';

  const questionNum = submission.questionNumber || 0;
  const paddedNumber = String(questionNum).padStart(4, '0');
  const problemFolder = `${paddedNumber}-${slug}`;

  // 3. Contest Folder Routing (Automatic for contest submissions or structure === 'Contest')
  if (submission.contestName || structure === 'Contest') {
    const contestFolder = formatContestName(submission.contestName) || 'General Contest';
    return `Contest/${contestFolder}/${problemFolder}`;
  }

  // 4. Strict Difficulty Normalization
  const difficulty = normalizeDifficulty(submission.difficulty);

  // 5. Topic Folder Normalization
  const topic = getPrimaryTopic(submission.tags);

  switch (structure) {
    case 'Flat':
      return problemFolder;

    case 'Difficulty':
      return `${difficulty}/${problemFolder}`;

    case 'Topic':
      return `${topic}/${problemFolder}`;

    case 'Topic/Difficulty':
    default:
      return `${topic}/${difficulty}/${problemFolder}`;
  }
}
