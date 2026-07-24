import type { ProblemManifest } from '../types/submission';

/**
 * In-memory inverted index: topic slug → Set of problem slugs.
 *
 * Built from ProblemManifest[] on startup; updated after every sync.
 * Enables O(1) topic lookups instead of O(n) manifest scans.
 */
export class TopicIndex {
  private index = new Map<string, Set<string>>();

  /** Build or rebuild index from a full manifest list. */
  build(manifests: ProblemManifest[]): void {
    this.index.clear();
    for (const m of manifests) this.add(m);
  }

  /** Incrementally add or update one manifest entry. */
  add(manifest: ProblemManifest): void {
    const tags = manifest.topicTags ?? [];
    for (const tag of tags) {
      const key = tag.slug.toLowerCase();
      if (!this.index.has(key)) this.index.set(key, new Set());
      this.index.get(key)!.add(manifest.slug);
    }
  }

  /**
   * Look up slugs matching a query.
   * Supports: exact slug, partial name match ("hash" → "hash-table").
   */
  query(input: string): Set<string> {
    const q = input.toLowerCase().replace(/\s+/g, '-');

    // 1. Exact slug hit
    if (this.index.has(q)) return this.index.get(q)!;

    // 2. Prefix / substring slug match
    const result = new Set<string>();
    for (const [slug, slugs] of this.index) {
      if (slug.includes(q)) slugs.forEach(s => result.add(s));
    }
    return result;
  }

  /** Return all known topic slugs. */
  allTopics(): string[] {
    return Array.from(this.index.keys());
  }
}

export const topicIndex = new TopicIndex();
