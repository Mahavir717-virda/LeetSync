import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { ProgressStepper, LogViewer, ConfirmationDialog } from '../ui/dialogs';
import type { LogLine } from '../ui/dialogs';
import type { ToastData } from '../ui/dialogs';
import { Spinner } from '../ui/index';

// ─── Mock log generator ───────────────────────────────────────────────────────

let logId = 0;
function makeLog(level: LogLine['level'], source: string, message: string, detail?: string): LogLine {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  return { id: String(++logId), time, level, source, message, detail };
}

const MOCK_PROBLEMS = [
  'Two Sum', 'Reverse Linked List', 'LRU Cache', 'Merge Intervals',
  'Binary Tree Level Order', 'Valid Parentheses', 'Max Subarray', 'Search in Rotated Array',
];

const WIZARD_STEPS = [
  { key: 'detect',   label: 'Detect' },
  { key: 'preflight', label: 'Preflight' },
  { key: 'preview',  label: 'Preview' },
  { key: 'migrate',  label: 'Migrate' },
  { key: 'complete', label: 'Complete' },
];

interface MigrationViewProps {
  onNavigate: (view: string) => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

export function MigrationView({ onNavigate, addToast }: MigrationViewProps) {
  const [step, setStep] = useState('detect');
  const [checkIdx, setCheckIdx] = useState(-1); // preflight animation index
  const [progress, setProgress] = useState(0);   // 0–412
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const TOTAL = 412;

  // Preflight animation
  useEffect(() => {
    if (step !== 'preflight') return;
    setCheckIdx(-1);
    const advance = (i: number) => {
      if (i > 3) return;
      setTimeout(() => { setCheckIdx(i); advance(i + 1); }, 700 + i * 300);
    };
    setTimeout(() => advance(0), 400);
  }, [step]);

  // Migration progress simulation
  useEffect(() => {
    if (step !== 'migrate' || isPaused) return;
    setProgress(0);
    setLogs([makeLog('INFO', 'Migration', `Starting bulk migration of ${TOTAL} problems...`)]);
    let current = 0;
    const interval = setInterval(() => {
      if (isPaused) return;
      current += Math.floor(Math.random() * 6) + 3;
      if (current >= TOTAL) {
        current = TOTAL;
        setProgress(TOTAL);
        const p = Math.floor(TOTAL / MOCK_PROBLEMS.length);
        setLogs((prev) => [
          ...prev,
          makeLog('OK', 'Migration', `All ${TOTAL} problems migrated successfully!`),
        ]);
        clearInterval(interval);
        setTimeout(() => setStep('complete'), 800);
        return;
      }
      setProgress(current);
      const problem = MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)];
      setLogs((prev) => [
        ...prev.slice(-30),
        makeLog('OK', 'GitHub', `Synced: ${current}. ${problem} → main`),
      ]);
    }, 120);
    return () => clearInterval(interval);
  }, [step, isPaused]);

  const pct = Math.round((progress / TOTAL) * 100);
  const currentProblem = MOCK_PROBLEMS[progress % MOCK_PROBLEMS.length];

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <button onClick={() => onNavigate('dashboard')} class="text-text-muted hover:text-text-primary btn-press p-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="flex flex-col">
          <h2 class="text-sm font-semibold text-text-primary">Migration Wizard</h2>
          <p class="text-xs text-text-muted">Bulk sync & reorganize your solutions</p>
        </div>
      </div>

      {/* Stepper */}
      <div class="px-4 py-3 border-b border-border flex items-center justify-between">
        <ProgressStepper
          steps={WIZARD_STEPS}
          current={step}
          onStep={(key, i) => {
            const curIdx = WIZARD_STEPS.findIndex(s => s.key === step);
            if (i < curIdx) setStep(key);
          }}
        />
        <span class="text-xs text-text-muted">
          {WIZARD_STEPS.findIndex(s => s.key === step) + 1} / {WIZARD_STEPS.length}
        </span>
      </div>

      {/* Step Content */}
      <div class="flex-1 overflow-y-auto px-4 py-4">

        {/* ── STEP 1: Detect ───────────────────────────────────── */}
        {step === 'detect' && (
          <div class="flex flex-col gap-4 animate-slide-in-right">
            <div class="ls-card">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-xl bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3B82F6" stroke-width="2">
                    <path d="M3 3l3 3M21 3l-3 3M3 21l3-3M21 21l-3-3M12 8v8M8 12h8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-text-primary">mahavir717/leetcode-solutions</h3>
                  <div class="flex gap-2 mt-1">
                    <span class="text-xs text-text-muted font-mono">main branch</span>
                    <span class="text-xs text-emerald-400">✓ Write access</span>
                    <span class="text-xs text-emerald-400">✓ 412 problems detected</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="ls-card">
              <h4 class="text-xs font-semibold text-text-secondary mb-2">What will change</h4>
              <div class="flex flex-col gap-1.5 text-xs text-text-muted">
                <div class="flex items-center gap-2"><span class="text-emerald-400">→</span> Flat root files → <code class="text-accent-blue">Topic/Difficulty/id-name/lang/</code></div>
                <div class="flex items-center gap-2"><span class="text-emerald-400">→</span> Atomic batch commits, no data loss</div>
                <div class="flex items-center gap-2"><span class="text-emerald-400">→</span> Full rollback support</div>
              </div>
            </div>

            <button
              onClick={() => setStep('preflight')}
              class="w-full py-2.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-xl text-sm font-medium hover:bg-accent-blue/20 transition-colors btn-press"
            >
              Run Preflight Checks →
            </button>
          </div>
        )}

        {/* ── STEP 2: Preflight ────────────────────────────────── */}
        {step === 'preflight' && (
          <div class="flex flex-col gap-4 animate-slide-in-right">
            <div class="ls-card flex flex-col gap-3">
              {[
                { label: 'GitHub Token Validity',      detail: 'Token valid, 5,000 API calls remaining' },
                { label: 'Repository Rate Limits',      detail: 'Under threshold — good to proceed' },
                { label: 'LeetCode Session Active',     detail: '412 accepted solutions detected' },
                { label: 'Folder Write Access',         detail: 'mahavir717/leetcode-solutions writable' },
              ].map((check, i) => {
                const done    = i <= checkIdx;
                const loading = i === checkIdx + 1;
                return (
                  <div key={i} class="flex items-center gap-2.5">
                    <div class={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${done ? 'bg-emerald-500' : loading ? 'bg-bg-tertiary border border-accent-blue' : 'bg-bg-tertiary border border-border'}`}>
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : loading ? (
                        <Spinner size={10} />
                      ) : (
                        <span class="text-text-muted text-xs">{i + 1}</span>
                      )}
                    </div>
                    <div class="flex-1">
                      <p class={`text-xs font-medium ${done ? 'text-text-primary' : 'text-text-muted'}`}>{check.label}</p>
                      {done && <p class="text-xs text-emerald-400">{check.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setStep('preview')}
              disabled={checkIdx < 3}
              class={`w-full py-2.5 rounded-xl text-sm font-medium transition-all btn-press ${checkIdx >= 3 ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/20' : 'bg-bg-tertiary text-text-muted border border-border'}`}
            >
              {checkIdx >= 3 ? 'Generate Migration Preview →' : 'Running checks…'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Preview ──────────────────────────────────── */}
        {step === 'preview' && (
          <div class="flex flex-col gap-4 animate-slide-in-right">
            <div class="grid grid-cols-2 gap-2">
              {[
                { value: '412', label: 'Solutions Found', color: 'text-text-primary' },
                { value: '1m 45s', label: 'Est. Time', color: 'text-yellow-400' },
                { value: '400', label: 'New Files', color: 'text-emerald-400' },
                { value: '12', label: 'Overwrites', color: 'text-accent-blue' },
              ].map(({ value, label, color }) => (
                <div class="ls-card text-center py-3">
                  <p class={`text-lg font-bold ${color}`}>{value}</p>
                  <p class="text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>

            {/* Collapsible folder tree */}
            <div class="ls-card">
              <button
                onClick={() => setTreeOpen(!treeOpen)}
                class="w-full flex items-center justify-between text-xs text-text-secondary font-medium"
              >
                <span>📁 Destination folder preview</span>
                <span class={`transition-transform ${treeOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {treeOpen && (
                <div class="mt-3 font-mono text-xs text-text-muted leading-relaxed pl-2 animate-slide-up">
                  <div>leetcode-solutions/</div>
                  <div class="pl-3">├── Array/</div>
                  <div class="pl-6">│   ├── Easy/0001-two-sum/cpp/</div>
                  <div class="pl-6">│   └── Medium/0015-3sum/python/</div>
                  <div class="pl-3">├── Dynamic_Programming/</div>
                  <div class="pl-6">│   └── Hard/0072-edit-distance/typescript/</div>
                  <div class="pl-3">└── Linked_List/</div>
                  <div class="pl-6">    └── Easy/0206-reverse-linked-list/cpp/</div>
                </div>
              )}
            </div>

            <div class="flex gap-2">
              <button onClick={() => setStep('preflight')} class="flex-1 text-xs border border-border text-text-secondary rounded-xl py-2.5 hover:bg-bg-tertiary transition-colors btn-press">← Back</button>
              <button onClick={() => { setLogs([]); setProgress(0); setStep('migrate'); }} class="flex-1 text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl py-2.5 hover:bg-emerald-500/20 transition-colors btn-press">
                Start Migration ✦
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Migration Progress ───────────────────────── */}
        {step === 'migrate' && (
          <div class="flex flex-col gap-4 animate-slide-in-right">
            {/* Progress */}
            <div class="ls-card">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-text-secondary font-medium">Migration Progress</span>
                <span class="text-lg font-bold text-accent-blue">{pct}%</span>
              </div>
              <div class="progress-track mb-2">
                <div class="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p class="text-xs text-text-muted">{progress} / {TOTAL} problems synced</p>
            </div>

            {/* Currently processing */}
            <div class="flex items-center gap-2 bg-bg-tertiary rounded-xl px-3 py-2.5 border border-border">
              <Spinner size={13} />
              <span class="text-xs text-text-secondary truncate">Syncing: <span class="text-text-primary">{progress}. {currentProblem}</span></span>
            </div>

            {/* Live log */}
            <div>
              <p class="text-xs text-text-muted mb-1.5">Live Log</p>
              <LogViewer logs={logs} />
            </div>

            {/* Controls */}
            <div class="flex gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                class="flex-1 text-xs border border-border text-text-secondary rounded-xl py-2 hover:bg-bg-tertiary transition-colors btn-press"
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={() => setShowCancel(true)}
                class="flex-1 text-xs bg-red-500/5 text-red-400 border border-red-500/20 rounded-xl py-2 hover:bg-red-500/10 transition-colors btn-press"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Complete ─────────────────────────────────── */}
        {step === 'complete' && (
          <div class="flex flex-col items-center gap-5 py-4 animate-fade-in">
            {/* Animated badge */}
            <div class="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-emerald-glow" style={{ animation: 'badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" stroke-dasharray="60" stroke-dashoffset="60" style={{ animation: 'drawCheck 0.4s ease-out 0.3s forwards' }}/>
              </svg>
            </div>

            <div class="text-center">
              <h2 class="text-base font-bold text-text-primary">412 Submissions Synced!</h2>
              <p class="text-xs text-text-muted mt-1">Your repository is fully organized.</p>
            </div>

            <div class="grid grid-cols-3 gap-2 w-full">
              <div class="ls-card text-center py-3">
                <p class="text-base font-bold text-accent-blue">412</p>
                <p class="text-xs text-text-muted">Commits</p>
              </div>
              <div class="ls-card text-center py-3">
                <p class="text-base font-bold text-emerald-400">84k</p>
                <p class="text-xs text-text-muted">Lines</p>
              </div>
              <div class="ls-card text-center py-3">
                <p class="text-base font-bold text-yellow-400">1m 12s</p>
                <p class="text-xs text-text-muted">Time</p>
              </div>
            </div>

            <div class="flex gap-2 w-full">
              <a
                href="https://github.com/mahavir717/leetcode-solutions"
                target="_blank" rel="noopener"
                class="flex-1 text-xs bg-bg-secondary border border-border text-text-secondary rounded-xl py-2.5 text-center hover:bg-bg-tertiary transition-colors btn-press"
              >
                Open GitHub ↗
              </a>
              <button
                onClick={() => onNavigate('dashboard')}
                class="flex-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-xl py-2.5 hover:bg-accent-blue/20 transition-colors btn-press"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      <ConfirmationDialog
        open={showCancel}
        title="Cancel Migration?"
        description="Progress will be lost. You can restart the migration at any time."
        confirmLabel="Yes, Cancel"
        cancelLabel="Continue Migrating"
        danger
        onConfirm={() => { setShowCancel(false); onNavigate('dashboard'); }}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
}
