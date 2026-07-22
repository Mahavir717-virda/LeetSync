/**
 * Phase 7 — Telemetry Logger
 */

import { appendMigrationLog, getMigrationLog, clearMigrationLog } from '@/utils/storage';
import type { MigrationLogEntry } from '@/types';

export class MigrationLogger {
  private buffer: MigrationLogEntry[] = [];

  log(level: 'info' | 'warn' | 'error' | 'debug', phase: string, message: string, data?: Record<string, unknown>): void {
    const entry: MigrationLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      phase,
      message,
      data,
    };
    this.buffer.push(entry);
    console.log(`[LeetSync Migration][${level.toUpperCase()}][${phase}] ${message}`, data || '');
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const toSave = [...this.buffer];
    this.buffer = [];
    await appendMigrationLog(toSave);
  }

  async exportLogs(): Promise<string> {
    await this.flush();
    const logs = await getMigrationLog();
    return JSON.stringify(logs, null, 2);
  }

  async clear(): Promise<void> {
    this.buffer = [];
    await clearMigrationLog();
  }
}

export const migrationLogger = new MigrationLogger();
