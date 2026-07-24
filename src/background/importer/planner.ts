import type { SubmissionSummary, ImportActionItem, DuplicateStrategy, FolderStructure } from '@/types';
import { ImportState } from '@/types';
import { getLanguageExtension, buildLanguageScopedPath, DEFAULT_SOLUTION_LABEL } from '@/utils/filename';
import { getProblemDirectory } from '@/utils/folder-strategy';

/**
 * Builds an execution plan for a list of discovered submissions, evaluating duplicate resolution rules.
 */
export function buildImportPlan(
  summaries: SubmissionSummary[],
  existingPaths: Set<string>,
  strategy: DuplicateStrategy = 'replace',
  folderStructure: FolderStructure = 'Topic/Difficulty'
): ImportActionItem[] {
  const actions: ImportActionItem[] = [];

  for (const sub of summaries) {
    const ext = getLanguageExtension(sub.language);
    const baseDirectory = getProblemDirectory(
      { questionNumber: 0, titleSlug: sub.titleSlug, difficulty: 'Medium', tags: [] },
      folderStructure
    );
    const defaultPath = buildLanguageScopedPath(baseDirectory, sub.language, DEFAULT_SOLUTION_LABEL);
    const exists = existingPaths.has(defaultPath);

    let actionType: ImportActionItem['action'] = 'CREATE';
    let targetPath = defaultPath;

    if (exists) {
      if (strategy === 'skip') {
        actionType = 'SKIP';
      } else if (strategy === 'replace' || strategy === 'keep_fastest') {
        actionType = 'UPDATE';
      } else if (strategy === 'rename') {
        actionType = 'RENAME';
        targetPath = buildLanguageScopedPath(baseDirectory, sub.language, `Solution-${sub.submissionId}`);
      }
    }

    actions.push({
      id: `action_${sub.submissionId}`,
      submissionId: sub.submissionId,
      titleSlug: sub.titleSlug,
      title: sub.title,
      language: sub.language,
      difficulty: 'Medium', // Will be enriched during fetch
      action: actionType,
      targetPath,
      state: ImportState.DISCOVERED,
      timestamp: sub.timestamp,
    });
  }

  return actions;
}
