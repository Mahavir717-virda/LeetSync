import type { SubmissionSummary, ImportActionItem, DuplicateStrategy } from '@/types';
import { ImportState } from '@/types';
import { getLanguageExtension } from '@/utils/filename';

/**
 * Builds an execution plan for a list of discovered submissions, evaluating duplicate resolution rules.
 */
export function buildImportPlan(
  summaries: SubmissionSummary[],
  existingPaths: Set<string>,
  strategy: DuplicateStrategy = 'replace'
): ImportActionItem[] {
  const actions: ImportActionItem[] = [];

  for (const sub of summaries) {
    const ext = getLanguageExtension(sub.language);
    const paddedId = String(sub.submissionId).padStart(4, '0');
    const folder = `problems/${sub.titleSlug}`;
    const defaultPath = `${folder}/solution${ext}`;
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
        targetPath = `${folder}/solution-${sub.submissionId}${ext}`;
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
