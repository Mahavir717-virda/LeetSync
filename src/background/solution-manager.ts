/**
 * LeetSync Solution Manager
 *
 * Handles rename, delete, and set-default operations on named solution files.
 * All operations are atomic: the GitHub file mutation happens first, then
 * the manifest.json is updated. On failure, the manifest is NOT updated,
 * keeping it consistent with the actual files on GitHub.
 *
 * Exposed to the popup via:
 *   chrome.runtime.sendMessage({ type: 'SOLUTION_MUTATION', mutation: SolutionMutation })
 */

import type { Solution, SolutionMutation, ProblemManifest, LanguageSolutionGroup } from '@/types';
import { buildLabeledFilename, buildLanguageScopedPath, getLanguageFolder } from '@/utils/filename';
import { getSettings } from '@/utils/storage';
import { githubApi } from './github-api';

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Rename a solution — updates the label in manifest.json and renames the file
 * on GitHub (create new file + delete old, since GitHub has no rename endpoint).
 *
 * If the renamed solution is the default, its filePath changes but isDefault
 * remains true. The README is regenerated after the rename.
 */
export async function renameSolution(
  mutation: SolutionMutation,
  manifest: ProblemManifest,
  manifestPath: string,
  manifestSha: string
): Promise<ProblemManifest> {
  if (!mutation.newLabel) throw new Error('renameSolution requires newLabel');

  const settings = await getSettings();
  const { githubToken: token, repoOwner: owner, repoName: repo } = settings;
  if (!token || !owner || !repo) throw new Error('Not authenticated');

  const { group, solution } = findSolution(manifest, mutation);
  const problemDir = extractProblemDir(solution.filePath, solution.language);
  const newFilePath = buildLanguageScopedPath(problemDir, solution.language, mutation.newLabel);

  // 1. Fetch the current file content
  const existing = await githubApi.getFileContent(token, owner, repo, solution.filePath);
  if (!existing?.content) throw new Error(`File not found on GitHub: ${solution.filePath}`);

  const rawContent = githubApi.decodeFileContent(existing.content);

  // 2. Create the file at the new path
  await githubApi.createOrUpdateFile(
    token, owner, repo, newFilePath, rawContent,
    `Rename solution: "${solution.label}" → "${mutation.newLabel}"`,
    undefined
  );

  // 3. Delete the old file
  await githubApi.deleteFile(
    token, owner, repo, solution.filePath,
    `Remove old file after rename: ${solution.filePath}`,
    existing.sha
  );

  // 4. Update the manifest in memory
  const updatedSolution: Solution = {
    ...solution,
    label: mutation.newLabel,
    filePath: newFilePath,
    updatedAt: new Date().toISOString(),
  };
  const updatedManifest = replaceSolutionInManifest(manifest, group.language, updatedSolution);

  // 5. Push the updated manifest
  await pushManifest(token, owner, repo, manifestPath, updatedManifest, manifestSha);

  return updatedManifest;
}

/**
 * Delete a solution — removes the file from GitHub and the entry from manifest.json.
 *
 * Auto-promotion rule: If the deleted solution was isDefault=true,
 * the most recently created sibling solution is automatically promoted
 * to isDefault=true to keep the invariant intact.
 */
