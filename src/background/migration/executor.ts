/**
 * Phase 6 — Migration Executor
 */

import { githubApi } from '../github-api';
import { executeCommitBatch, verifyBatch, MigrationController } from './safety';
import { refreshLock } from './validator';
import { saveMigrationPlan, saveRollbackPlan, getRollbackPlan, updateSettings } from '@/utils/storage';
import type { MigrationPlan, RollbackPlan, RollbackMove, LeetSyncConfig } from '@/types';
import type { MigrationLogger } from './logger';

export async function executeMigration(
  plan: MigrationPlan,
  token: string,
  owner: string,
  repo: string,
  sessionId: string,
  controller: MigrationController,
  logger: MigrationLogger,
  onProgress?: (plan: MigrationPlan) => void
): Promise<MigrationPlan> {
  plan.status = 'executing';
  plan.startedAt = plan.startedAt || new Date().toISOString();
  await saveMigrationPlan(plan);

  let rollbackPlan: RollbackPlan = (await getRollbackPlan()) || {
    available: true,
    moves: [],
    executedAt: null,
  };

  let lastKnownHeadSha: string | undefined = undefined;

  for (let i = plan.currentBatchIndex; i < plan.batches.length; i++) {
    const batch = plan.batches[i];

    if (controller.signal.aborted) {
      plan.status = 'paused';
      plan.aborted = true;
      plan.lastUpdatedAt = new Date().toISOString();
      await saveMigrationPlan(plan);
      logger.log('info', 'executor', 'Migration cancelled by user controller');
      return plan;
    }

    // Refresh lock heartbeat
    await refreshLock(sessionId);

    logger.log('info', 'executor', `Starting execution of commit batch ${i + 1}/${plan.batches.length}`);

    const result = await executeCommitBatch(batch, token, owner, repo, plan.defaultBranch, logger, lastKnownHeadSha);

    if (result.headDiverged) {
      plan.status = 'paused';
      batch.status = 'failed';
      batch.error = result.error;
      plan.lastUpdatedAt = new Date().toISOString();
      await saveMigrationPlan(plan);
      logger.log('warn', 'executor', `Migration paused due to HEAD divergence: ${result.error}`);
      return plan;
    }

    if (result.success && result.commitSha) {
      lastKnownHeadSha = result.commitSha;
      batch.status = 'committed';
      batch.commitSha = result.commitSha;

      await verifyBatch(batch, plan.moves, token, owner, repo, logger);

      for (const moveId of batch.moveIds) {
        const move = plan.moves.find((m) => m.id === moveId);
        if (move) {
          move.status = 'completed';
          plan.completedCount++;

          const rollbackMove: RollbackMove = {
            moveId: move.id,
            files: move.files.map((f) => ({
              currentPath: f.targetPath,
              originalPath: f.sourcePath,
              currentSha: f.sourceSha,
            })),
            rolledBack: false,
          };
          rollbackPlan.moves.push(rollbackMove);
        }
      }
    } else {
      batch.status = 'failed';
      batch.error = result.error;
      for (const moveId of batch.moveIds) {
        const move = plan.moves.find((m) => m.id === moveId);
        if (move) {
          move.status = 'failed';
          move.error = result.error;
          plan.failedCount++;
        }
      }
    }

    plan.currentBatchIndex = i + 1;
    plan.lastUpdatedAt = new Date().toISOString();
    await saveMigrationPlan(plan);
    await saveRollbackPlan(rollbackPlan);

    if (onProgress) {
      onProgress(plan);
    }
  }


  // Finalization
  if (plan.failedCount === 0) {
    plan.status = 'completed';

    // Write leetsync.json to repo root
    const config: LeetSyncConfig = {
      layoutVersion: 2,
      organizationStrategyVersion: 1,
      folderStrategy: 'PRIMARY_TOPIC',
      features: {
        topicLayout: true,
        migration: true,
      },
      migratedAt: new Date().toISOString(),
      migratedFrom: plan.detectedLayout,
      problemCount: plan.completedCount,
    };

    try {
      // Check if leetsync.json already exists to pass sha if updating
      const existingConfig = await githubApi.getFileContent(token, owner, repo, 'leetsync.json');
      await githubApi.createOrUpdateFile(
        token,
        owner,
        repo,
        'leetsync.json',
        JSON.stringify(config, null, 2),
        'LeetSync: Update repository layout config (layoutVersion 2)',
        existingConfig?.sha
      );
    } catch (err: any) {
      logger.log('warn', 'executor', `Failed to write leetsync.json: ${err.message}`);
    }

    // Update extension settings
    await updateSettings({
      layoutVersion: 2,
      migrationChoice: 'migrate-now',
      folderStructure: 'Topic/Difficulty',
    });

    logger.log('info', 'executor', `Migration successfully completed! ${plan.completedCount} problems migrated.`);
  } else {
    plan.status = 'failed';
    logger.log('error', 'executor', `Migration completed with ${plan.failedCount} failures.`);
  }

  await saveMigrationPlan(plan);
  return plan;
}
