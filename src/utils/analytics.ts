/**
 * LeetSync Personal Analytics
 *
 * Computes local, privacy-preserving statistics from the user's cached
 * manifests in chrome.storage.local. No telemetry, no server calls.
 *
 * All metrics are derived purely from ProblemManifest[] and their Solution[].
 */

import type { ProblemManifest, Solution, LanguageSolutionGroup } from '@/types';
import { getLanguageName, ALL_SOLUTION_LABELS, DEFAULT_SOLUTION_LABEL } from '@/utils/filename';

// ─── Analytics Types ───────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  /** Number of unique problems with at least one synced solution. */
  totalProblems: number;
  /** Total number of named solution files across all problems and languages. */
  totalSolutions: number;
  /** Problems solved broken down by difficulty. */
  byDifficulty: { Easy: number; Medium: number; Hard: number };
  /** Solution count per language (display name → count). */
  languageBreakdown: Record<string, number>;
  /** How many times each label has been used (label → count). */
  labelFrequency: Record<string, number>;
  /** The label used most often across all solutions. */
  mostUsedLabel: string | null;
  /**
   * Ratio of "Brute Force" solutions to "Optimal" solutions.
   * e.g. 0.5 means twice as many Optimal as Brute Force.
   * null if either count is 0.
   */
  bruteToOptimalRatio: number | null;
  /**
   * Average runtime in milliseconds across all default solutions
   * where runtime data is available. null if no data.
   */
  averageRuntimeMs: number | null;
  /** Average number of named solutions per problem (across all languages). */
  solutionsPerProblem: number;
  /** Number of solutions with createdAt matching today's date (local time). */
  syncedToday: number;
  /** Total number of distinct programming languages used. */
  totalLanguages: number;
  /** All unique labels ever used, sorted by frequency descending. */
  topLabels: string[];
}

// ─── Main Computation ─────────────────────────────────────────────────────────

/**
 * Compute the full analytics summary from an array of ProblemManifests.
 * Call this with the manifests loaded from chrome.storage.local.
 */
export function computeAnalytics(manifests: ProblemManifest[]): AnalyticsSummary {
  if (manifests.length === 0) {
    return emptyAnalytics();
  }

  const allSolutions: Solution[] = manifests.flatMap((m) =>
    m.solutionGroups.flatMap((g) => g.solutions)
  );

  const totalProblems = manifests.length;
  const totalSolutions = allSolutions.length;

  // Difficulty breakdown
  const byDifficulty = {
    Easy:   manifests.filter((m) => m.difficulty === 'Easy').length,
    Medium: manifests.filter((m) => m.difficulty === 'Medium').length,
    Hard:   manifests.filter((m) => m.difficulty === 'Hard').length,
  };

  // Language breakdown
  const languageBreakdown: Record<string, number> = {};
  for (const s of allSolutions) {
    const displayName = getLanguageName(s.language);
    languageBreakdown[displayName] = (languageBreakdown[displayName] ?? 0) + 1;
  }

  // Label frequency (exclude "Default" from interesting label stats)
  const labelFrequency: Record<string, number> = {};
  for (const s of allSolutions) {
    if (s.label === DEFAULT_SOLUTION_LABEL) continue;
    labelFrequency[s.label] = (labelFrequency[s.label] ?? 0) + 1;
  }

  // Top labels sorted by frequency
  const topLabels = Object.entries(labelFrequency)
    .sort(([, a], [, b]) => b - a)
    .map(([label]) => label);

  const mostUsedLabel = topLabels[0] ?? null;

  // Brute vs Optimal ratio
  const bruteCount = labelFrequency['Brute Force'] ?? 0;
  const optimalCount = labelFrequency['Optimal'] ?? 0;
  const bruteToOptimalRatio =
    bruteCount > 0 && optimalCount > 0 ? bruteCount / optimalCount : null;

  // Average runtime from default solutions (parse "52 ms" → 52)
  const defaultSolutions = allSolutions.filter((s) => s.isDefault && s.runtime);
  const runtimes = defaultSolutions
    .map((s) => parseRuntimeMs(s.runtime))
    .filter((v): v is number => v !== null);
  const averageRuntimeMs =
    runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;

  // Solutions per problem
  const solutionsPerProblem = totalProblems > 0 ? totalSolutions / totalProblems : 0;

  // Synced today
  const todayPrefix = new Date().toISOString().split('T')[0]; // "2026-07-22"
  const syncedToday = allSolutions.filter((s) =>
    s.createdAt.startsWith(todayPrefix)
  ).length;

  // Total distinct languages
  const totalLanguages = Object.keys(languageBreakdown).length;

  return {
    totalProblems,
    totalSolutions,
    byDifficulty,
    languageBreakdown,
    labelFrequency,
    mostUsedLabel,
    bruteToOptimalRatio,
    averageRuntimeMs,
    solutionsPerProblem: Math.round(solutionsPerProblem * 10) / 10,
    syncedToday,
    totalLanguages,
    topLabels,
  };
}

