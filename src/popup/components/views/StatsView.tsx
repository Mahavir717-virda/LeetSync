import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { MetricCard, DifficultyBadge, LanguageTag, CommitShaLink, SectionHeader, EmptyState } from '../ui/index';
import type { RecentSync } from '@/types';
import { getLanguageName } from '@/utils/filename';

// Fallback sample data if user has 0 syncs yet
const MOCK_HISTORY_ITEMS = [
  { id: '1', title: '206. Reverse Linked List', difficulty: 'Easy',   language: 'cpp',        runtime: '3 ms (94.2%)',  sha: 'a7f39b1', time: '2026-07-22 17:30', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', title: '300. Longest Increasing Sub', difficulty: 'Medium', language: 'python3', runtime: '48 ms (82.1%)', sha: 'b2e1f8d', time: '2026-07-22 15:10', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: '3', title: '42. Trapping Rain Water',   difficulty: 'Hard',   language: 'typescript', runtime: '62 ms (91.0%)', sha: 'c5f23ab', time: '2026-07-22 12:45', timestamp: new Date(Date.now() - 18000000).toISOString() },
  { id: '4', title: '1. Two Sum',                difficulty: 'Easy',   language: 'java',       runtime: '2 ms (98.5%)',  sha: 'd9a15ec', time: '2026-07-21 21:00', timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: '5', title: '15. 3Sum',                  difficulty: 'Medium', language: 'cpp',        runtime: '32 ms (76.4%)', sha: 'e1f234a', time: '2026-07-21 18:20', timestamp: new Date(Date.now() - 90000000).toISOString() },
  { id: '6', title: '146. LRU Cache',            difficulty: 'Hard',   language: 'python3',    runtime: '140 ms (89.1%)',sha: 'f987654', time: '2026-07-20 14:15', timestamp: new Date(Date.now() - 172800000).toISOString() },
];

type RangeFilter = '7d' | '30d' | 'all';

interface StatsViewProps {
  recentSyncs?: RecentSync[];
  onNavigate: (view: string) => void;
}

export function StatsView({ recentSyncs = [], onNavigate }: StatsViewProps) {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  // Convert real RecentSync[] to unified history items
  const historyItems = useMemo(() => {
    if (recentSyncs.length > 0) {
      return recentSyncs.map((s, idx) => ({
        id: String(idx),
        title: s.problemTitle,
        difficulty: 'Medium', // Default display
        language: s.language,
        runtime: s.runtime || 'N/A',
        sha: s.commitSha || 'latest',
        time: s.timestamp ? new Date(s.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently',
        timestamp: s.timestamp || new Date().toISOString(),
      }));
    }
    return MOCK_HISTORY_ITEMS;
  }, [recentSyncs]);

  // 1. Filter items by Date Range
  const rangeFilteredItems = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === '7d'  ? now - 7 * 86400000 :
      range === '30d' ? now - 30 * 86400000 : 0;

    return historyItems.filter((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      return itemTime >= cutoff;
    });
  }, [historyItems, range]);

  // 2. Compute Difficulty Breakdown dynamically
  const difficultyStats = useMemo(() => {
    const total = rangeFilteredItems.length || 1;
    let easy = 0, medium = 0, hard = 0;

    for (const item of rangeFilteredItems) {
      const d = item.difficulty.toLowerCase();
      if (d === 'easy') easy++;
      else if (d === 'hard') hard++;
      else medium++;
    }

    return {
      easy: { count: easy, pct: ((easy / total) * 100).toFixed(1) },
      medium: { count: medium, pct: ((medium / total) * 100).toFixed(1) },
      hard: { count: hard, pct: ((hard / total) * 100).toFixed(1) },
    };
  }, [rangeFilteredItems]);

  // 3. Compute Language Distribution dynamically
  const languageStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    for (const item of rangeFilteredItems) {
      const name = getLanguageName(item.language);
      counts[name] = (counts[name] || 0) + 1;
      total++;
    }

    if (total === 0) return [];

    const colors = ['bg-yellow-400', 'bg-blue-400', 'bg-blue-300', 'bg-emerald-400', 'bg-orange-500', 'bg-purple-400'];
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([lang, count], i) => ({
        lang,
        count,
        pct: Math.round((count / total) * 100),
        color: colors[i % colors.length],
      }));
  }, [rangeFilteredItems]);

  // 4. Compute 12-Week (84-day) Activity Heatmap dynamically
  const heatmapData = useMemo(() => {
    const days: number[] = new Array(84).fill(0);
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    for (const item of historyItems) {
      const t = new Date(item.timestamp).getTime();
      const diffDays = Math.floor((now.getTime() - t) / 86400000);
      if (diffDays >= 0 && diffDays < 84) {
        days[83 - diffDays]++; // index 83 is today
      }
    }

    return days.map((count) => {
      const level =
        count === 0 ? 0 :
        count <= 2  ? 1 :
        count <= 4  ? 2 :
        count <= 6  ? 3 : 4;
      return { count, level };
    });
  }, [historyItems]);

  // 5. Filter History Table by Search & Difficulty
  const filteredHistory = useMemo(() => {
    return rangeFilteredItems.filter((item) => {
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.language.toLowerCase().includes(search.toLowerCase());
      const matchDiff =
        diffFilter === 'all' || item.difficulty.toLowerCase() === diffFilter.toLowerCase();
      return matchSearch && matchDiff;
    });
  }, [rangeFilteredItems, search, diffFilter]);

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
          <h2 class="text-sm font-semibold text-text-primary">Statistics & History</h2>
          <p class="text-xs text-text-muted">{historyItems.length} total synced submissions</p>
        </div>

        {/* Date Filter */}
        <div class="flex gap-1 bg-bg-tertiary p-0.5 rounded-lg border border-border shrink-0">
          {(['7d', '30d', 'all'] as RangeFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              class={`text-xs px-2 py-0.5 rounded font-medium transition-colors btn-press ${
                range === r ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* Dynamic Difficulty Breakdown */}
        <div>
          <SectionHeader title="Difficulty Breakdown" />
          <div class="grid grid-cols-3 gap-2">
            <MetricCard value={difficultyStats.easy.count} label="Easy" sub={`${difficultyStats.easy.pct}%`} accent="text-emerald-400" />
            <MetricCard value={difficultyStats.medium.count} label="Medium" sub={`${difficultyStats.medium.pct}%`} accent="text-yellow-400" />
            <MetricCard value={difficultyStats.hard.count} label="Hard" sub={`${difficultyStats.hard.pct}%`} accent="text-red-400" />
          </div>
        </div>

        {/* Dynamic Language Distribution */}
        <div class="ls-card">
          <p class="text-xs text-text-muted mb-2">Language Distribution</p>

          {languageStats.length === 0 ? (
            <p class="text-xs text-text-muted py-2">No language data for selected range.</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div class="w-full h-2 rounded-full overflow-hidden flex bg-bg-tertiary">
                {languageStats.map((item) => (
                  <div
                    key={item.lang}
                    style={{ width: `${item.pct}%` }}
                    class={item.color}
                    title={`${item.lang}: ${item.count} (${item.pct}%)`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div class="flex flex-wrap gap-3 items-center mt-2.5 text-xs text-text-secondary">
                {languageStats.map((item) => (
                  <span key={item.lang} class="flex items-center gap-1.5">
                    <span class={`w-2 h-2 rounded-full ${item.color}`} />
                    {item.lang} {item.pct}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Dynamic 12-Week Activity Heatmap */}
        <div class="ls-card">
          <p class="text-xs text-text-muted mb-2">Submission Heatmap (Last 12 Weeks)</p>
          <div class="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto py-1">
            {heatmapData.map((day, i) => (
              <div
                key={i}
                class={`heatmap-cell heat-${day.level}`}
                title={`Day ${i + 1}: ${day.count} sync(s)`}
              />
            ))}
          </div>
          <div class="flex justify-between items-center text-[10px] text-text-muted mt-2">
            <span>Less</span>
            <div class="flex gap-1 items-center">
              <div class="w-2 h-2 rounded-sm heat-0" />
              <div class="w-2 h-2 rounded-sm heat-1" />
              <div class="w-2 h-2 rounded-sm heat-2" />
              <div class="w-2 h-2 rounded-sm heat-3" />
              <div class="w-2 h-2 rounded-sm heat-4" />
            </div>
            <span>More</span>
          </div>
        </div>

        {/* Filterable Sync History Table */}
        <div>
          <SectionHeader title="Sync History" />
          <div class="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Search problem title or language..."
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              class="flex-1 bg-bg-tertiary border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/60"
            />
            <select
              value={diffFilter}
              onChange={(e) => setDiffFilter((e.target as HTMLSelectElement).value)}
              class="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
            >
              <option value="all">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            {filteredHistory.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No matching history"
                description="Try clearing search or difficulty filters."
                action={{ label: 'Reset filters', onClick: () => { setSearch(''); setDiffFilter('all'); } }}
              />
            ) : (
              filteredHistory.map((item) => (
                <div key={item.id} class="ls-card p-2.5 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 truncate">
                      <DifficultyBadge difficulty={item.difficulty} />
                      <span class="text-xs font-semibold text-text-primary truncate">{item.title}</span>
                    </div>
                    <CommitShaLink sha={item.sha} />
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-text-muted">
                    <div class="flex items-center gap-2">
                      <LanguageTag language={item.language} />
                      <span>{item.runtime}</span>
                    </div>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
