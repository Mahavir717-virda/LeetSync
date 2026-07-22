/**
 * LeetSync Version Recovery
 *
 * Allows users to restore a solution file to its previous commit after
 * accidentally using "Replace existing" on a solution they wanted to keep.
 *
 * Recovery is possible because the Solution model stores `previousCommitSha`.
 * This module fetches the blob at that SHA and re-commits it as the current version.
 */

import type { Solution, ProblemManifest } from '@/types';
import { getSettings } from '@/utils/storage';
import { githubApi } from './github-api';

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Restore a solution to its previous version using `previousCommitSha`.
 *
 * Steps:
 *  1. Validate that a previous version exists.
 *  2. Fetch the raw file content from GitHub at `previousCommitSha`.
 *  3. Re-commit the old content as the current version.
 *  4. Shift the SHA chain: new previousCommitSha = old commitSha.
 *  5. Update the manifest.json with the new commitSha + timestamp.
 *
 * Returns the updated Solution with the new commitSha and shifted SHA chain.
 */
export async function restorePreviousVersion(
  solution: Solution,
  manifest: ProblemManifest,
  manifestPath: string,
  manifestSha: string
): Promise<{ updatedSolution: Solution; updatedManifest: ProblemManifest }> {
  if (!solution.previousCommitSha) {
    throw new Error(
      `No previous version available for "${solution.label}". ` +
      `This is the original save and has never been replaced.`
    );
  }

  const settings = await getSettings();
  const { githubToken: token, repoOwner: owner, repoName: repo } = settings;
  if (!token || !owner || !repo) throw new Error('Not authenticated');

  // 1. Fetch the raw file content at the previous commit
  const previousContent = await githubApi.getFileContentAtCommit(
    token, owner, repo, solution.filePath, solution.previousCommitSha
  );

  if (!previousContent) {
    throw new Error(
      `Could not retrieve file content at commit ${solution.previousCommitSha}. ` +
      `The commit may have been force-pushed or the repository history altered.`
    );
  }

  // 2. Get the current file's SHA (required by GitHub API to update)
  const currentFile = await githubApi.getFileContent(token, owner, repo, solution.filePath);
  const currentSha = currentFile?.sha;

  // 3. Re-commit the previous content
  const restoreResult = await githubApi.createOrUpdateFile(
    token, owner, repo,
    solution.filePath,
    previousContent,
    `Restore: "${solution.label}" to version at ${solution.previousCommitSha.slice(0, 7)}`,
    currentSha
  );

  const newCommitSha = restoreResult.commit.sha;
  const now = new Date().toISOString();

  // 4. Shift the SHA chain and update timestamps
  const updatedSolution: Solution = {
    ...solution,
    commitSha: newCommitSha,
    previousCommitSha: solution.commitSha, // The "current" becomes the "previous"
    updatedAt: now,
  };

  // 5. Update the manifest
  const updatedGroups = manifest.solutionGroups.map((g) => {
    if (g.language !== solution.language) return g;
    return {
      ...g,
      solutions: g.solutions.map((s) =>
        s.id === solution.id ? updatedSolution : s
      ),
    };
  });
  const updatedManifest: ProblemManifest = { ...manifest, solutionGroups: updatedGroups };

  await githubApi.createOrUpdateFile(
    token, owner, repo, manifestPath,
    JSON.stringify(updatedManifest, null, 2),
    `Restore manifest: ${manifest.title} — "${solution.label}" rolled back`,
    manifestSha
  );

  return { updatedSolution, updatedManifest };
}

/**
 * Check whether a solution is eligible for version recovery.
 * Returns false if this is the original save (previousCommitSha is null).
 */
export function canRestore(solution: Solution): boolean {
  return solution.previousCommitSha !== null;
}

/**
 * Build a human-readable description of what "Restore" will do.
 * Shown in the popup below each replaceable solution.
 */
export function getRestoreDescription(solution: Solution): string | null {
  if (!solution.previousCommitSha) return null;
  const shortSha = solution.previousCommitSha.slice(0, 7);
  const date = solution.updatedAt.split('T')[0];
  return `Restore to version before ${date} (commit ${shortSha})`;
}
