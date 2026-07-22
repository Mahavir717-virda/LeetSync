import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// ─── Celebration Modal (Microsoft Teams Style) ─────────────────────────────────

interface CelebrationProps {
  open: boolean;
  problem: {
    title: string;
    difficulty: string;
    commitSha: string;
    branch?: string;
    repo?: string;
    language?: string;
  };
  onDismiss: () => void;
}

// 8 particle positions: angle in degrees
const PARTICLES = [0, 45, 90, 135, 180, 225, 270, 315];
const PARTICLE_COLORS = ['#10B981', '#3B82F6', '#10B981', '#3B82F6', '#10B981', '#3B82F6', '#10B981', '#3B82F6'];

export function SubmissionCelebration({ open, problem, onDismiss }: CelebrationProps) {
  const [phase, setPhase] = useState<'entering' | 'showing' | 'leaving'>('entering');
  const [timerWidth, setTimerWidth] = useState(100);
  const DISMISS_MS = 5000;

  useEffect(() => {
    if (!open) { setPhase('entering'); return; }
    setPhase('entering');
    setTimerWidth(100);
    const t1 = setTimeout(() => setPhase('showing'), 50);
    const t2 = setTimeout(() => setPhase('leaving'), DISMISS_MS - 300);
    const t3 = setTimeout(() => { onDismiss(); setPhase('entering'); }, DISMISS_MS);
    // Timer bar
    requestAnimationFrame(() => setTimerWidth(0));
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  if (!open) return null;

  const diff = problem.difficulty?.toLowerCase();
  const diffColor = diff === 'easy' ? 'text-emerald-400' : diff === 'medium' ? 'text-yellow-400' : 'text-red-400';
  const diffBg   = diff === 'easy' ? 'badge-easy' : diff === 'medium' ? 'badge-medium' : 'badge-hard';

  return (
    <div
      class={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 transition-opacity duration-200 ${phase === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
      onClick={onDismiss}
    >
      {/* Sync Success Toast — slides in from top */}
      <div
        class="absolute top-4 left-1/2 -translate-x-1/2 animate-toast-in z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center gap-2 bg-bg-secondary border border-emerald-500/30 rounded-xl px-4 py-2 shadow-modal">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span class="text-xs font-medium text-emerald-400">Accepted!</span>
          <span class="text-xs text-text-secondary">
            Synced to <span class="text-text-primary">{problem.repo ?? 'leetcode-solutions'}</span>
          </span>
          <span class="font-mono text-xs text-accent-blue">#{problem.commitSha.slice(0, 7)}</span>
        </div>
      </div>

      {/* Center Modal */}
      <div
        class="bg-bg-secondary border border-border rounded-2xl p-6 w-72 shadow-modal flex flex-col items-center gap-4 relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge + Rings + Particles */}
        <div class="relative flex items-center justify-center w-24 h-24">

          {/* Ring 1 */}
          <div
            class="absolute inset-0 rounded-full border-2 border-emerald-400/30"
            style={{ animation: 'ringPulse 0.8s ease-out 0.15s forwards', opacity: 0 }}
          />
          {/* Ring 2 */}
          <div
            class="absolute inset-0 rounded-full border-2 border-emerald-400/20"
            style={{ animation: 'ringPulse 0.8s ease-out 0.3s forwards', opacity: 0 }}
          />

          {/* Particles */}
          {PARTICLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const tx = `translateX(${Math.cos(rad) * 44}px)`;
            const ty = `translateY(${Math.sin(rad) * 44}px)`;
            return (
              <div
                key={i}
                class="absolute w-2 h-2 rounded-full"
                style={{
                  background: PARTICLE_COLORS[i],
                  '--tx': tx,
                  '--ty': ty,
                  animation: `particle 0.7s ease-out ${0.1 + i * 0.04}s forwards`,
                  opacity: 0,
                } as any}
              />
            );
          })}

          {/* Badge */}
          <div
            class="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-emerald-glow z-10"
            style={{ animation: 'badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline
                points="20 6 9 17 4 12"
                stroke-dasharray="60"
                stroke-dashoffset="60"
                style={{ animation: 'drawCheck 0.4s ease-out 0.3s forwards' }}
              />
            </svg>
          </div>
        </div>

        {/* Problem Details */}
        <div class="text-center">
          <h3 class="text-text-primary font-semibold text-sm leading-snug">{problem.title}</h3>
          <div class="flex items-center justify-center gap-2 mt-1.5">
            <span class={diffBg}>{problem.difficulty}</span>
            {problem.language && (
              <span class="lang-tag">{problem.language}</span>
            )}
          </div>
          <p class="text-text-muted text-xs mt-2 font-mono">
            Commit <span class="text-accent-blue">#{problem.commitSha.slice(0, 7)}</span> · {problem.branch ?? 'main'}
          </p>
        </div>

        {/* Actions */}
        <div class="flex gap-2 w-full">
          <button
            onClick={onDismiss}
            class="flex-1 text-xs border border-border text-text-secondary rounded-lg py-2 hover:bg-bg-tertiary transition-colors btn-press"
          >
            Dismiss
          </button>
          <a
            href={`https://github.com/${problem.repo ?? '#'}/commit/${problem.commitSha}`}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg py-2 text-center hover:bg-accent-blue/20 transition-colors btn-press"
          >
            View on GitHub ↗
          </a>
        </div>

        {/* Auto-dismiss timer bar */}
        <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-bg-tertiary rounded-b-2xl overflow-hidden">
          <div
            class="h-full bg-emerald-500 rounded-b-2xl"
            style={{
              width: `${timerWidth}%`,
              transition: `width ${DISMISS_MS}ms linear`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sync Success Toast (lightweight inline) ──────────────────────────────────

interface SyncSuccessToastProps {
  visible: boolean;
  problem: string;
  sha: string;
  onDismiss: () => void;
}

export function SyncSuccessToast({ visible, problem, sha, onDismiss }: SyncSuccessToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div class="animate-toast-in fixed top-3 left-1/2 -translate-x-1/2 z-40">
      <div class="flex items-center gap-2 bg-bg-secondary border border-emerald-500/30 rounded-xl px-3 py-2 shadow-modal">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span class="text-xs text-emerald-400 font-medium">Synced</span>
        <span class="text-xs text-text-secondary truncate max-w-32">{problem}</span>
        <span class="font-mono text-xs text-accent-blue">#{sha.slice(0, 7)}</span>
        <button onClick={onDismiss} class="text-text-muted text-xs hover:text-text-secondary">✕</button>
      </div>
    </div>
  );
}
