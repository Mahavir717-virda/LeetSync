/**
 * Phase 5 — Migration Planner & Dry-Run Estimator
 */

import { getPrimaryTopic } from '@/utils/folder-strategy';
import { COMMIT_BATCH_SIZE } from '@/utils/constants';
import type {
  ScannedProblem,
  ProblemMetadata,
  RepoLayout,
  MigrationPlan,
  MigrationMove,
  MoveFile,
  CommitBatch,
  TreeMutation,
  MigrationEstimate,
  GitHubRateLimit,
} from '@/types';

export function computeEstimate(
  moves: MigrationMove[],
  rateLimit: GitHubRateLimit | null
): MigrationEstimate {
  const totalProblems = moves.length;
  const totalFiles = moves.reduce((sum, m) => sum + m.files.length, 0);

  // 1 add + 1 delete per file
  const totalMutations = totalFiles * 2;
  const commitBatches = Math.max(1, Math.ceil(totalMutations / COMMIT_BATCH_SIZE));
  const githubApiCalls = commitBatches * 5 + 2; // 5 per batch + 2 overhead
  const estimatedTimeSeconds = Math.ceil(githubApiCalls * 1.5);

  const rateLimitRemaining = rateLimit ? rateLimit.remaining : 5000;
  const rateLimitResetsAt = rateLimit ? new Date(rateLimit.reset * 1000).toISOString() : new Date().toISOString();
  const enoughBudget = rateLimitRemaining >= githubApiCalls * 1.2;

  return {
    totalProblems,
    totalFiles,
    foldersToCreate: totalProblems,
    foldersToDelete: totalProblems,
    commitBatches,
    githubApiCalls,
    estimatedTimeSeconds,
    rateLimitRemaining,
    rateLimitResetsAt,
    enoughBudget,
  };
}

export function buildMigrationPlan(
  detectedLayout: RepoLayout,
  repoOwner: string,
  repoName: string,
  defaultBranch: string,
  problems: ScannedProblem[],
  metadataMap: Map<string, ProblemMetadata>,
  duplicates: ScannedProblem[],
  rateLimit: GitHubRateLimit | null
): MigrationPlan {
  const moves: MigrationMove[] = [];
  const manualReview: ScannedProblem[] = [...duplicates];

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const metadata = metadataMap.get(problem.slug) || null;
    const topicTags = metadata?.topicTags || [];
    const topic = getPrimaryTopic(topicTags.map(t => t.name));
    const difficulty = metadata?.difficulty || 'Easy';
    const paddedNum = String(problem.questionNumber).padStart(4, '0');
    const folderName = `${paddedNum}-${problem.slug}`;
    const targetFolderPath = `${topic}/${difficulty}/${folderName}`;

    const files: MoveFile[] = problem.files.map((f) => ({
      sourcePath: f.path,
      targetPath: `${targetFolderPath}/${f.name}`,
      sourceSha: f.sha,
      verified: false,
    }));

    const move: MigrationMove = {
      id: `move_${i + 1}_${problem.slug}`,
      problem,
      metadata,
      sourcePath: problem.originalPath,
      targetPath: targetFolderPath,
      files,
      status: 'pending',
      conflict: false,
      duplicate: false,
    };

    moves.push(move);
  }

  // Group moves into commit batches of COMMIT_BATCH_SIZE mutations
  const batches: CommitBatch[] = [];
  let currentBatchMoves: string[] = [];
  let currentTreeMutations: TreeMutation[] = [];
  let batchIndex = 0;

  for (const move of moves) {
    const moveMutations: TreeMutation[] = [];
    for (const f of move.files) {
      // Add entry at target path using original blob SHA
      moveMutations.push({
        path: f.targetPath,
        mode: '100644',
        type: 'blob',
        sha: f.sourceSha,
      });
      // Delete entry from source path
      moveMutations.push({
        path: f.sourcePath,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }

    if (currentTreeMutations.length + moveMutations.length > COMMIT_BATCH_SIZE && currentBatchMoves.length > 0) {
      batches.push({
        index: batchIndex,
        moveIds: [...currentBatchMoves],
        treeEntries: [...currentTreeMutations],
        status: 'pending',
      });
      batchIndex++;
      currentBatchMoves = [];
      currentTreeMutations = [];
    }

    move.batchIndex = batchIndex;
    currentBatchMoves.push(move.id);
    currentTreeMutations.push(...moveMutations);
  }

  if (currentBatchMoves.length > 0) {
    batches.push({
      index: batchIndex,
      moveIds: [...currentBatchMoves],
      treeEntries: [...currentTreeMutations],
      status: 'pending',
    });
  }

  const estimate = computeEstimate(moves, rateLimit);

  return {
    version: 1,
    status: 'previewing',
    detectedLayout,
    repoOwner,
    repoName,
    defaultBranch,
    totalProblems: moves.length,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    moves,
    batches,
    manualReview,
    estimate,
    startedAt: null,
    lastUpdatedAt: new Date().toISOString(),
    currentBatchIndex: 0,
    aborted: false,
  };
}
