import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { MessageType, StorageKey } from '@/utils/constants';
import type { MigrationLogEntry } from '@/types';
import { LogViewer } from '../ui/dialogs';
import { EmptyState } from '../ui/index';
import type { LogLine } from '../ui/dialogs';

/** Helper to send messages to background script */
function sendMessage<T = any>(type: MessageType | string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } else {
      resolve({} as T);
    }
  });
}

// ─── Initial Fallback Sample Logs ─────────────────────────────────────────────

let logId = 100;
function seedLog(level: LogLine['level'], source: string, message: string, detail?: string): LogLine {
  const hours   = Math.floor(Math.random() * 4) + 13;
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  const time = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  return { id: String(++logId), time, level, source, message, detail };
}

const INITIAL_FALLBACK_LOGS: LogLine[] = [
  seedLog('INFO', 'Extension',  'LeetSync background service worker loaded.'),
  seedLog('INFO', 'Auth',       'Validating stored GitHub token...'),
  seedLog('OK',   'Auth',       'Token valid. User: mahavir717'),
  seedLog('INFO', 'SyncEngine', 'Detected LeetCode submission: 206. Reverse Linked List'),
  seedLog('INFO', 'SyncEngine', 'Pushing solution file: Array/Easy/0206-reverse-linked-list/cpp/'),
  seedLog('OK',   'GitHub',     'File committed. SHA: a7f39b1'),
  seedLog('OK',   'SyncEngine', 'Manifest updated. Problem synced successfully.'),
  seedLog('INFO', 'Queue',      'Queue mutex released. Idle.'),
  seedLog('WARN', 'RateLimit',  'GitHub API usage at 82%. Throttling next requests.'),
  seedLog('INFO', 'SyncEngine', 'Detected LeetCode submission: 300. Longest Increasing Subsequence'),
  seedLog('INFO', 'SyncEngine', 'Pushing solution file: DP/Medium/0300-longest-increasing-subsequence/python/'),
  seedLog('OK',   'GitHub',     'File committed. SHA: b2e1f8d'),
  seedLog('ERR',  'GitHub',     'Non-fast-forward Git error (409). Retrying with latest SHA...', 'Error: POST https://api.github.com/repos/.../git/commits → 409\nMessage: Update is not a fast forward\nStackTrace:\n  at GithubApi.createCommit (github-api.ts:142)\n  at SyncEngine.syncSubmission (sync-engine.ts:87)'),
  seedLog('OK',   'GitHub',     'Retry succeeded with refreshed SHA. Commit: c5f23ab'),
  seedLog('INFO', 'Queue',      'Watchdog alarm fired. 0 stuck items detected.'),
];

type LevelFilter = 'ALL' | 'INFO' | 'OK' | 'WARN' | 'ERR';

interface LogsViewProps {
  onNavigate: (view: string) => void;
}

