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
import { getPendingItems, markInProgress, markComplete, markFailed, getQueueStats } from './queue';
import { getSettings as storageGetSettings, updateSettings as storageUpdateSettings } from '@/utils/storage';

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

  // Validate stored token on startup
  validateStoredToken();
});

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
  payload: { name: string; isPrivate: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await storageGetSettings();
    if (!settings.githubToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const repo = await githubApi.createRepo(settings.githubToken, payload.name ?? DEFAULT_REPO_NAME, {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create repo';
    console.error('[LeetSync] Create repo error:', err);
    return { success: false, error: message };
  }
}

async function handleSelectRepo(
  payload: { owner: string; name: string }
): Promise<{ success: boolean }> {
  await storageUpdateSettings({ repoOwner: payload.owner, repoName: payload.name });
  return { success: true };
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
