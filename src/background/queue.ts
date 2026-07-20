/**
 * IndexedDB-backed Offline Queue
 *
 * Stores submissions that failed to sync (network error, rate limit, etc.)
 * and retries them with exponential backoff.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { LeetCodeSubmission, SyncQueueItem } from '@/types';
import { MAX_RETRY_COUNT } from '@/utils/constants';

const DB_NAME = 'leetsync-queue';
const DB_VERSION = 1;
const STORE_NAME = 'submissions';

/**
 * Open (or create) the IndexedDB database.
 */
async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('nextRetryAt', 'nextRetryAt');
      }
    },
  });
}

/**
 * Add a submission to the retry queue.
 */
export async function addToQueue(submission: LeetCodeSubmission): Promise<void> {
  const db = await getDb();
  const id = `queue_${submission.submissionId}_${Date.now()}`;

  const item: SyncQueueItem = {
    id,
    submission,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(), // Retry immediately on next cycle
    createdAt: Date.now(),
  };

  await db.put(STORE_NAME, item);
  console.log(`[LeetSync Queue] Added to queue: ${submission.title} (${id})`);
}

/**
 * Get all pending items that are ready to retry.
 */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  const allItems = await db.getAll(STORE_NAME);

  return allItems
    .filter(
      (item: SyncQueueItem) =>
        (item.status === 'pending' || item.status === 'failed') &&
        item.nextRetryAt <= Date.now() &&
        item.retryCount < MAX_RETRY_COUNT
    )
    .sort((a: SyncQueueItem, b: SyncQueueItem) => a.createdAt - b.createdAt);
}

/**
 * Mark an item as in-progress.
 */
export async function markInProgress(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get(STORE_NAME, id);
  if (item) {
    item.status = 'in_progress';
    await db.put(STORE_NAME, item);
  }
}

/**
 * Mark an item as failed with exponential backoff.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDb();
  const item = await db.get(STORE_NAME, id);
  if (item) {
    item.retryCount += 1;
    item.lastError = error;

    if (item.retryCount >= MAX_RETRY_COUNT) {
      // Move to dead letter queue
      item.status = 'dead_letter';
      console.warn(`[LeetSync Queue] Item moved to dead letter: ${id} (${item.retryCount} retries)`);
    } else {
      // Exponential backoff: 1min, 2min, 4min, 8min, ..., max 60min
      const backoffMs = Math.min(
        60 * 60 * 1000, // max 1 hour
        (Math.pow(2, item.retryCount) * 60 * 1000)
      );
      item.status = 'failed';
      item.nextRetryAt = Date.now() + backoffMs;
      console.log(`[LeetSync Queue] Retry scheduled in ${backoffMs / 1000}s for: ${id}`);
    }

    await db.put(STORE_NAME, item);
  }
}

/**
 * Mark an item as successfully synced (remove from queue).
 */
export async function markComplete(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
  console.log(`[LeetSync Queue] Completed and removed: ${id}`);
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  inProgress: number;
  failed: number;
  deadLetter: number;
}> {
  const db = await getDb();
  const allItems = await db.getAll(STORE_NAME);

  return {
    pending: allItems.filter((i: SyncQueueItem) => i.status === 'pending').length,
    inProgress: allItems.filter((i: SyncQueueItem) => i.status === 'in_progress').length,
    failed: allItems.filter((i: SyncQueueItem) => i.status === 'failed').length,
    deadLetter: allItems.filter((i: SyncQueueItem) => i.status === 'dead_letter').length,
  };
}

/**
 * Get dead letter items (for user review).
 */
export async function getDeadLetterItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  const allItems = await db.getAll(STORE_NAME);
  return allItems.filter((i: SyncQueueItem) => i.status === 'dead_letter');
}

/**
 * Clear all dead letter items.
 */
export async function clearDeadLetter(): Promise<void> {
  const db = await getDb();
  const deadItems = await getDeadLetterItems();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const item of deadItems) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}
