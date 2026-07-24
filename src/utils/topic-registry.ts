export interface TopicRegistryEntry {
  /** Canonical display name */
  displayName: string;
  /** Default folder name */
  folder: string;
  /** Optional hex colour for UI badges */
  color?: string;
}

/**
 * Built-in topic registry keyed by LeetCode slug.
 * Slugs are stable even when LeetCode renames the display name.
 */
export const TOPIC_REGISTRY: Record<string, TopicRegistryEntry> = {
  'array':                 { displayName: 'Array',                 folder: 'Array',                color: '#3B82F6' },
  'hash-table':            { displayName: 'Hash Table',            folder: 'Hash-Table',           color: '#8B5CF6' },
  'string':                { displayName: 'String',                folder: 'String',               color: '#10B981' },
  'linked-list':           { displayName: 'Linked List',           folder: 'Linked-List',          color: '#F59E0B' },
  'tree':                  { displayName: 'Tree',                  folder: 'Tree',                 color: '#6366F1' },
  'binary-tree':           { displayName: 'Binary Tree',           folder: 'Tree',                 color: '#6366F1' },
  'binary-search-tree':    { displayName: 'Binary Search Tree',    folder: 'Tree',                 color: '#6366F1' },
  'graph':                 { displayName: 'Graph',                 folder: 'Graph',                color: '#EF4444' },
  'heap-priority-queue':   { displayName: 'Heap (Priority Queue)', folder: 'Heap',                 color: '#F97316' },
  'stack':                 { displayName: 'Stack',                 folder: 'Stack',                color: '#06B6D4' },
  'queue':                 { displayName: 'Queue',                 folder: 'Queue',                color: '#84CC16' },
  'binary-search':         { displayName: 'Binary Search',         folder: 'Binary-Search',        color: '#A855F7' },
  'dynamic-programming':   { displayName: 'Dynamic Programming',   folder: 'Dynamic-Programming',  color: '#EC4899' },
  'greedy':                { displayName: 'Greedy',                folder: 'Greedy',               color: '#14B8A6' },
  'backtracking':          { displayName: 'Backtracking',          folder: 'Backtracking',         color: '#F43F5E' },
  'trie':                  { displayName: 'Trie',                  folder: 'Trie',                 color: '#7C3AED' },
  'math':                  { displayName: 'Math',                  folder: 'Math',                 color: '#0EA5E9' },
  'bit-manipulation':      { displayName: 'Bit Manipulation',      folder: 'Bit-Manipulation',     color: '#D97706' },
  'database':              { displayName: 'Database',              folder: 'Database',             color: '#64748B' },
  'shell':                 { displayName: 'Shell',                 folder: 'Shell',                color: '#475569' },
  'concurrency':           { displayName: 'Concurrency',          folder: 'Concurrency',          color: '#DC2626' },
};

export function getTopicEntry(slug: string): TopicRegistryEntry | undefined {
  return TOPIC_REGISTRY[slug.toLowerCase()];
}
