import type { LeetCodeSubmission, TopicTag } from '../types/submission';
import type { FolderStructure } from '../types/settings';
import { getLanguageName, sanitizeSlug } from './filename';
import { primaryTopicResolver } from './topic-resolver';

/** Format and normalize raw contest slugs/names into clean display folder names. */
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

/** Normalize and categorize problem difficulty. */
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

/** Clean up topic names for valid folder creation. */
export function sanitizeFolderName(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'General';
  const cleaned = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return cleaned || 'General';
}

/** Sanitize a language display name for use as a folder name. */
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
 * @deprecated Pass TopicTag[] to getProblemDirectory instead.
 */
export function getPrimaryTopic(tags?: string[] | null): string {
  const topicTags: TopicTag[] = (tags ?? []).map(t => ({
    name: t,
    slug: t.toLowerCase().replace(/\s+/g, '-'),
  }));
  return primaryTopicResolver.resolveFolder(topicTags).value;
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
    topicTags?: TopicTag[];
    tags?: string[];
  },
  structure: FolderStructure,
  customMappings?: Record<string, string>,
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

  // 3. Contest Folder Routing
  if (submission.contestName || structure === 'Contest') {
    const contestFolder = formatContestName(submission.contestName) || 'General Contest';
    return `Contest/${contestFolder}/${problemFolder}`;
  }

  // 4. Strict Difficulty Normalization
  const difficulty = normalizeDifficulty(submission.difficulty);

  // 5. Topic Folder Normalization
  const topicTags: TopicTag[] = submission.topicTags ?? 
    (submission.tags ?? []).map(t => ({ name: t, slug: t.toLowerCase().replace(/\s+/g, '-') }));
  const folderTopic = primaryTopicResolver.resolveFolder(topicTags, customMappings);
  const topic = sanitizeFolderName(folderTopic.value);

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
