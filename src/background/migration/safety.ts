/**
 * Phase 5.5 — Migration Safety Layer (Atomic Batch Commits & Verification)
 */

import { githubApi } from '../github-api';
import type { CommitBatch, MigrationMove } from '@/types';
import type { MigrationLogger } from './logger';

export class MigrationController {
  private controller = new AbortController();

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  cancel(): void {
    this.controller.abort();
  }
}

/**
 * Execute an atomic commit batch using Git Data API with HEAD divergence detection.
 */
export async function executeCommitBatch(
  batch: CommitBatch,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  logger: MigrationLogger,
  expectedHeadSha?: string
): Promise<{ success: boolean; commitSha?: string; error?: string; headDiverged?: boolean }> {
  try {
    // Step 1: Get HEAD ref
    logger.log('info', 'safety', `Batch ${batch.index + 1}: Getting branch ref heads/${branch}`);
    const ref = await githubApi.getRef(token, owner, repo, branch);
    const headSha = ref.object.sha;

    // Check 1.1: HEAD divergence detection
    if (expectedHeadSha && headSha !== expectedHeadSha) {
      logger.log('warn', 'safety', `HEAD diverged during migration. Expected ${expectedHeadSha.slice(0, 7)}, got ${headSha.slice(0, 7)}`);
      return {
        success: false,
        headDiverged: true,
        error: 'The repository changed during migration. Review the latest changes before continuing.',
      };
    }

    // Step 2: Get current commit to find base tree SHA
    const currentCommit = await githubApi.getCommit(token, owner, repo, headSha);
    const baseTreeSha = currentCommit.tree.sha;

    // Step 3: Create tree with mutations
    logger.log('info', 'safety', `Batch ${batch.index + 1}: Creating Git tree with ${batch.treeEntries.length} entries`);
    const newTree = await githubApi.createTree(token, owner, repo, baseTreeSha, batch.treeEntries);

    // Step 4: Create commit pointing to new tree
    const commitMessage = `LeetSync Migration (batch ${batch.index + 1})`;
    const newCommit = await githubApi.createCommit(token, owner, repo, commitMessage, newTree.sha, [headSha]);

    // Step 5: Update ref to point branch to new commit
    logger.log('info', 'safety', `Batch ${batch.index + 1}: Updating branch ref to commit ${newCommit.sha.slice(0, 7)}`);
    await githubApi.updateRef(token, owner, repo, branch, newCommit.sha);

    return { success: true, commitSha: newCommit.sha };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown batch commit failure';
    logger.log('error', 'safety', `Batch ${batch.index + 1} execution failed`, { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Verify blob SHAs after batch commit execution.
 */
export async function verifyBatch(
  batch: CommitBatch,
  moves: MigrationMove[],
  token: string,
  owner: string,
  repo: string,
  logger: MigrationLogger
): Promise<boolean> {
  if (!batch.commitSha) return false;

  try {
    const newTreeResponse = await githubApi.getTree(token, owner, repo, batch.commitSha, true);
    const treeEntries = newTreeResponse.tree || [];
    let allVerified = true;

    for (const moveId of batch.moveIds) {
      const move = moves.find((m) => m.id === moveId);
      if (!move) continue;

      for (const file of move.files) {
        const targetEntry = treeEntries.find((e) => e.path === file.targetPath);
        if (!targetEntry || targetEntry.sha !== file.sourceSha) {
          logger.log('warn', 'safety', `SHA verification mismatch for file: ${file.targetPath}`, {
            expected: file.sourceSha,
            actual: targetEntry?.sha || 'missing',
          });
          allVerified = false;
        } else {
          file.verified = true;
        }
      }
    }

    return allVerified;
  } catch (err: any) {
    logger.log('warn', 'safety', `Batch verification query failed: ${err.message}`);
    return false;
  }
}

