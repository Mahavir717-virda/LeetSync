/**
 * Phase 8 — Migration Subsystem Barrel & Orchestrator
 */

export * from './validator';
export * from './detect-layout';
export * from './scanner';
export * from './metadata-fetcher';
export * from './planner';
export * from './safety';
export * from './executor';
export * from './rollback';
export * from './logger';

import { runPreflight, releaseLock } from './validator';
import { detectRepoLayout } from './detect-layout';
import { scanRepositoryProblems } from './scanner';
import { batchResolveMetadata } from './metadata-fetcher';
import { buildMigrationPlan } from './planner';
import { MigrationController } from './safety';
import { executeMigration } from './executor';
import { executeRollback } from './rollback';
import { migrationLogger } from './logger';
import { primaryTopicResolver } from '@/utils/topic-resolver';
import type { ProblemManifest } from '@/types';
import { getSettings, getMigrationPlan, saveMigrationPlan, getRollbackPlan } from '@/utils/storage';
import type { MigrationPlan } from '@/types';
import { githubApi } from '../github-api';

let activeController: MigrationController | null = null;

export async function handleStartMigrationScan(sessionId: string): Promise<any> {
  const settings = await getSettings();
  if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
    throw new Error('Missing GitHub credentials or target repository');
  }

  const token = settings.githubToken;
  const owner = settings.repoOwner;
  const repo = settings.repoName;

  migrationLogger.log('info', 'orchestrator', `Starting migration scan for ${owner}/${repo}`);

  // 1. Run Pre-flight
  const preflight = await runPreflight(token, owner, repo, sessionId);
  if (!preflight.passed) {
    return { success: false, preflight };
  }

  // 2. Detect layout
  const { layout, tree, defaultBranch } = await detectRepoLayout(token, owner, repo);
  migrationLogger.log('info', 'orchestrator', `Detected repo layout: ${layout}`);

  if (layout !== 'legacy-flat-folder' && layout !== 'legacy-flat-root') {
    await releaseLock(sessionId);
    return {
      success: true,
      layout,
      message: 'Repository is already using topic/difficulty structure or is empty.',
      plan: null,
    };
  }

  // 3. Scan problems
  const { problems, duplicates } = await scanRepositoryProblems(layout, tree);
  migrationLogger.log('info', 'orchestrator', `Scanned ${problems.length} problems, ${duplicates.length} duplicates`);

  // 4. Resolve metadata
  const metadataMap = await batchResolveMetadata(problems, tree, token, owner, repo);

  // 5. Build plan
  const rateLimit = githubApi.getRateLimit();
  const plan = buildMigrationPlan(
    layout,
    owner,
    repo,
    defaultBranch,
    problems,
    metadataMap,
    duplicates,
    rateLimit
  );

  await saveMigrationPlan(plan);

  migrationLogger.log('info', 'orchestrator', `Migration plan generated: ${plan.batches.length} batches`);

  return {
    success: true,
    layout,
    preflight,
    plan,
  };
}

export async function handleConfirmMigration(sessionId: string, planPayload?: MigrationPlan): Promise<any> {
  const settings = await getSettings();
  if (!settings.githubToken) {
    throw new Error('Missing GitHub authentication token. Please log in again.');
  }

  let plan = planPayload || (await getMigrationPlan());
  if (!plan) {
    throw new Error('No migration plan found. Please run the pre-flight scan again.');
  }

  await saveMigrationPlan(plan);

  activeController = new MigrationController();

  // Execute in background
  executeMigration(
    plan,
    settings.githubToken,
    plan.repoOwner,
    plan.repoName,
    sessionId,
    activeController,
    migrationLogger
  )
    .catch((err) => {
      migrationLogger.log('error', 'orchestrator', `Migration execution background error: ${err.message}`);
    })
    .finally(async () => {
      await releaseLock(sessionId);
      activeController = null;
    });

  return { success: true, message: 'Migration started' };
}

export async function handleCancelMigration(sessionId: string): Promise<any> {
  if (activeController) {
    activeController.cancel();
  }
  await releaseLock(sessionId);
  return { success: true, message: 'Migration cancellation requested' };
}

export async function handleStartRollback(): Promise<any> {
  const settings = await getSettings();
  const rollbackPlan = await getRollbackPlan();
  const plan = await getMigrationPlan();
  if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
    throw new Error('Missing GitHub credentials');
  }
  if (!rollbackPlan || rollbackPlan.moves.length === 0) {
    throw new Error('No rollback plan available');
  }

  const branch = plan?.defaultBranch || 'main';
  const result = await executeRollback(
    rollbackPlan,
    settings.githubToken,
    settings.repoOwner,
    settings.repoName,
    branch,
    migrationLogger
  );

  return result;
}

export async function handleRegenerateStats(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSettings();
    const plan = await getMigrationPlan();

    if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
      return { success: false, error: 'Missing GitHub credentials' };
    }

    if (!plan || plan.moves.length === 0) {
      return { success: false, error: 'No migration data found' };
    }

    const { generateRootReadme, generateStats } = await import('@/generators/readme');
    const manifests: ProblemManifest[] = plan.moves.map((move) => {
      const topicTags = move.metadata?.topicTags || [];
      const folderTopic = primaryTopicResolver.resolveFolder(topicTags);
      return {
        number: move.problem.questionNumber,
        title: move.metadata?.title || move.problem.slug,
        slug: move.problem.slug,
        difficulty: (move.metadata?.difficulty || 'Easy') as 'Easy' | 'Medium' | 'Hard',
        folderTopic,
        topicTags,
        tags: topicTags.map(t => t.name),
        url: `https://leetcode.com/problems/${move.problem.slug}/`,
        schemaVersion: 2,
        organizationStrategyVersion: 1,
        solutionGroups: [{
          language: move.files[0]?.targetPath.split('.').pop() || 'txt',
          solutions: move.files.map((f, i) => ({
            id: `migration_${i}_${f.targetPath}`,
            label: i === 0 ? 'Default' : `Solution ${i + 1}`,
            language: f.targetPath.split('.').pop() || 'txt',
            filePath: f.targetPath,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDefault: i === 0,
            runtime: 'N/A',
            memory: 'N/A',
            runtimePercentile: 0,
            memoryPercentile: 0,
            commitSha: f.sourceSha,
            previousCommitSha: null,
            submissionId: `migration_${f.sourceSha}`,
          })),
        }],
      };
    });

    const readmeContent = generateRootReadme(manifests, settings.githubUsername || 'User');
    const statsContent = generateStats(manifests);

    const existingReadme = await githubApi.getFileContent(
      settings.githubToken,
      settings.repoOwner,
      settings.repoName,
      'README.md'
    );

    await githubApi.createOrUpdateFile(
      settings.githubToken,
      settings.repoOwner,
      settings.repoName,
      'README.md',
      readmeContent,
      'LeetSync: Update root README.md post-migration',
      existingReadme?.sha
    );

    const existingStats = await githubApi.getFileContent(
      settings.githubToken,
      settings.repoOwner,
      settings.repoName,
      'STATS.md'
    );

    await githubApi.createOrUpdateFile(
      settings.githubToken,
      settings.repoOwner,
      settings.repoName,
      'STATS.md',
      statsContent,
      'LeetSync: Update STATS.md post-migration',
      existingStats?.sha
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