// ─── Filter & Search Helpers ───────────────────────────────────────────────────

export interface SolutionFilterOptions {
  query?: string;       // Matches problem title or solution label
  language?: string;    // LeetCode language slug
  label?: string;       // Exact label match (case-insensitive)
  defaultOnly?: boolean; // Show only isDefault solutions
  /** Filter by LeetCode topic slug or partial name */
  topic?: string;
}

import { topicIndex } from './topic-index';

/**
 * Filter manifests by search query, language, label, default-only flag, and topic.
 * Returns a new array of manifests with non-matching solutions stripped.
 * Manifests with no remaining solutions after filtering are removed.
 */
export function filterManifests(
  manifests: ProblemManifest[],
  options: SolutionFilterOptions
): ProblemManifest[] {
  const { query, language, label, defaultOnly, topic } = options;
  const queryLower = query?.toLowerCase().trim();

  // Pre-filter by topic using O(1) index lookup
  let topicAllowedSlugs: Set<string> | null = null;
  if (topic) {
    topicAllowedSlugs = topicIndex.query(topic);
  }

  return manifests
    .map((manifest) => {
      // If a topic filter was provided and this manifest slug isn't matched by it, exclude it
      if (topicAllowedSlugs !== null && !topicAllowedSlugs.has(manifest.slug)) {
        return null;
      }

      // Filter by problem title query first
      const titleMatches = !queryLower || manifest.title.toLowerCase().includes(queryLower);

      const filteredGroups: LanguageSolutionGroup[] = manifest.solutionGroups
        .filter((g) => !language || g.language === language)
        .map((g) => {
          const filteredSolutions = g.solutions.filter((s) => {
            if (defaultOnly && !s.isDefault) return false;
            if (label && s.label.toLowerCase() !== label.toLowerCase()) return false;
            if (queryLower && !titleMatches && !s.label.toLowerCase().includes(queryLower)) {
              return false;
            }
            return true;
          });
          return { ...g, solutions: filteredSolutions };
        })
        .filter((g) => g.solutions.length > 0);

      if (filteredGroups.length === 0 && !titleMatches) return null;

      return { ...manifest, solutionGroups: filteredGroups.length > 0 ? filteredGroups : manifest.solutionGroups };
    })
    .filter((m): m is ProblemManifest => m !== null);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a LeetCode runtime string to milliseconds.
 * "52 ms" → 52  |  "1 s" → 1000  |  "0 ms" → 0  |  unknown → null
 */
function parseRuntimeMs(runtime?: string): number | null {
  if (!runtime) return null;
  const msMatch = runtime.match(/^(\d+(?:\.\d+)?)\s*ms$/i);
  if (msMatch) return parseFloat(msMatch[1]);
  const sMatch = runtime.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (sMatch) return parseFloat(sMatch[1]) * 1000;
  return null;
}

function emptyAnalytics(): AnalyticsSummary {
  return {
    totalProblems: 0,
    totalSolutions: 0,
    byDifficulty: { Easy: 0, Medium: 0, Hard: 0 },
    languageBreakdown: {},
    labelFrequency: {},
    mostUsedLabel: null,
    bruteToOptimalRatio: null,
    averageRuntimeMs: null,
    solutionsPerProblem: 0,
    syncedToday: 0,
    totalLanguages: 0,
    topLabels: [],
  };
}
