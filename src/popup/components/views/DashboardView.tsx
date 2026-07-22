import { h } from 'preact';
import { useState } from 'preact/hooks';
import { StatusBadge, MetricCard, Toggle, DifficultyBadge, LanguageTag, CommitShaLink, SectionHeader, EmptyState } from '../ui/index';
import type { ToastData } from '../ui/dialogs';
import { SubmissionCelebration } from '../celebration/SubmissionCelebration';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const RECENT_ACTIVITY = [
  { id: '1', title: '206. Reverse Linked List', difficulty: 'Easy',   language: 'cpp',        sha: 'a7f39b1', time: '4 min ago' },
  { id: '2', title: '300. Longest Increasing Sub', difficulty: 'Medium', language: 'python3', sha: 'b2e1f8d', time: '2 hrs ago' },
  { id: '3', title: '42. Trapping Rain Water',   difficulty: 'Hard',   language: 'typescript', sha: 'c5f23ab', time: '5 hrs ago' },
  { id: '4', title: '1. Two Sum',                difficulty: 'Easy',   language: 'java',       sha: 'd9a15ec', time: 'Yesterday' },
];

const HERO_SUBMISSION = {
  title: '206. Reverse Linked List',
  difficulty: 'Easy',
  language: 'C++',
  runtime: '3 ms',
  runtimePercentile: 94.2,
  memory: '42.1 MB',
  memoryPercentile: 78.3,
  sha: 'a7f39b12d45f8e9c1b0a73e5df62891c4567890f',
  synced: '4 minutes ago',
};

const MOCK_CELEBRATION = {
  title: '206. Reverse Linked List',
  difficulty: 'Easy',
  language: 'C++',
  commitSha: 'a7f39b12d45f8e9c1b0a73e5df62891c4567890f',
  branch: 'main',
  repo: 'mahavir717/leetcode-solutions',
};

import type { RecentSync } from '@/types';

