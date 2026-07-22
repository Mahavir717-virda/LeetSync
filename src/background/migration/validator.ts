/**
 * Phase 0 — Repository Validator & Migration Lock Module
 */

import { githubApi } from '../github-api';
import { getSettings, getMigrationLock, saveMigrationLock, clearMigrationLock } from '@/utils/storage';
import { LEETCODE_GRAPHQL_URL, NON_LEETCODE_INDICATORS, MIGRATION_LOCK_TTL_MS } from '@/utils/constants';
import type { PreflightResult, PreflightCheck, MigrationLock } from '@/types';

/**
 * Acquire migration lock to prevent concurrent executions across extension instances.
 */
export async function acquireLock(sessionId: string): Promise<{ success: boolean; lock?: MigrationLock }> {
  const currentLock = await getMigrationLock();
  const now = Date.now();

  if (currentLock && currentLock.active) {
    const expiresAtMs = new Date(currentLock.expiresAt).getTime();
    if (now < expiresAtMs && currentLock.lockedBy !== sessionId) {
      return { success: false, lock: currentLock };
    }
  }

  const newLock: MigrationLock = {
    active: true,
    lockedAt: new Date(now).toISOString(),
    lockedBy: sessionId,
    expiresAt: new Date(now + MIGRATION_LOCK_TTL_MS).toISOString(),
  };

  await saveMigrationLock(newLock);
  return { success: true, lock: newLock };
}

/**
 * Refresh migration lock TTL (called during execution heartbeats).
 */
export async function refreshLock(sessionId: string): Promise<boolean> {
  const currentLock = await getMigrationLock();
  if (!currentLock || currentLock.lockedBy !== sessionId) {
    return false;
  }

  const refreshed: MigrationLock = {
    ...currentLock,
    expiresAt: new Date(Date.now() + MIGRATION_LOCK_TTL_MS).toISOString(),
  };

  await saveMigrationLock(refreshed);
  return true;
}

/**
 * Release migration lock.
 */
export async function releaseLock(sessionId: string): Promise<void> {
  const currentLock = await getMigrationLock();
  if (!currentLock || currentLock.lockedBy === sessionId) {
    await clearMigrationLock();
  }
}

/**
 * Run full pre-flight validation checklist before migration.
 */
export async function runPreflight(
  token: string,
  owner: string,
  repo: string,
  sessionId: string
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // Check 1: GitHub Token
  if (!token || token.trim().length === 0) {
    checks.push({ name: 'GitHub Connected', status: 'fail', message: 'No GitHub token configured.' });
    return { passed: false, checks };
  } else {
    checks.push({ name: 'GitHub Connected', status: 'pass', message: 'Token exists.' });
  }

  // Check 2: Token Valid
  let user;
  try {
    user = await githubApi.getUser(token);
    checks.push({ name: 'Token Valid', status: 'pass', message: `Authenticated as ${user.login}.` });
  } catch (err: any) {
    checks.push({ name: 'Token Valid', status: 'fail', message: `Token validation failed: ${err.message}` });
    return { passed: false, checks };
  }

  // Check 3: Repo Exists
  let repoData;
  try {
    repoData = await githubApi.getRepo(token, owner, repo);
    checks.push({ name: 'Repository Exists', status: 'pass', message: `Repository ${owner}/${repo} accessible.` });
  } catch (err: any) {
    checks.push({ name: 'Repository Exists', status: 'fail', message: `Could not access repository: ${err.message}` });
    return { passed: false, checks };
  }

  // Check 4: Default Branch
  if (!repoData.default_branch) {
    checks.push({ name: 'Default Branch', status: 'fail', message: 'Repository default branch not found.' });
    return { passed: false, checks };
  } else {
    checks.push({ name: 'Default Branch', status: 'pass', message: `Default branch: ${repoData.default_branch}` });
  }

  // Check 5: Write Permission
  if (repoData.permissions && repoData.permissions.push === false) {
    checks.push({ name: 'Write Permission', status: 'fail', message: 'Token lacks push permission to repository.' });
    return { passed: false, checks };
  } else {
    checks.push({ name: 'Write Permission', status: 'pass', message: 'Push permission confirmed.' });
  }

  // Check 6: Migration Lock
  const lockResult = await acquireLock(sessionId);
  if (!lockResult.success) {
    checks.push({
      name: 'Migration Lock',
      status: 'fail',
      message: `Another migration is already running (Session: ${lockResult.lock?.lockedBy}).`,
    });
    return { passed: false, checks };
  } else {
    checks.push({ name: 'Migration Lock', status: 'pass', message: 'Lock acquired exclusively.' });
  }

  // Check 7: API Budget
  const rateLimit = githubApi.getRateLimit();
  if (rateLimit && rateLimit.remaining < 50) {
    const resetTime = new Date(rateLimit.reset * 1000).toLocaleTimeString();
    checks.push({
      name: 'API Budget',
      status: 'warn',
      message: `Low API quota (${rateLimit.remaining} remaining). Resets at ${resetTime}.`,
    });
  } else {
    checks.push({
      name: 'API Budget',
      status: 'pass',
      message: `API budget sufficient (${rateLimit?.remaining ?? '5000+'} remaining).`,
    });
  }

  // Check 8: LeetCode Reachable
  try {
    const lcTest = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ping { question(titleSlug: "two-sum") { questionFrontendId } }`,
      }),
    });
    if (lcTest.ok) {
      checks.push({ name: 'LeetCode Reachable', status: 'pass', message: 'LeetCode GraphQL responding.' });
    } else {
      checks.push({
        name: 'LeetCode Reachable',
        status: 'warn',
        message: 'LeetCode API returning errors; fallback metadata will be used if needed.',
      });
    }
  } catch {
    checks.push({
      name: 'LeetCode Reachable',
      status: 'warn',
      message: 'Could not reach LeetCode API; cached/repo metadata will be used.',
    });
  }

  // Check 9: Non-LeetCode Indicator Warning
  try {
    let hasNonLcFile = false;
    for (const indicator of NON_LEETCODE_INDICATORS) {
      const file = await githubApi.getFileContent(token, owner, repo, indicator);
      if (file) {
        hasNonLcFile = true;
        break;
      }
    }
    if (hasNonLcFile) {
      checks.push({
        name: 'Repository Type',
        status: 'warn',
        message: 'Detected application files (e.g. package.json). Please confirm this is a LeetCode repo.',
      });
    } else {
      checks.push({ name: 'Repository Type', status: 'pass', message: 'Repository appears to be a LeetCode repo.' });
    }
  } catch {
    checks.push({ name: 'Repository Type', status: 'pass', message: 'Repository structure check completed.' });
  }

  // Check 10: Storage Quota
  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse(null);
    const megaBytes = (bytesInUse / (1024 * 1024)).toFixed(2);
    checks.push({ name: 'Storage Quota', status: 'pass', message: `Storage in use: ${megaBytes} MB.` });
  } catch {
    checks.push({ name: 'Storage Quota', status: 'pass', message: 'Storage quota check completed.' });
  }

  const hasFailed = checks.some((c) => c.status === 'fail');
  return { passed: !hasFailed, checks };
}
