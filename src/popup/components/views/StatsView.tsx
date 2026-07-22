import { h } from 'preact';
import { useState } from 'preact/hooks';
import { MetricCard, DifficultyBadge, LanguageTag, CommitShaLink, SectionHeader } from '../ui/index';

// ─── Mock Data for Statistics & History ───────────────────────────────────────

const HISTORY_ITEMS = [
  { id: '1', title: '206. Reverse Linked List', number: 206, difficulty: 'Easy',   language: 'cpp',        runtime: '3 ms (94.2%)',  memory: '42.1 MB', sha: 'a7f39b1', time: '2026-07-22 17:30', status: 'Accepted' },
  { id: '2', title: '300. Longest Increasing Sub', number: 300, difficulty: 'Medium', language: 'python3', runtime: '48 ms (82.1%)', memory: '16.4 MB', sha: 'b2e1f8d', time: '2026-07-22 15:10', status: 'Accepted' },
  { id: '3', title: '42. Trapping Rain Water',   number: 42,  difficulty: 'Hard',   language: 'typescript', runtime: '62 ms (91.0%)', memory: '51.2 MB', sha: 'c5f23ab', time: '2026-07-22 12:45', status: 'Accepted' },
  { id: '4', title: '1. Two Sum',                number: 1,   difficulty: 'Easy',   language: 'java',       runtime: '2 ms (98.5%)',  memory: '44.8 MB', sha: 'd9a15ec', time: '2026-07-21 21:00', status: 'Accepted' },
  { id: '5', title: '15. 3Sum',                  number: 15,  difficulty: 'Medium', language: 'cpp',        runtime: '32 ms (76.4%)', memory: '24.1 MB', sha: 'e1f234a', time: '2026-07-21 18:20', status: 'Accepted' },
  { id: '6', title: '146. LRU Cache',            number: 146, difficulty: 'Hard',   language: 'python3',    runtime: '140 ms (89.1%)',memory: '75.2 MB', sha: 'f987654', time: '2026-07-20 14:15', status: 'Accepted' },
];

type RangeFilter = '7d' | '30d' | 'all';

interface StatsViewProps {
  onNavigate: (view: string) => void;
}

export function StatsView({ onNavigate }: StatsViewProps) {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const filteredHistory = HISTORY_ITEMS.filter((item) => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || String(item.number).includes(search);
    const matchDiff = diffFilter === 'all' || item.difficulty.toLowerCase() === diffFilter.toLowerCase();
    return matchSearch && matchDiff;
  });

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <button onClick={() => onNavigate('dashboard')} class="text-text-muted hover:text-text-primary btn-press p-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="flex-1">
          <h2 class="text-sm font-semibold text-text-primary">Statistics & History</h2>
          <p class="text-xs text-text-muted">Submission metrics & activity logs</p>
        </div>

        {/* Date Filter */}
        <div class="flex gap-1 bg-bg-tertiary p-0.5 rounded-lg border border-border">
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

        {/* Breakdown by Difficulty */}
        <div>
          <SectionHeader title="Difficulty Breakdown" />
          <div class="grid grid-cols-3 gap-2">
            <MetricCard value="180" label="Easy" sub="52.6%" accent="text-emerald-400" />
            <MetricCard value="130" label="Medium" sub="38.0%" accent="text-yellow-400" />
            <MetricCard value="32" label="Hard" sub="9.4%" accent="text-red-400" />
          </div>
        </div>

        {/* Language Distribution */}
        <div class="ls-card">
          <p class="text-xs text-text-muted mb-2">Language Distribution</p>
          <div class="w-full h-2 rounded-full overflow-hidden flex bg-bg-tertiary">
            <div style={{ width: '60%' }} class="bg-yellow-400" title="Python 60%" />
            <div style={{ width: '25%' }} class="bg-blue-400" title="C++ 25%" />
            <div style={{ width: '15%' }} class="bg-blue-300" title="TypeScript 15%" />
          </div>
          <div class="flex justify-between items-center mt-2.5 text-xs text-text-secondary">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-yellow-400"/>Python 60%</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-400"/>C++ 25%</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-300"/>TypeScript 15%</span>
          </div>
        </div>

        {/* Activity Heatmap Grid */}
        <div class="ls-card">
          <p class="text-xs text-text-muted mb-2">Submission Heatmap (Last 12 Weeks)</p>
          <div class="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto py-1">
            {Array.from({ length: 84 }).map((_, i) => {
              const level = i % 11 === 0 ? 4 : i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
              return <div key={i} class={`heatmap-cell heat-${level}`} title={`Day ${i+1}: ${level * 2} submissions`} />;
            })}
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

        {/* Sync History Table */}
        <div>
          <SectionHeader title="Sync History" />
          <div class="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Search problem title or ID..."
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
            {filteredHistory.map((item) => (
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
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
