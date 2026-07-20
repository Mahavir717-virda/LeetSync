/**
 * Chrome storage helpers — typed wrappers around chrome.storage.local.
 */

import { StorageKey } from './constants';
import type { LeetSyncSettings, RecentSync } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

/**
 * Get current settings from chrome.storage.local.
 */
export async function getSettings(): Promise<LeetSyncSettings> {
  const result = await chrome.storage.local.get(StorageKey.SETTINGS);
  return result[StorageKey.SETTINGS] ?? DEFAULT_SETTINGS;
}

/**
 * Update settings (partial merge).
 */
export async function updateSettings(updates: Partial<LeetSyncSettings>): Promise<LeetSyncSettings> {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await chrome.storage.local.set({ [StorageKey.SETTINGS]: merged });
  return merged;
}

/**
 * Get recent syncs list.
 */
export async function getRecentSyncs(): Promise<RecentSync[]> {
  const result = await chrome.storage.local.get(StorageKey.RECENT_SYNCS);
  return result[StorageKey.RECENT_SYNCS] ?? [];
}

/**
 * Add a new recent sync entry (keeps last 20).
 */
export async function addRecentSync(sync: RecentSync): Promise<void> {
  const current = await getRecentSyncs();
  const updated = [sync, ...current].slice(0, 20);
  await chrome.storage.local.set({ [StorageKey.RECENT_SYNCS]: updated });
}

/**
 * Get submission hashes (for deduplication).
 */
export async function getSubmissionHashes(): Promise<string[]> {
  const result = await chrome.storage.local.get(StorageKey.SUBMISSION_HASHES);
  return result[StorageKey.SUBMISSION_HASHES] ?? [];
}

/**
 * Add a submission hash.
 */
export async function addSubmissionHash(hash: string): Promise<void> {
  const current = await getSubmissionHashes();
  if (current.includes(hash)) return;
  // Keep last 1000 hashes to prevent unbounded growth
  const updated = [hash, ...current].slice(0, 1000);
  await chrome.storage.local.set({ [StorageKey.SUBMISSION_HASHES]: updated });
}

/**
 * Check if a submission hash already exists.
 */
export async function hasSubmissionHash(hash: string): Promise<boolean> {
  const hashes = await getSubmissionHashes();
  return hashes.includes(hash);
}
