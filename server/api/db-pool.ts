/**
 * Neo4j Database Connection Pool — Singleton
 *
 * Provides a single, shared Neo4j driver instance for the entire server process.
 * Creating a new driver per-request is strictly forbidden — it exhausts TCP connections.
 *
 * Configuration targets 100+ concurrent users with safe connection acquisition
 * timeouts and automatic stale connection recycling.
 */

import neo4j, { Driver, Session, ManagedTransaction } from 'neo4j-driver';

// ─── Environment Config ────────────────────────────────────────────────────────

const NEO4J_URI      = process.env.NEO4J_URI      ?? 'bolt://localhost:7687';
const NEO4J_USER     = process.env.NEO4J_USER     ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'password';

// ─── Singleton Driver ──────────────────────────────────────────────────────────

let _driver: Driver | null = null;

/**
 * Get the singleton Neo4j driver, creating it on first call.
 *
 * Pool configuration rationale:
 *  - maxConnectionPoolSize: 100 — supports 100+ concurrent users each needing
 *    one connection. If all 100 fire simultaneously, no request is queued more
 *    than connectionAcquisitionTimeout ms.
 *  - connectionAcquisitionTimeout: 5_000 — fail fast instead of queuing forever.
 *    Returns a ServiceUnavailable error which the withRetry wrapper can catch.
 *  - maxConnectionLifetime: 3_600_000 (1 hour) — recycles stale connections
 *    before the OS or Neo4j server closes them from underneath.
 *  - connectionTimeout: 10_000 — TCP handshake timeout; prevents hanging on
 *    network partitions.
 */
export function getDriver(): Driver {
  if (!_driver) {
    _driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        maxConnectionPoolSize:       100,
        connectionAcquisitionTimeout: 5_000,
        maxConnectionLifetime:       3_600_000,
        connectionTimeout:           10_000,
        // Disable auto-encryption for local dev; enable for production (bolt+s://)
        encrypted: NEO4J_URI.startsWith('bolt+s') || NEO4J_URI.startsWith('neo4j+s'),
        logging: {
          level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
          logger: (level, message) => {
            if (level === 'error') console.error('[Neo4j]', message);
            else if (level === 'warn') console.warn('[Neo4j]', message);
          },
        },
      }
    );

    // Verify connectivity immediately so startup fails loud instead of
    // silently failing on the first user request
    _driver.verifyConnectivity().catch((err) => {
      console.error('[Neo4j] Failed to connect to database:', err.message);
      _driver = null;
    });
  }
  return _driver;
}

/**
 * Open a new session for a database operation.
 * Always call session.close() in a finally block to return the connection
 * to the pool immediately after use.
 *
 * @param database Optional database name (defaults to Neo4j default db)
 */
export function openSession(database?: string): Session {
  return getDriver().session({
    database: database ?? process.env.NEO4J_DATABASE ?? 'neo4j',
  });
}

// ─── Retry Wrapper ─────────────────────────────────────────────────────────────

const RETRIABLE_CODES = new Set([
  'ServiceUnavailable',
  'SessionExpired',
  'Neo.TransientError.General.MemoryPoolOutOfMemoryError',
  'Neo.TransientError.Network.CommunicationError',
]);

/**
 * Execute a transactional function with automatic retry on transient errors.
 *
 * @param work     Async function receiving a ManagedTransaction
 * @param maxRetries  Maximum retry attempts (default 3)
 * @returns The result of `work`
 *
 * Usage:
 *   const result = await withRetry((tx) => tx.run('MATCH (n) RETURN n LIMIT 1'));
 */
export async function withRetry<T>(
  work: (tx: ManagedTransaction) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = openSession();
    try {
      return await session.executeWrite(work);
    } catch (err: any) {
      lastError = err;
      const isRetriable = RETRIABLE_CODES.has(err.code) || err.retriable === true;

      if (!isRetriable || attempt === maxRetries) {
        throw err;
      }

      const backoffMs = Math.min(100 * 2 ** attempt + Math.random() * 100, 3000);
      console.warn(`[Neo4j] Transient error on attempt ${attempt}, retrying in ${backoffMs.toFixed(0)}ms:`, err.message);
      await sleep(backoffMs);
    } finally {
      await session.close();
    }
  }

  throw lastError;
}

/**
 * Read-only query wrapper with retry support.
 * Use for MATCH queries that do not modify data.
 */
export async function withReadRetry<T>(
  work: (tx: ManagedTransaction) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = openSession();
    try {
      return await session.executeRead(work);
    } catch (err: any) {
      lastError = err;
      const isRetriable = RETRIABLE_CODES.has(err.code) || err.retriable === true;
      if (!isRetriable || attempt === maxRetries) throw err;
      const backoffMs = Math.min(100 * 2 ** attempt + Math.random() * 100, 3000);
      await sleep(backoffMs);
    } finally {
      await session.close();
    }
  }

  throw lastError;
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

/**
 * Close the Neo4j driver on process exit.
 * Call this in your server shutdown handler (SIGTERM, SIGINT).
 */
export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
    console.info('[Neo4j] Driver closed gracefully.');
  }
}

process.on('SIGTERM', () => closeDriver());
process.on('SIGINT',  () => closeDriver());

// ─── Internal ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
