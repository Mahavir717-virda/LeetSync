import { h } from 'preact';

// ─── Status Badge ─────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'syncing' | 'error' | 'idle' | 'warning';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  syncing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  error:   'bg-red-500/10 text-red-400 border-red-500/20',
  idle:    'bg-bg-tertiary text-text-secondary border-border',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  syncing: 'bg-blue-400 animate-pulse',
  error:   'bg-red-400',
  idle:    'bg-text-muted',
  warning: 'bg-yellow-400',
};

export function StatusBadge({ variant, label, dot = false }: StatusBadgeProps) {
  return (
    <span class={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${BADGE_STYLES[variant]}`}>
      {dot && <span class={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[variant]}`} />}
      {label}
    </span>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  value: string | number;
  label: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent?: string;
}

export function MetricCard({ value, label, sub, trend, accent }: MetricCardProps) {
  return (
    <div class="ls-card flex flex-col gap-1 hover:border-border cursor-default">
      <span class={`text-xl font-bold ${accent ?? 'text-text-primary'}`}>{value}</span>
      <span class="text-xs text-text-secondary font-medium">{label}</span>
      {sub && (
        <span class={`text-xs ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-text-muted'}`}>
          {trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : ''}{sub}
        </span>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      class={`ls-toggle ${checked ? 'on' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} btn-press`}
    >
      <span class="knob" />
    </button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

interface SkeletonProps { lines?: number; className?: string; }

export function LoadingSkeleton({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div class={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          class="skeleton-line h-3"
          style={{ width: `${[100, 75, 55][i % 3]}%` }}
        />
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div class="flex flex-col items-center gap-3 py-10 text-center animate-fade-in">
      <span class="text-3xl">{icon}</span>
      <div>
        <p class="text-text-primary font-medium text-sm">{title}</p>
        {description && <p class="text-text-muted text-xs mt-1">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          class="mt-1 text-xs text-accent-blue hover:underline btn-press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorState({ message, detail, onRetry, onDismiss }: ErrorStateProps) {
  return (
    <div class="bg-red-500/5 border border-red-500/20 rounded-xl p-3 animate-fade-in">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-start gap-2">
          <span class="text-red-400 mt-0.5">⚠</span>
          <div>
            <p class="text-red-400 text-sm font-medium">{message}</p>
            {detail && <p class="text-text-muted text-xs mt-1">{detail}</p>}
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} class="text-text-muted hover:text-text-secondary text-xs btn-press">✕</button>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          class="mt-2 text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors btn-press"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const d = difficulty?.toLowerCase();
  const cls = d === 'easy' ? 'badge-easy' : d === 'medium' ? 'badge-medium' : 'badge-hard';
  return <span class={cls}>{difficulty}</span>;
}

// ─── Language Tag ─────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  python:     'text-yellow-400',
  python3:    'text-yellow-400',
  cpp:        'text-blue-400',
  java:       'text-orange-400',
  javascript: 'text-yellow-300',
  typescript: 'text-blue-300',
  rust:       'text-orange-500',
  go:         'text-cyan-400',
  kotlin:     'text-purple-400',
};

export function LanguageTag({ language }: { language: string }) {
  const color = LANG_COLORS[language?.toLowerCase()] ?? 'text-text-secondary';
  const label = language === 'python3' ? 'Python' : language === 'cpp' ? 'C++' : language;
  return <span class={`lang-tag ${color}`}>{label}</span>;
}

// ─── Commit SHA Link ──────────────────────────────────────────────────────────

export function CommitShaLink({ sha, href }: { sha: string; href?: string }) {
  const short = sha.slice(0, 7);
  return (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      class="font-mono text-xs text-accent-blue hover:underline"
    >
      #{short}
    </a>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: h.JSX.Element }) {
  return (
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</span>
      {action}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      class="animate-spin-slow"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
    >
      <circle cx="12" cy="12" r="10" stroke-opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
    </svg>
  );
}
