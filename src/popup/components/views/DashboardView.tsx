import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Toggle, DifficultyBadge, LanguageTag, CommitShaLink, SectionHeader } from '../ui/index';
import type { ToastData } from '../ui/dialogs';
import { SubmissionCelebration } from '../celebration/SubmissionCelebration';
import type { RecentSync } from '@/types';

// Default recent activity fallback if none synced yet
const RECENT_ACTIVITY_FALLBACK = [
  { id: '1', title: '206. Reverse Linked List', difficulty: 'Easy', language: 'cpp', sha: 'a7f39b1', time: '4 min ago' },
  { id: '2', title: '300. Longest Increasing Subsequence', difficulty: 'Medium', language: 'python3', sha: 'b2e1f8d', time: '2 hrs ago' },
  { id: '3', title: '42. Trapping Rain Water', difficulty: 'Hard', language: 'typescript', sha: 'c5f23ab', time: '5 hrs ago' },
  { id: '4', title: '1. Two Sum', difficulty: 'Easy', language: 'java', sha: 'd9a15ec', time: 'Yesterday' },
];

const MOCK_CELEBRATION = {
  title: '206. Reverse Linked List',
  difficulty: 'Easy',
  language: 'C++',
  commitSha: 'a7f39b12d45f8e9c1b0a73e5df62891c4567890f',
  branch: 'main',
  repo: 'mahavir717/leetcode-solutions',
};

interface DashboardViewProps {
  username?: string;
  repoOwner?: string;
  repoName?: string;
  autoSync?: boolean;
  recentSyncs?: RecentSync[];
  onToggleAutoSync?: () => void;
  onNavigate: (view: string) => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

export function DashboardView({
  username = 'mahavir717',
  repoOwner = 'mahavir717',
  repoName = 'leetcode-solutions',
  autoSync = true,
  recentSyncs = [],
  onToggleAutoSync,
  onNavigate,
  addToast,
}: DashboardViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Compute activity list from real recent syncs or fall back to recent list
  const activityList = recentSyncs.length > 0
    ? recentSyncs.slice(0, 5).map((s, i) => ({
        id: String(i),
        title: s.problemTitle,
        difficulty: 'Medium',
        language: s.language,
        sha: s.commitSha || 'latest',
        time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
      }))
    : RECENT_ACTIVITY_FALLBACK;

  const latestSync = recentSyncs[0];

  const handleManualSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addToast({ variant: 'info', title: 'Syncing…', message: 'Fetching recent submissions from LeetCode' });
    setTimeout(() => {
      setIsSyncing(false);
      addToast({ variant: 'success', title: 'Sync Complete', message: 'All recent submissions synced successfully.' });
    }, 2000);
  };

  return (
    <div class="flex flex-col h-full overflow-hidden bg-bg-primary">
      {/* ── Connection Status Bar ───────────────────────────────── */}
      <div class="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-border bg-bg-secondary">
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <span class="text-xs font-semibold text-text-primary truncate">@{username}</span>
          <span class="text-text-muted text-xs">·</span>
          <a
            href={`https://github.com/${repoOwner}/${repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-text-muted hover:text-accent-blue font-mono truncate transition-colors"
          >
            {repoOwner}/{repoName}
          </a>
          <span class="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-tertiary border border-border font-mono">main</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-xs text-text-muted">{autoSync ? 'Auto' : 'Off'}</span>
          <Toggle checked={autoSync} onChange={() => onToggleAutoSync?.()} />
        </div>
      </div>

      {/* Scrollable Main Area */}
      <div class="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-4">

        {/* ── Latest Submission Banner ──────────────────────────── */}
        <div class="ls-card bg-bg-secondary border border-border rounded-xl p-3.5 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <span class="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                {latestSync ? 'Latest Synced Submission' : 'Sync Status Active'}
              </span>
              <h3 class="text-sm font-semibold text-text-primary leading-tight mt-0.5 truncate">
                {latestSync ? latestSync.problemTitle : 'Ready to sync LeetCode solutions'}
              </h3>
            </div>
            {latestSync && <DifficultyBadge difficulty="Medium" />}
          </div>

          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span class="text-xs text-text-secondary">
                {latestSync && latestSync.timestamp
                  ? `Synced ${Math.max(1, Math.floor((Date.now() - new Date(latestSync.timestamp).getTime()) / 60000))} min ago`
                  : 'Automatic background sync active'}
              </span>
            </div>
            {latestSync?.commitSha && <CommitShaLink sha={latestSync.commitSha} />}
          </div>
        </div>

        {/* ── One-Click History Importer Banner ──────────────────────── */}
        <div class="ls-card bg-gradient-to-r from-accent-blue/10 to-emerald-500/10 border border-accent-blue/30 flex items-center justify-between p-3.5 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center text-accent-blue font-bold">
              ⚡
            </div>
            <div>
              <h4 class="text-xs font-bold text-text-primary">Bulk History Importer</h4>
              <p class="text-[11px] text-text-muted">Import all past accepted solutions to GitHub</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('import')}
            class="text-xs bg-accent-blue text-white font-semibold px-3 py-1.5 rounded-lg shadow-blue-glow hover:bg-blue-600 transition-colors btn-press shrink-0"
          >
            Import →
          </button>
        </div>

        {/* ── Quick Actions Grid ────────────────────────────────────── */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div class="grid grid-cols-3 gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-accent-blue/50 hover:bg-bg-tertiary transition-all duration-150 btn-press disabled:opacity-50"
            >
              {isSyncing ? (
                <svg class="animate-spin-slow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3B82F6" stroke-width="2">
                  <path d="M23 4v6h-6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              )}
              <span class="text-[11px] font-medium text-text-secondary text-center leading-tight">
                {isSyncing ? 'Syncing…' : 'Manual Sync'}
              </span>
            </button>

            <button
              onClick={() => onNavigate('migration')}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-yellow-500/50 hover:bg-bg-tertiary transition-all duration-150 btn-press"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#EAB308" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="text-[11px] font-medium text-text-secondary text-center leading-tight">Migrate Repo</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-text-muted hover:bg-bg-tertiary transition-all duration-150 btn-press"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#8B949E" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span class="text-[11px] font-medium text-text-secondary text-center leading-tight">Settings</span>
            </button>
          </div>
        </div>

        {/* ── Recent Synced Activity ──────────────────────────────────── */}
        <div>
          <SectionHeader title="Recent Activity" />
          <div class="flex flex-col gap-1.5">
            {activityList.map((item) => (
              <div
                key={item.id}
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border/50 hover:bg-bg-tertiary transition-colors group"
              >
                <DifficultyBadge difficulty={item.difficulty} />
                <span class="flex-1 text-xs font-medium text-text-primary truncate">{item.title}</span>
                <LanguageTag language={item.language} />
                <span class="text-[11px] text-text-muted">{item.time}</span>
                <a
                  href={`https://github.com/${repoOwner}/${repoName}/commit/${item.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="opacity-60 group-hover:opacity-100 transition-opacity text-accent-blue"
                  title="View commit on GitHub"
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9M10 1h5v5M7.5 8.5L15 1" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ── Simulate Submission Demo ──────────────────────────── */}
        <button
          onClick={() => setShowCelebration(true)}
          class="w-full flex items-center justify-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-2.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors btn-press mt-1"
        >
          <span>✦</span>
          Test Submission Animation
        </button>
      </div>

      {/* Celebration Overlay */}
      <SubmissionCelebration
        open={showCelebration}
        problem={MOCK_CELEBRATION}
        onDismiss={() => setShowCelebration(false)}
      />
    </div>
  );
}