export async function deleteSolution(
  mutation: SolutionMutation,
  manifest: ProblemManifest,
  manifestPath: string,
  manifestSha: string
): Promise<ProblemManifest> {
  const settings = await getSettings();
  const { githubToken: token, repoOwner: owner, repoName: repo } = settings;
  if (!token || !owner || !repo) throw new Error('Not authenticated');

  const { group, solution } = findSolution(manifest, mutation);

  // Guard: must have at least one remaining solution after deletion
  if (group.solutions.length <= 1) {
    throw new Error(
      'Cannot delete the only solution for this language. Delete the problem folder instead.'
    );
  }

  // 1. Fetch the file SHA from GitHub (required for deletion)
  const existing = await githubApi.getFileContent(token, owner, repo, solution.filePath);
  if (!existing?.sha) throw new Error(`File not found on GitHub: ${solution.filePath}`);

  // 2. Delete the file from GitHub
  await githubApi.deleteFile(
    token, owner, repo, solution.filePath,
    `Delete solution: "${solution.label}" (${solution.language})`,
    existing.sha
  );

  // 3. Remove from manifest, auto-promote if needed
  const remainingSolutions = group.solutions.filter((s) => s.id !== solution.id);

  if (solution.isDefault && remainingSolutions.length > 0) {
    // Promote the most recently created sibling
    const mostRecent = [...remainingSolutions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const promotedIdx = remainingSolutions.findIndex((s) => s.id === mostRecent.id);
    remainingSolutions[promotedIdx] = { ...mostRecent, isDefault: true };
  }

  const updatedGroups = manifest.solutionGroups.map((g) =>
    g.language === group.language ? { ...g, solutions: remainingSolutions } : g
  );
  const updatedManifest: ProblemManifest = { ...manifest, solutionGroups: updatedGroups };

  // 4. Push the updated manifest
  await pushManifest(token, owner, repo, manifestPath, updatedManifest, manifestSha);

  return updatedManifest;
}

/**
 * Set a solution as the default for its language group.
 *
 * Clears isDefault on all other solutions in the group, sets it on the target.
 * No GitHub file changes — only manifest.json is updated.
 */
export async function setDefaultSolution(
  mutation: SolutionMutation,
  manifest: ProblemManifest,
  manifestPath: string,
  manifestSha: string
): Promise<ProblemManifest> {
  const settings = await getSettings();
  const { githubToken: token, repoOwner: owner, repoName: repo } = settings;
  if (!token || !owner || !repo) throw new Error('Not authenticated');

  const { group } = findSolution(manifest, mutation);

  const updatedSolutions = group.solutions.map((s) => ({
    ...s,
    isDefault: s.id === mutation.solutionId,
  }));

  const updatedGroups = manifest.solutionGroups.map((g) =>
    g.language === group.language ? { ...g, solutions: updatedSolutions } : g
  );
  const updatedManifest: ProblemManifest = { ...manifest, solutionGroups: updatedGroups };

  await pushManifest(token, owner, repo, manifestPath, updatedManifest, manifestSha);

  return updatedManifest;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function findSolution(
  manifest: ProblemManifest,
  mutation: SolutionMutation
): { group: LanguageSolutionGroup; solution: Solution } {
  const group = manifest.solutionGroups.find((g) => g.language === mutation.language);
  if (!group) throw new Error(`No solutions found for language: ${mutation.language}`);

  const solution = group.solutions.find((s) => s.id === mutation.solutionId);
  if (!solution) throw new Error(`Solution not found: ${mutation.solutionId}`);

  return { group, solution };
}

function replaceSolutionInManifest(
  manifest: ProblemManifest,
  language: string,
  updatedSolution: Solution
): ProblemManifest {
  const updatedGroups = manifest.solutionGroups.map((g) => {
    if (g.language !== language) return g;
    return {
      ...g,
      solutions: g.solutions.map((s) =>
        s.id === updatedSolution.id ? updatedSolution : s
      ),
    };
  });
  return { ...manifest, solutionGroups: updatedGroups };
}

/**
 * Extract the problem directory from a full solution file path.
 * "Array/Easy/0001-two-sum/cpp/optimal.cpp" → "Array/Easy/0001-two-sum"
 */
function extractProblemDir(filePath: string, language: string): string {
  const langFolder = getLanguageFolder(language);
  const idx = filePath.lastIndexOf(`/${langFolder}/`);
  if (idx === -1) {
    // Fallback: strip last two path segments (lang folder + filename)
    return filePath.split('/').slice(0, -2).join('/');
  }
  return filePath.slice(0, idx);
}

async function pushManifest(
  token: string,
  owner: string,
  repo: string,
  manifestPath: string,
  manifest: ProblemManifest,
  manifestSha: string
): Promise<void> {
  await githubApi.createOrUpdateFile(
    token, owner, repo, manifestPath,
    JSON.stringify(manifest, null, 2),
    `Update manifest: ${manifest.title}`,
    manifestSha
  );
}
