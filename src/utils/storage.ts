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

/* ─── Migration Storage Wrappers ─── */

import type { MigrationPlan, RollbackPlan, MigrationLogEntry, MigrationLock, ProblemMetadata, MoveStatus } from '@/types';
import { MAX_METADATA_CACHE_AGE_MS } from './constants';

export async function getMigrationPlan(): Promise<MigrationPlan | null> {
  const result = await chrome.storage.local.get(StorageKey.MIGRATION_PLAN);
  return result[StorageKey.MIGRATION_PLAN] ?? null;
}

export async function saveMigrationPlan(plan: MigrationPlan): Promise<void> {
  await chrome.storage.local.set({ [StorageKey.MIGRATION_PLAN]: plan });
}

export async function clearMigrationPlan(): Promise<void> {
  await chrome.storage.local.remove(StorageKey.MIGRATION_PLAN as string);
}

export async function updateMoveStatus(moveId: string, status: MoveStatus, error?: string): Promise<void> {
  const plan = await getMigrationPlan();
  if (!plan) return;
  const move = plan.moves.find((m) => m.id === moveId);
  if (move) {
    move.status = status;
    if (error) move.error = error;
    plan.lastUpdatedAt = new Date().toISOString();
    await saveMigrationPlan(plan);
  }
}

export async function getRollbackPlan(): Promise<RollbackPlan | null> {
  const result = await chrome.storage.local.get(StorageKey.ROLLBACK_PLAN);
  return result[StorageKey.ROLLBACK_PLAN] ?? null;
}

export async function saveRollbackPlan(plan: RollbackPlan): Promise<void> {
  await chrome.storage.local.set({ [StorageKey.ROLLBACK_PLAN]: plan });
}

export async function clearRollbackPlan(): Promise<void> {
  await chrome.storage.local.remove(StorageKey.ROLLBACK_PLAN as string);
}

export async function getMigrationLog(): Promise<MigrationLogEntry[]> {
  const result = await chrome.storage.local.get(StorageKey.MIGRATION_LOG);
  return result[StorageKey.MIGRATION_LOG] ?? [];
}

export async function appendMigrationLog(entries: MigrationLogEntry[]): Promise<void> {
  const current = await getMigrationLog();
  const updated = [...current, ...entries].slice(-2000); // keep last 2000
  await chrome.storage.local.set({ [StorageKey.MIGRATION_LOG]: updated });
}

export async function clearMigrationLog(): Promise<void> {
  await chrome.storage.local.remove(StorageKey.MIGRATION_LOG as string);
}

export async function getMetadataCache(): Promise<Record<string, ProblemMetadata>> {
  const result = await chrome.storage.local.get(StorageKey.METADATA_CACHE);
  return result[StorageKey.METADATA_CACHE] ?? {};
}

export async function getCachedMetadata(slug: string): Promise<ProblemMetadata | null> {
  const cache = await getMetadataCache();
  const entry = cache[slug];
  if (!entry) return null;

  if (entry.cachedAt) {
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > MAX_METADATA_CACHE_AGE_MS) {
      return null; // Expired
    }
  }

  return entry;
}

export async function setMetadataCache(slug: string, metadata: ProblemMetadata): Promise<void> {
  const cache = await getMetadataCache();
  cache[slug] = {
    ...metadata,
    cachedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [StorageKey.METADATA_CACHE]: cache });
}

export async function getMigrationLock(): Promise<MigrationLock | null> {
  const result = await chrome.storage.local.get(StorageKey.MIGRATION_LOCK);
  return result[StorageKey.MIGRATION_LOCK] ?? null;
}

export async function saveMigrationLock(lock: MigrationLock): Promise<void> {
  await chrome.storage.local.set({ [StorageKey.MIGRATION_LOCK]: lock });
}

export async function clearMigrationLock(): Promise<void> {
  await chrome.storage.local.remove(StorageKey.MIGRATION_LOCK as string);
}


