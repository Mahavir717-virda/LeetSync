import type { ImportSession, ImportActionItem } from '@/types';
import { StorageKey } from '@/utils/constants';

const IMPORT_SESSION_KEY = 'leetsync_import_session';

/**
 * Load the active import session checkpoint from chrome.storage.local.
 */
export async function getImportSession(): Promise<ImportSession | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(IMPORT_SESSION_KEY);
    return result[IMPORT_SESSION_KEY] ?? null;
  }
  return null;
}

/**
 * Save / checkpoint the current import session state.
 */
export async function saveImportSession(session: ImportSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [IMPORT_SESSION_KEY]: session });
  }
}

/**
 * Clear the current import session (upon completion or user cancel).
 */
export async function clearImportSession(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove(IMPORT_SESSION_KEY);
  }
}

/**
 * Helper to construct a fresh ImportSession object.
 */
export function createNewSession(duplicateStrategy: ImportSession['duplicateStrategy'] = 'replace'): ImportSession {
  return {
    id: `import_${Date.now()}`,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalDiscovered: 0,
    currentIndex: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    status: 'idle',
    duplicateStrategy,
    actions: [],
  };
}
