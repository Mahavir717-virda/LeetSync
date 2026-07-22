/**
 * LeetSync Background Service Worker
 *
 * Central hub for:
 * - GitHub API communication
 * - OAuth token management
 * - Submission sync pipeline
 * - Offline queue & retry logic
 */

import { MessageType, StorageKey, RETRY_ALARM_NAME, RETRY_INTERVAL_MINUTES, DEFAULT_REPO_NAME, DEFAULT_REPO_DESCRIPTION } from '@/utils/constants';
import type { LeetCodeSubmission, LeetSyncSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { loginWithOAuth, loginWithPAT, logout as authLogout, validateStoredToken } from './auth';
import { githubApi } from './github-api';
import { syncSubmission } from './sync-engine';
import { getPendingItems, markInProgress, markComplete, markFailed, getQueueStats, acquireLock, releaseLock, resetStuckItems } from './queue';
import { getSettings as storageGetSettings, updateSettings as storageUpdateSettings, getMigrationPlan } from '@/utils/storage';
import { handleStartMigrationScan, handleConfirmMigration, handleCancelMigration, handleStartRollback, handleRegenerateStats, migrationLogger } from './migration';
import { importEngine } from './importer/engine';
import { getImportSession } from './importer/session';



console.log('[LeetSync] Background service worker loaded');

/**
 * Initialize settings on install & validate token on startup.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[LeetSync] Extension installed — initializing settings');
    await chrome.storage.local.set({ [StorageKey.SETTINGS]: DEFAULT_SETTINGS });
    await chrome.storage.local.set({ [StorageKey.RECENT_SYNCS]: [] });
    await chrome.storage.local.set({ [StorageKey.SUBMISSION_HASHES]: [] });
  }

  // Set up the retry alarm for the offline queue
  chrome.alarms.create(RETRY_ALARM_NAME, {
    periodInMinutes: RETRY_INTERVAL_MINUTES,
  });

  // MV3 Watchdog: checks every 30 seconds for stuck in_progress items
  // (service worker may have been killed mid-commit by Chrome)
  chrome.alarms.create('sync-queue-watchdog', {
    periodInMinutes: 0.5, // 30 seconds
  });

  // Validate stored token on startup
  validateStoredToken();
});

/**
 * Auto-resume background import execution if service worker reloaded mid-import.
 */
(async () => {
  try {
    const activeSession = await getImportSession();
    if (activeSession && activeSession.status === 'uploading') {
      console.log('[LeetSync] Service worker loaded mid-import — auto-resuming background import loop');
      importEngine.executeImport();
    }
  } catch (err) {
    console.warn('[LeetSync] Error checking active import session on startup:', err);
  }
})();

/**
 * Handle messages from content scripts and popup.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case MessageType.SUBMISSION_DETECTED:
      handleSubmissionDetected(payload).then(sendResponse);
      return true;

    case MessageType.GET_SETTINGS:
      storageGetSettings().then(sendResponse);
      return true;

    case MessageType.UPDATE_SETTINGS:
      storageUpdateSettings(payload).then(sendResponse);
      return true;

    case MessageType.GET_AUTH_STATUS:
      getAuthStatus().then(sendResponse);
      return true;

    case MessageType.LOGIN_OAUTH:
      loginWithOAuth().then(sendResponse);
      return true;

    case MessageType.LOGIN_PAT:
      loginWithPAT(payload.token).then(sendResponse);
      return true;

    case MessageType.LOGOUT:
      handleLogout().then(sendResponse);
      return true;

    case MessageType.LIST_REPOS:
      handleListRepos().then(sendResponse);
      return true;

    case MessageType.CREATE_REPO:
      handleCreateRepo(payload).then(sendResponse);
      return true;

    case MessageType.SELECT_REPO:
      handleSelectRepo(payload).then(sendResponse);
      return true;

    case MessageType.GET_RECENT_SYNCS:
      getRecentSyncs().then(sendResponse);
      return true;

    case MessageType.GET_QUEUE_STATUS:
      getQueueStats().then(sendResponse);
      return true;

    case 'CONFLICT_RESOLVED':
      // Popup resolved a naming conflict — resume the paused sync job
      handleConflictResolved(payload).then(sendResponse);
      return true;

    case 'SOLUTION_MUTATION':
      // Popup requested a rename / delete / set-default operation
      handleSolutionMutation(payload).then(sendResponse);
      return true;

    // ─── Migration Messages ─────────────────────────────────────

    case MessageType.START_MIGRATION_SCAN:
      handleStartMigrationScan(payload?.sessionId || 'default_session').then(sendResponse);
      return true;

    case MessageType.GET_MIGRATION_PLAN:
      getMigrationPlan().then((plan) => sendResponse({ plan }));
      return true;

    case MessageType.CONFIRM_MIGRATION:
      handleConfirmMigration(payload?.sessionId || 'default_session', payload?.plan).then(sendResponse);
      return true;

    case MessageType.CANCEL_MIGRATION:
      handleCancelMigration(payload?.sessionId || 'default_session').then(sendResponse);
      return true;

    case MessageType.START_ROLLBACK:
      handleStartRollback().then(sendResponse);
      return true;

    case MessageType.EXPORT_MIGRATION_LOG:
      migrationLogger.exportLogs().then((logs) => sendResponse({ logs }));
      return true;

    case MessageType.REGENERATE_STATS:
      handleRegenerateStats().then(sendResponse);
      return true;

    // ─── Importer Message Types ─────────────────────────────────

    case MessageType.CHECK_IMPORT_CAPABILITY:
      importEngine.runCapabilityCheck().then(sendResponse);
      return true;

    case MessageType.START_PROFILE_DISCOVERY:
      importEngine.discoverProfile().then((profile) => sendResponse({ profile }));
      return true;

    case MessageType.START_SUBMISSION_DISCOVERY:
      importEngine.startDiscovery(payload?.strategy).then((session) => sendResponse({ session }));
      return true;

    case MessageType.START_HISTORICAL_IMPORT:
      importEngine.executeImport().then((report) => sendResponse({ report }));
      return true;

    case MessageType.PAUSE_IMPORT:
    case MessageType.CANCEL_IMPORT:
      importEngine.cancel();
      sendResponse({ success: true });
      return true;

    case MessageType.GET_IMPORT_SESSION:
      getImportSession().then((session) => sendResponse({ session }));
      return true;


    default:
      console.warn(`[LeetSync] Unknown message type: ${type}`);
      sendResponse({ error: `Unknown message type: ${type}` });
      return false;
  }
});


/**
 * Handle retry alarm for offline queue.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM_NAME) {
    console.log('[LeetSync] Retry alarm fired — processing offline queue');
    processRetryQueue();
  }

  if (alarm.name === 'sync-queue-watchdog') {
    // Detect items stuck in `in_progress` (service worker was killed mid-commit)
    // Reset them to `pending` so they are retried on next alarm cycle
    resetStuckItems().then((count) => {
      if (count > 0) {
        console.warn(`[LeetSync Watchdog] Reset ${count} stuck queue item(s) to pending.`);
        processRetryQueue(); // Immediately retry the recovered items
      }
    });
  }
});

// ─── Handler implementations ────────────────────────────────────

async function handleSubmissionDetected(
  payload: LeetCodeSubmission
): Promise<{ success: boolean; error?: string }> {
  console.log('[LeetSync] Submission detected:', payload.title, payload.status);

  const settings = await storageGetSettings();
  if (!settings.autoSync) {
    console.log('[LeetSync] Auto-sync is disabled, skipping');
    return { success: true };
  }

  return syncSubmission(payload);
}

/**
 * Store the conflict resolution from the popup so the sync engine can retrieve it.
 * The sync engine is waiting in a Promise that polls chrome.storage.local.
 */
async function handleConflictResolved(
  payload: any
): Promise<{ success: boolean }> {
  await chrome.storage.local.set({ LEETSYNC_CONFLICT_RESOLUTION: payload });
  console.log('[LeetSync] Conflict resolution received:', payload);
  return { success: true };
}

/**
 * Route solution management mutations (rename/delete/set-default) to solution-manager.ts.
 * Currently stubbed — will be wired to the full implementation in the next iteration.
 */
async function handleSolutionMutation(
  payload: any
): Promise<{ success: boolean; error?: string }> {
  // TODO: Load manifest, call solution-manager, push updated manifest
  console.log('[LeetSync] Solution mutation requested:', payload);
  return { success: true };
}

async function getAuthStatus(): Promise<{
  authenticated: boolean;
  username: string | null;
  avatarUrl: string | null;
}> {
  const settings = await storageGetSettings();
  return {
    authenticated: !!settings.githubToken,
    username: settings.githubUsername,
    avatarUrl: settings.githubAvatarUrl,
  };
}

async function handleLogout(): Promise<{ success: boolean }> {
  await authLogout();
  return { success: true };
}

async function handleListRepos(): Promise<{ repos: any[]; error?: string }> {
  try {
    const settings = await storageGetSettings();
    if (!settings.githubToken) {
      return { repos: [], error: 'Not authenticated' };
    }
    const repos = await githubApi.listRepos(settings.githubToken, { sort: 'updated', perPage: 50 });
    return { repos };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list repos';
    return { repos: [], error: message };
  }
}

async function handleCreateRepo(
  payload: { name: string; isPrivate?: boolean }
): Promise<{ success: boolean; error?: string }> {
  let targetName = (payload.name || DEFAULT_REPO_NAME).trim();
  if (targetName.includes('/')) {
    targetName = targetName.split('/')[1];
  }
  if (!targetName) targetName = DEFAULT_REPO_NAME;

  try {
    const settings = await storageGetSettings();
    if (!settings.githubToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const repo = await githubApi.createRepo(settings.githubToken, targetName, {
        description: DEFAULT_REPO_DESCRIPTION,
        isPrivate: payload.isPrivate ?? false,
        autoInit: true,
      });

      // Auto-select the newly created repo
      await storageUpdateSettings({
        repoOwner: repo.owner.login,
        repoName: repo.name,
      });

      console.log(`[LeetSync] Created repo: ${repo.full_name}`);
      return { success: true };
    } catch (createErr: any) {
      // If repo already exists on GitHub (422 error), attempt to get and select it
      const username = settings.githubUsername;
      if (username) {
        try {
          const existingRepo = await githubApi.getRepo(settings.githubToken, username, targetName);
          await storageUpdateSettings({
            repoOwner: existingRepo.owner.login,
            repoName: existingRepo.name,
          });
          console.log(`[LeetSync] Selected existing repo: ${existingRepo.full_name}`);
          return { success: true };
        } catch {
          // If fetch fails too, throw original creation error
        }
      }
      throw createErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create repo';
    console.error('[LeetSync] Create repo error:', err);
    return { success: false, error: message };
  }
}


async function handleSelectRepo(
  payload: { owner: string; name: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload || !payload.owner || !payload.name) {
      return { success: false, error: 'Invalid repository selection details' };
    }
    await storageUpdateSettings({ repoOwner: payload.owner, repoName: payload.name });
    console.log(`[LeetSync] Repository selected: ${payload.owner}/${payload.name}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to select repository';
    return { success: false, error: message };
  }
}

async function getRecentSyncs(): Promise<unknown[]> {
  const result = await chrome.storage.local.get(StorageKey.RECENT_SYNCS);
  return result[StorageKey.RECENT_SYNCS] ?? [];
}

/**
 * Process the offline retry queue.
 * Called periodically by the chrome.alarms API.
 */
async function processRetryQueue(): Promise<void> {
  const pendingItems = await getPendingItems();

  if (pendingItems.length === 0) {
    return;
  }

  console.log(`[LeetSync] Processing ${pendingItems.length} queued item(s)`);

  for (const item of pendingItems) {
    try {
      await markInProgress(item.id);
      const result = await syncSubmission(item.submission);

      if (result.success) {
        await markComplete(item.id);
      } else {
        await markFailed(item.id, result.error ?? 'Sync failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await markFailed(item.id, message);
    }
  }
}
