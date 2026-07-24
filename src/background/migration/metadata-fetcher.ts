/**
 * Phase 4 — Metadata Resolver & Fetcher
 */

import { githubApi } from '../github-api';
import { getCachedMetadata, setMetadataCache } from '@/utils/storage';
import { LEETCODE_GRAPHQL_URL } from '@/utils/constants';
import type { ProblemMetadata, ScannedProblem, GitHubTreeEntry, TopicTag } from '@/types';

/**
 * Fetch problem metadata from LeetCode GraphQL API.
 */
export async function fetchLeetCodeMetadata(slug: string): Promise<ProblemMetadata | null> {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty
        topicTags {
          name
          slug
        }
      }
    }
  `;

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug },
      }),
    });

    if (!response.ok) return null;

    const json = await response.json();
    const q = json?.data?.question;
    if (!q) return null;

    const rawDifficulty = q.difficulty ?? q.questionDifficulty ?? q.stats?.difficulty;
    const difficulty = (['Easy', 'Medium', 'Hard'].includes(rawDifficulty) ? rawDifficulty : 'Medium') as 'Easy' | 'Medium' | 'Hard';
    const topicTags: TopicTag[] = Array.isArray(q.topicTags)
      ? q.topicTags.map((t: any) => ({
          name: typeof t === 'string' ? t : (t?.name ?? ''),
          slug: typeof t === 'string'
            ? t.toLowerCase().replace(/\s+/g, '-')
            : (t?.slug ?? t?.name?.toLowerCase().replace(/\s+/g, '-') ?? ''),
        })).filter((t: any) => t.name && t.slug)
      : [];
    const resolvedSlug = q.titleSlug || slug;
    const resolvedTitle = q.title || slug;
    const questionNumber = parseInt(q.questionFrontendId || q.questionId || '0', 10);

    return {
      slug: resolvedSlug,
      title: resolvedTitle,
      questionNumber,
      difficulty,
      topicTags,
      fetched: true,
      source: 'leetcode',
    };
  } catch (err) {
    console.warn('[LeetSync Metadata Fetcher] GraphQL fetch exception for slug:', slug, err);
    return null;
  }
}

/**
 * Attempt to read metadata from repository tree (manifest.json files).
 */
export async function findRepoMetadata(
  slug: string,
  tree: GitHubTreeEntry[],
  token: string,
  owner: string,
  repo: string
): Promise<ProblemMetadata | null> {
  const manifestEntry = tree.find((e: GitHubTreeEntry) => e.path.includes(slug) && e.path.endsWith('manifest.json'));

  if (!manifestEntry) return null;

  try {
    const blob = await githubApi.getBlob(token, owner, repo, manifestEntry.sha);
    const content = githubApi.decodeFileContent(blob.content);
    const manifest = JSON.parse(content);
    if (manifest && manifest.title) {
      const topicTags: TopicTag[] = Array.isArray(manifest.topicTags)
        ? manifest.topicTags
        : (manifest.tags ?? manifest.topics ?? []).map((t: string) => ({
            name: t,
            slug: t.toLowerCase().replace(/\s+/g, '-'),
          }));
      return {
        slug,
        title: manifest.title || slug,
        questionNumber: manifest.questionNumber || 0,
        difficulty: manifest.difficulty || 'Easy',
        topicTags,
        fetched: true,
        source: 'repository',
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Resolve metadata for a single problem using 4-source fallback chain.
 */
export async function resolveProblemMetadata(
  problem: ScannedProblem,
  tree: GitHubTreeEntry[],
  token: string,
  owner: string,
  repo: string
): Promise<ProblemMetadata> {
  // 1. Check metadata cache
  const cached = await getCachedMetadata(problem.slug);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // 2. Fetch from LeetCode GraphQL
  const leetcodeMeta = await fetchLeetCodeMetadata(problem.slug);
  if (leetcodeMeta) {
    await setMetadataCache(problem.slug, leetcodeMeta);
    return leetcodeMeta;
  }

  // 3. Fallback to repository metadata (manifest.json)
  const repoMeta = await findRepoMetadata(problem.slug, tree, token, owner, repo);
  if (repoMeta) {
    await setMetadataCache(problem.slug, repoMeta);
    return repoMeta;
  }

  // 4. Fallback unknown
  const fallback: ProblemMetadata = {
    slug: problem.slug,
    title: problem.slug,
    questionNumber: problem.questionNumber,
    difficulty: 'Easy',
    topicTags: [{ name: 'Uncategorized', slug: 'uncategorized' }],
    fetched: false,
    source: 'unknown',
    error: 'Metadata resolution failed across all sources',
  };

  return fallback;
}

/**
 * Batch resolve metadata for all scanned problems with rate limiting and progress callback.
 */
export async function batchResolveMetadata(
  problems: ScannedProblem[],
  tree: GitHubTreeEntry[],
  token: string,
  owner: string,
  repo: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ProblemMetadata>> {
  const result = new Map<string, ProblemMetadata>();
  const total = problems.length;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const metadata = await resolveProblemMetadata(problem, tree, token, owner, repo);
    result.set(problem.slug, metadata);

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Rate limit LeetCode GraphQL calls (small delay for non-cached items)
    if (metadata.source === 'leetcode') {
      await new Promise((res) => setTimeout(res, 250));
    }
  }

  return result;
}
