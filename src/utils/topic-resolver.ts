import type { TopicTag, FolderTopic } from '../types/submission';
import { getTopicEntry } from './topic-registry';

/**
 * Resolver interface — future strategies (AI, user-defined) implement this.
 */
export interface TopicResolver {
  resolveFolder(tags: TopicTag[], customMappings?: Record<string, string>): FolderTopic;
}

/**
 * Default resolver: priority-list based, customMappings-aware.
 *
 * Resolution order:
 *  1. Check customMappings (user-defined slug → folder name overrides)
 *  2. Walk TOPIC_PRIORITY_ORDER, pick highest-priority registry match
 *  3. Fall back to first tag's registry entry
 *  4. Fall back to "General"
 */
export const primaryTopicResolver: TopicResolver = {
  resolveFolder(tags, customMappings = {}): FolderTopic {
    if (!tags || tags.length === 0) {
      return { strategy: 'PRIMARY_TOPIC', value: 'General' };
    }

    // 1. Custom mappings take precedence (slug → folder name)
    for (const tag of tags) {
      const mapped = customMappings[tag.slug];
      if (mapped) return { strategy: 'CUSTOM_MAPPING', value: mapped };
    }

    // 2. Priority-list walk
    for (const prioritySlug of TOPIC_PRIORITY_ORDER) {
      const match = tags.find(t => t.slug === prioritySlug);
      if (match) {
        const entry = getTopicEntry(match.slug);
        return { strategy: 'PRIMARY_TOPIC', value: entry?.folder ?? match.name };
      }
    }

    // 3. First tag fallback
    const first = tags[0];
    const entry = getTopicEntry(first.slug);
    return { strategy: 'PRIMARY_TOPIC', value: entry?.folder ?? first.name };
  },
};

/** Ordered priority list (slugs, not display names) */
const TOPIC_PRIORITY_ORDER = [
  'string', 'array', 'hash-table', 'linked-list', 'tree',
  'graph', 'heap-priority-queue', 'stack', 'queue',
  'binary-search', 'dynamic-programming', 'greedy',
  'backtracking', 'trie', 'math', 'bit-manipulation',
  'database', 'shell', 'concurrency',
];
