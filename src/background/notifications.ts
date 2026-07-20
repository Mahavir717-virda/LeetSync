/**
 * Desktop Notifications Module
 *
 * Shows Chrome desktop notifications for sync events.
 */

import { getSettings } from '@/utils/storage';

/**
 * Show a success notification when a submission is synced.
 */
export async function notifySyncSuccess(
  problemTitle: string,
  version: number,
  language: string,
  runtime: string
): Promise<void> {
  const settings = await getSettings();
  if (!settings.notifications) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: '✅ LeetSync — Synced!',
    message: `${problemTitle}: v${version} (${language}, ${runtime})`,
    priority: 1,
  });
}

/**
 * Show a failure notification when sync fails.
 */
export async function notifySyncFailure(
  problemTitle: string,
  error: string
): Promise<void> {
  const settings = await getSettings();
  if (!settings.notifications) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: '❌ LeetSync — Sync Failed',
    message: `${problemTitle}: ${error}`,
    priority: 2,
  });
}

/**
 * Show a warning notification (e.g., schema change detected).
 */
export async function notifyWarning(message: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.notifications) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: '⚠️ LeetSync — Warning',
    message,
    priority: 1,
  });
}
