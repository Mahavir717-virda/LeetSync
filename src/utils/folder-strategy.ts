import type { LeetCodeSubmission } from '../types/submission';
import type { FolderStructure } from '../types/settings';
import { getLanguageName } from './filename';

const TOPIC_PRIORITY = [
  'Array',
  'String',
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

/**
 * Clean up topic names for valid folder creation.
 */
export function sanitizeFolderName(name: string): string {
  if (!name) return 'Unknown';
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Sanitize a language display name for use as a folder name.
 * "C++" → "Cpp", "C#" → "Csharp", "Python" → "Python"
 */
export function sanitizeLanguageFolder(language: string): string {
  const displayName = getLanguageName(language) || language || 'Unknown';
  return displayName
    .replace(/\+\+/g, 'pp')
    .replace(/#/g, 'sharp')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Determine the primary topic for a submission based on priority.
 */
export function getPrimaryTopic(tags: string[]): string {
  if (!tags || tags.length === 0) return 'Unknown';

  let highestPriorityIndex = Infinity;
  let bestTopic = tags[0];

  for (const tag of tags) {
    const priority = TOPIC_PRIORITY.indexOf(tag);
    if (priority !== -1 && priority < highestPriorityIndex) {
      highestPriorityIndex = priority;
      bestTopic = tag;
    }
  }

  return sanitizeFolderName(bestTopic);
}

/**
 * Resolve the base directory for a problem depending on user folder structure settings.
 */
export function getProblemDirectory(
  submission: LeetCodeSubmission,
  structure: FolderStructure,
  language?: string
): string {
  const paddedNumber = String(submission.questionNumber).padStart(4, '0');
  const problemFolder = `${paddedNumber}-${submission.titleSlug}`;
  
  const difficulty = submission.difficulty || 'Unknown';

  switch (structure) {
    case 'Flat':
      return problemFolder;
      
    case 'Difficulty':
      return `${difficulty}/${problemFolder}`;
      
    case 'Topic':
      const topic = getPrimaryTopic(submission.tags);
      return `${topic}/${problemFolder}`;
      
    case 'Topic/Difficulty':
    default:
      const nestedTopic = getPrimaryTopic(submission.tags);
      return `${nestedTopic}/${difficulty}/${problemFolder}`;
  }
}

