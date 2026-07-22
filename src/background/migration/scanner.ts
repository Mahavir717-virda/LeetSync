/**
 * Phase 4 — Problem Scanner
 */

import type { RepoLayout, GitHubTreeEntry, ScannedProblem, ScannedFile } from '@/types';
import { PROTECTED_ROOT_FILES } from '@/types';
import { PROBLEM_FOLDER_REGEX } from '@/utils/constants';


/**
 * Scan repository tree for problem folders based on detected layout.
 */
export async function scanRepositoryProblems(
  layout: RepoLayout,
  tree: GitHubTreeEntry[]
): Promise<{ problems: ScannedProblem[]; duplicates: ScannedProblem[] }> {
  const problemsMap = new Map<string, ScannedProblem>();
  const duplicates: ScannedProblem[] = [];

  for (const entry of tree) {
    if (entry.type !== 'blob') continue;

    const parts = entry.path.split('/');
    let folderName: string | null = null;
    let originalFolderPath: string | null = null;

    if (layout === 'legacy-flat-folder') {
      if (parts.length >= 3 && parts[0] === 'problems') {
        folderName = parts[1];
        originalFolderPath = `problems/${parts[1]}`;
      }
    } else if (layout === 'legacy-flat-root') {
      if (parts.length >= 2) {
        if (!PROTECTED_ROOT_FILES.includes(parts[0])) {
          folderName = parts[0];
          originalFolderPath = parts[0];
        }
      }
    }

    if (!folderName || !originalFolderPath) continue;

    const match = folderName.match(PROBLEM_FOLDER_REGEX);
    if (!match) continue;

    const questionNumber = parseInt(match[1], 10);
    const slug = match[2];
    const fileName = parts.slice(-1)[0];

    const file: ScannedFile = {
      path: entry.path,
      sha: entry.sha,
      name: fileName,
      size: entry.size || 0,
    };

    if (problemsMap.has(slug)) {
      const existing = problemsMap.get(slug)!;
      if (existing.originalPath === originalFolderPath) {
        existing.files.push(file);
      } else {
        // Duplicate problem found across different directories
        duplicates.push({
          originalPath: originalFolderPath,
          questionNumber,
          slug,
          files: [file],
          parseable: true,
        });
      }
    } else {
      problemsMap.set(slug, {
        originalPath: originalFolderPath,
        questionNumber,
        slug,
        files: [file],
        parseable: true,
      });
    }
  }

  return {
    problems: Array.from(problemsMap.values()),
    duplicates,
  };
}