export function LogsView({ onNavigate }: LogsViewProps) {
  const [rawLogs, setRawLogs] = useState<LogLine[]>(INITIAL_FALLBACK_LOGS);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>('ALL');

  // Convert background MigrationLogEntry to UI LogLine format
  const formatEntries = (entries: MigrationLogEntry[]): LogLine[] => {
    return entries.map((entry, idx) => {
      const d = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const lvl: LogLine['level'] =
        entry.level === 'error' ? 'ERR' :
        entry.level === 'warn'  ? 'WARN' :
        entry.level === 'info' && entry.message.includes('success') ? 'OK' : 'INFO';

      return {
        id: `real_${idx}_${d.getTime()}`,
        time,
        level: lvl,
        source: entry.phase || 'System',
        message: entry.message,
        detail: entry.data ? JSON.stringify(entry.data, null, 2) : undefined,
      };
    });
  };

  // Load real logs on mount
  const loadRealLogs = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(StorageKey.MIGRATION_LOG);
      const stored = result[StorageKey.MIGRATION_LOG] as MigrationLogEntry[] | undefined;
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setRawLogs(formatEntries(stored));
      }
    }
  };

  useEffect(() => {
    loadRealLogs();

    // Listen for storage changes to update log window live in real time
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.leetsync_migration_log?.newValue) {
          const newEntries = changes.leetsync_migration_log.newValue as MigrationLogEntry[];
          if (Array.isArray(newEntries) && newEntries.length > 0) {
            setRawLogs(formatEntries(newEntries));
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  const filtered = useMemo(() => {
    return rawLogs.filter((l) => {
      const matchLevel = level === 'ALL' || l.level === level;
      const matchSearch =
        !search ||
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        l.source.toLowerCase().includes(search.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [rawLogs, search, level]);

  const handleSimulateError = async () => {
    const errLog = seedLog(
      'ERR', 'SyncEngine',
      'GitHub push failed: 422 Unprocessable Entity',
      'Error: PATCH https://api.github.com/repos/mahavir717/leetcode-solutions/git/refs/heads/main → 422\nMessage: Reference cannot be updated\nCause: Concurrent push detected — SHA conflict\n\nResolution: Retry with fresh branch SHA. Check queue.ts acquireLock().'
    );
    setRawLogs((prev) => [...prev, errLog]);

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const newEntry: MigrationLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        phase: 'SyncEngine',
        message: 'GitHub push failed: 422 Unprocessable Entity',
        data: { error: 'Reference cannot be updated', cause: 'Concurrent push detected' },
      };
      const res = await chrome.storage.local.get(StorageKey.MIGRATION_LOG);
      const current = (res[StorageKey.MIGRATION_LOG] as MigrationLogEntry[]) || [];
      await chrome.storage.local.set({ [StorageKey.MIGRATION_LOG]: [...current, newEntry] });
    }
  };

  const handleExport = async () => {
    try {
      const exportRes = await sendMessage<{ logs?: string }>(MessageType.EXPORT_MIGRATION_LOG);
      const dataStr = exportRes?.logs || JSON.stringify(rawLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'leetsync-logs.json'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      const dataStr = JSON.stringify(rawLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'leetsync-logs.json'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleClear = async () => {
    setRawLogs([]);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(StorageKey.MIGRATION_LOG as unknown as string);
    }
  };

  const LEVELS: LevelFilter[] = ['ALL', 'INFO', 'OK', 'WARN', 'ERR'];
  const LEVEL_COLORS: Record<LevelFilter, string> = {
    ALL:  'text-text-secondary border-border',
    INFO: 'text-blue-400 border-blue-500/30',
    OK:   'text-emerald-400 border-emerald-500/30',
    WARN: 'text-yellow-400 border-yellow-500/30',
    ERR:  'text-red-400 border-red-500/30',
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <button onClick={() => onNavigate('dashboard')} class="text-text-muted hover:text-text-primary btn-press p-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-semibold text-text-primary">Log Viewer & Diagnostics</h2>
          <p class="text-xs text-text-muted">{rawLogs.length} total entries</p>
        </div>
        <div class="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSimulateError}
            class="text-xs bg-red-500/5 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors btn-press"
          >
            Simulate Error
          </button>
          <button
            onClick={handleExport}
            class="text-xs text-text-muted border border-border px-2 py-1 rounded-lg hover:bg-bg-tertiary transition-colors btn-press"
          >
            Export
          </button>
          <button
            onClick={handleClear}
            class="text-xs text-text-muted border border-border px-2 py-1 rounded-lg hover:bg-bg-tertiary transition-colors btn-press"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div class="px-4 py-2.5 border-b border-border flex items-center gap-2">
        {/* Search */}
        <div class="relative flex-1">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search log messages or sources..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            class="w-full bg-bg-tertiary border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/60 transition-colors"
          />
        </div>

        {/* Level pills */}
        <div class="flex gap-1 shrink-0">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              class={`text-xs px-2 py-1 rounded-lg border transition-colors btn-press ${
                level === l ? LEVEL_COLORS[l] + ' bg-opacity-10 font-medium' : 'text-text-muted border-border hover:bg-bg-tertiary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Log terminal */}
      <div class="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No logs match your filter"
            description={rawLogs.length === 0 ? 'Start syncing to see activity here.' : 'Try adjusting search or level filters.'}
            action={rawLogs.length === 0 ? undefined : { label: 'Reset filters', onClick: () => { setSearch(''); setLevel('ALL'); } }}
          />
        ) : (
          <LogViewer logs={filtered} />
        )}
      </div>
    </div>
  );
}
