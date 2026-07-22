/**
 * Phase 6.5 — Migration Rollback Module
 */

import { githubApi } from '../github-api';
import { saveRollbackPlan, updateSettings, clearMigrationPlan } from '@/utils/storage';
import type { RollbackPlan, TreeMutation } from '@/types';
import type { MigrationLogger } from './logger';
import { COMMIT_BATCH_SIZE } from '@/utils/constants';

export async function executeRollback(
  rollbackPlan: RollbackPlan,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  logger: MigrationLogger,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: boolean; rolled: number; failed: number }> {
  if (!rollbackPlan || rollbackPlan.moves.length === 0) {
    return { success: false, rolled: 0, failed: 0 };
  }

  logger.log('info', 'rollback', `Starting rollback of ${rollbackPlan.moves.length} moves...`);

  // Build reverse tree mutations
  const treeMutations: TreeMutation[] = [];
  for (const move of rollbackPlan.moves) {
    if (move.rolledBack) continue;
    for (const file of move.files) {
      // Add to original path
      treeMutations.push({
        path: file.originalPath,
        mode: '100644',
        type: 'blob',
        sha: file.currentSha,
      });
      // Delete from current path
      treeMutations.push({
        path: file.currentPath,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }
  }

  if (treeMutations.length === 0) {
    return { success: true, rolled: 0, failed: 0 };
  }

  // Split into batches if needed
  const batchesCount = Math.ceil(treeMutations.length / COMMIT_BATCH_SIZE);
  let rolled = 0;
  let failed = 0;

  for (let b = 0; b < batchesCount; b++) {
    const batchEntries = treeMutations.slice(b * COMMIT_BATCH_SIZE, (b + 1) * COMMIT_BATCH_SIZE);
    try {
      const ref = await githubApi.getRef(token, owner, repo, branch);
      const headSha = ref.object.sha;
      const currentCommit = await githubApi.getCommit(token, owner, repo, headSha);
      const newTree = await githubApi.createTree(token, owner, repo, currentCommit.tree.sha, batchEntries);
      const commitMessage = `LeetSync Rollback: restore original repository layout (${b + 1}/${batchesCount})`;
      const newCommit = await githubApi.createCommit(token, owner, repo, commitMessage, newTree.sha, [headSha]);
      await githubApi.updateRef(token, owner, repo, branch, newCommit.sha);
      rolled += batchEntries.length / 2;
    } catch (err: any) {
      logger.log('error', 'rollback', `Rollback batch ${b + 1} failed: ${err.message}`);
      failed += batchEntries.length / 2;
    }

    if (onProgress) {
      onProgress(rolled, treeMutations.length / 2);
    }
  }

  if (failed === 0) {
    rollbackPlan.executedAt = new Date().toISOString();
    await saveRollbackPlan(rollbackPlan);
    await clearMigrationPlan();

    // Reset settings
    await updateSettings({
      layoutVersion: 1,
      migrationChoice: null,
    });

    // Update or remove leetsync.json
    try {
      const config = { layoutVersion: 1 };
      const existing = await githubApi.getFileContent(token, owner, repo, 'leetsync.json');
      await githubApi.createOrUpdateFile(
        token,
        owner,
        repo,
        'leetsync.json',
        JSON.stringify(config, null, 2),
        'LeetSync Rollback: reset layoutVersion to 1',
        existing?.sha
      );
    } catch {
      // ignore
    }

    logger.log('info', 'rollback', 'Rollback completed successfully!');
    return { success: true, rolled, failed: 0 };
  }

  return { success: false, rolled, failed };
}