interface DashboardViewProps {
  username?: string;
  repoOwner?: string;
  repoName?: string;
  autoSync?: boolean;
  recentSyncs?: RecentSync[];
  streakDays?: number;
  totalSynced?: number;
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
  streakDays = 14,
  totalSynced = 342,
  onToggleAutoSync,
  onNavigate,
  addToast,
}: DashboardViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Compute activity list from real recent syncs or fall back to mock
  const activityList = recentSyncs.length > 0
    ? recentSyncs.slice(0, 4).map((s, i) => ({
        id: String(i),
        title: s.problemTitle,
        difficulty: 'Medium', // default display if metadata not present
        language: s.language,
        sha: s.commitSha || 'latest',
        time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
      }))
    : RECENT_ACTIVITY;

  const latestSync = recentSyncs[0];
  const heroSubmission = latestSync
    ? {
        title: latestSync.problemTitle,
        difficulty: 'Medium',
        language: latestSync.language,
        runtime: latestSync.runtime || 'N/A',
        runtimePercentile: 90,
        memory: 'N/A',
        memoryPercentile: 85,
        sha: latestSync.commitSha || 'a7f39b12d45f8e9c1b0a73e5df62891c4567890f',
        synced: latestSync.timestamp ? `${Math.max(1, Math.floor((Date.now() - new Date(latestSync.timestamp).getTime()) / 60000))} min ago` : '4 min ago',
      }
    : HERO_SUBMISSION;


  const handleManualSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addToast({ variant: 'info', title: 'Syncing…', message: 'Fetching recent submissions from LeetCode' });
    setTimeout(() => {
      setIsSyncing(false);
      addToast({ variant: 'success', title: 'Sync Complete', message: 'All recent submissions synced successfully.' });
    }, 2500);
  };

  const handleSimulateSubmission = () => {
    setShowCelebration(true);
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* ── Connection Status Bar ───────────────────────────────── */}
      <div class="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border">
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span class="text-xs font-medium text-text-primary truncate">@{username}</span>
          <span class="text-text-muted text-xs">·</span>
          <span class="text-xs text-text-muted font-mono truncate">{repoOwner}/{repoName}</span>
          <span class="text-xs text-text-muted px-1 py-0.5 rounded bg-bg-tertiary border border-border font-mono">main</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-xs text-text-muted">{autoSync ? 'Auto' : 'Off'}</span>
          <Toggle checked={autoSync} onChange={() => onToggleAutoSync?.()} />
        </div>
      </div>

      {/* Scrollable content */}
      <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* ── Metrics Row ──────────────────────────────────────── */}
        <div class="grid grid-cols-3 gap-2">
          <MetricCard value={totalSynced} label="Synced" sub="+3 today" trend="up" accent="text-accent-blue" />
          <MetricCard value="99.4%" label="Success" sub="All time" accent="text-emerald-400" />
          <MetricCard value={`${streakDays}🔥`} label="Streak" sub="Days" accent="text-yellow-400" />
        </div>

        {/* ── Recent Submission Hero Card ───────────────────────── */}
        <div class="ls-card">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-muted mb-1">Latest Submission</p>
              <h3 class="text-sm font-semibold text-text-primary leading-tight">{heroSubmission.title}</h3>
            </div>
            <DifficultyBadge difficulty={heroSubmission.difficulty} />
          </div>

          <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="bg-bg-tertiary rounded-lg p-2">
              <p class="text-xs text-text-muted">Runtime</p>
              <p class="text-sm font-semibold text-text-primary">{heroSubmission.runtime}</p>
              <p class="text-xs text-emerald-400">Beats {heroSubmission.runtimePercentile}%</p>
            </div>
            <div class="bg-bg-tertiary rounded-lg p-2">
              <p class="text-xs text-text-muted">Memory</p>
              <p class="text-sm font-semibold text-text-primary">{heroSubmission.memory}</p>
              <p class="text-xs text-text-secondary">Beats {heroSubmission.memoryPercentile}%</p>
            </div>
          </div>

          <div class="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span class="text-xs text-text-secondary">Synced {heroSubmission.synced}</span>
            </div>
            <CommitShaLink sha={heroSubmission.sha} />
          </div>
        </div>

        {/* ── Recent Activity ───────────────────────────────────── */}
        <div>
          <SectionHeader title="Recent Activity" action={
            <button onClick={() => onNavigate('stats')} class="text-xs text-accent-blue hover:underline btn-press">View all</button>
          } />
          <div class="flex flex-col gap-1">
            {activityList.map((item) => (
              <div
                key={item.id}
                class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-tertiary transition-colors cursor-default group"
              >
                <DifficultyBadge difficulty={item.difficulty} />
                <span class="flex-1 text-xs text-text-primary truncate">{item.title}</span>
                <LanguageTag language={item.language} />
                <span class="text-xs text-text-muted">{item.time}</span>
                <a
                  href={`https://github.com/${repoOwner}/${repoName}/commit/${item.sha}`}
                  target="_blank"
                  rel="noopener"
                  class="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue"
                  title="View on GitHub"
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9M10 1h5v5M7.5 8.5L15 1" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ── One-Click History Importer Hero Banner ───────────── */}
        <div class="ls-card bg-gradient-to-r from-accent-blue/10 to-emerald-500/10 border-accent-blue/30 flex items-center justify-between p-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center text-accent-blue">
              ⚡
            </div>
            <div>
              <h4 class="text-xs font-bold text-text-primary">One-Click History Importer</h4>
              <p class="text-[11px] text-text-muted">Import all past LeetCode accepted solutions into GitHub</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('import')}
            class="text-xs bg-accent-blue text-white font-semibold px-3 py-1.5 rounded-lg shadow-blue-glow hover:bg-blue-500 transition-colors btn-press shrink-0"
          >
            Import →
          </button>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────── */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div class="grid grid-cols-3 gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-text-muted hover:bg-bg-tertiary transition-all duration-150 btn-press disabled:opacity-50"
            >
              {isSyncing ? (
                <svg class="animate-spin-slow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3B82F6" stroke-width="2">
                  <path d="M23 4v6h-6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              )}
              <span class="text-xs text-text-secondary text-center leading-tight">{isSyncing ? 'Syncing' : 'Manual Sync'}</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-text-muted hover:bg-bg-tertiary transition-all duration-150 btn-press"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8B949E" stroke-width="2">
                <path d="M3 6h18M7 12h10M10 18h4" stroke-linecap="round"/>
              </svg>
              <span class="text-xs text-text-secondary text-center leading-tight">Folder Config</span>
            </button>

            <button
              onClick={() => onNavigate('logs')}
              class="flex flex-col items-center gap-1.5 bg-bg-secondary border border-border rounded-xl py-3 px-2 hover:border-text-muted hover:bg-bg-tertiary transition-all duration-150 btn-press"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8B949E" stroke-width="2">
                <path d="M4 6h16M4 10h16M4 14h10" stroke-linecap="round"/>
              </svg>
              <span class="text-xs text-text-secondary text-center leading-tight">View Logs</span>
            </button>
          </div>
        </div>

        {/* ── Simulate Submission Demo ──────────────────────────── */}
        <button
          onClick={handleSimulateSubmission}
          class="w-full flex items-center justify-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors btn-press"
        >
          <span>✦</span>
          Simulate LeetCode Submission Sync
        </button>
      </div>

      {/* ── Quick Settings Drawer ─────────────────────────────────── */}
      {settingsOpen && (
        <div class="border-t border-border bg-bg-secondary px-4 py-3 animate-slide-up">
          <p class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Quick Settings</p>
          <div class="flex flex-col gap-3">
            {[
              ['Auto Sync on Submit', true],
              ['Include Problem Description', true],
              ['Include Complexity Analysis', false],
            ].map(([label, val]) => (
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">{label as string}</span>
                <Toggle checked={val as boolean} onChange={() => {}} />
              </div>
            ))}
            <div class="bg-bg-tertiary rounded-lg p-2 mt-1">
              <p class="text-xs text-text-muted mb-1">Folder Preview</p>
              <code class="text-xs text-accent-blue font-mono">/python/0206-reverse-linked-list.py</code>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div class="flex items-center border-t border-border px-4 py-2 gap-1">
        {[
          { key: 'dashboard', icon: '⊞', label: 'Dashboard' },
          { key: 'stats',     icon: '📊', label: 'Stats' },
          { key: 'migration', icon: '⚡', label: 'Migrate' },
          { key: 'logs',      icon: '📋', label: 'Logs' },
          { key: 'settings',  icon: '⚙', label: 'Settings' },
        ].map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            class={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded-lg transition-colors btn-press ${
              key === 'dashboard' ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span class="text-base leading-none">{icon}</span>
            <span class="text-[9px] font-medium">{label}</span>
          </button>
        ))}
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
