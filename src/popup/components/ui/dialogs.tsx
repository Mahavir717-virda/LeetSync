import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// ─── Toast Types ──────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

// ─── Toast Pill ───────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastVariant, { border: string; icon: string; title: string }> = {
  success: { border: 'border-emerald-500/30', icon: '✓', title: 'text-emerald-400' },
  error:   { border: 'border-red-500/30',     icon: '✕', title: 'text-red-400' },
  info:    { border: 'border-blue-500/30',    icon: 'ℹ', title: 'text-blue-400' },
  warning: { border: 'border-yellow-500/30', icon: '⚠', title: 'text-yellow-400' },
};

interface ToastItemProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const s = TOAST_STYLES[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 200);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      class={`
        flex items-start gap-2.5 bg-bg-secondary border ${s.border} rounded-xl
        px-3 py-2.5 shadow-modal max-w-xs w-full
        ${exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      <span class={`text-sm font-bold mt-0.5 ${s.title}`}>{s.icon}</span>
      <div class="flex-1 min-w-0">
        <p class={`text-xs font-semibold ${s.title}`}>{toast.title}</p>
        {toast.message && <p class="text-xs text-text-secondary mt-0.5 leading-snug">{toast.message}</p>}
      </div>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 200); }}
        class="text-text-muted hover:text-text-secondary text-xs shrink-0 btn-press"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div class="fixed top-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} class="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

// ─── useToast hook ────────────────────────────────────────────────────────────

let _addToast: ((t: Omit<ToastData, 'id'>) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const add = (t: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  _addToast = add;

  return { toasts, add, remove };
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, onConfirm, onCancel,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div class="bg-bg-secondary border border-border rounded-2xl p-5 w-72 shadow-modal animate-slide-up">
        <h3 class="text-text-primary font-semibold text-sm mb-2">{title}</h3>
        {description && <p class="text-text-secondary text-xs leading-relaxed mb-4">{description}</p>}
        <div class="flex gap-2">
          <button
            onClick={onCancel}
            class="flex-1 text-xs border border-border text-text-secondary rounded-lg py-1.5 hover:bg-bg-tertiary transition-colors btn-press"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            class={`flex-1 text-xs rounded-lg py-1.5 font-medium transition-colors btn-press ${
              danger
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────

interface StepperStep { label: string; key: string; }
interface ProgressStepperProps {
  steps: StepperStep[];
  current: string;
  onStep?: (key: string, index: number) => void;
}

export function ProgressStepper({ steps, current, onStep }: ProgressStepperProps) {
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div class="flex items-center gap-0">
      {steps.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;

        return (
          <div key={step.key} class="flex items-center">
            {/* Step circle */}
            <button
              onClick={() => onStep?.(step.key, i)}
              disabled={!done}
              class={`
                flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0
                transition-all duration-200 btn-press
                ${done    ? 'bg-emerald-500 text-white cursor-pointer' : ''}
                ${active  ? 'bg-accent-blue text-white ring-2 ring-accent-blue/30' : ''}
                ${pending ? 'bg-bg-tertiary text-text-muted border border-border' : ''}
              `}
              title={step.label}
            >
              {done ? '✓' : i + 1}
            </button>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div class={`h-0.5 w-8 transition-colors duration-300 ${done ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Log Viewer ───────────────────────────────────────────────────────────────

export type LogLevel = 'INFO' | 'OK' | 'WARN' | 'ERR';

export interface LogLine {
  id: string;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
  detail?: string;
}

const LOG_COLORS: Record<LogLevel, string> = {
  INFO: 'text-blue-400 bg-blue-500/10',
  OK:   'text-emerald-400 bg-emerald-500/10',
  WARN: 'text-yellow-400 bg-yellow-500/10',
  ERR:  'text-red-400 bg-red-500/10',
};

export function LogViewer({ logs }: { logs: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs.length]);

  const toggle = (id: string) =>
    setExpanded((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (logs.length === 0) {
    return (
      <div class="terminal rounded-xl p-4 text-text-muted text-xs text-center py-10">
        No logs yet. Start syncing to see activity.
      </div>
    );
  }

  return (
    <div ref={ref} class="terminal rounded-xl p-3 overflow-y-auto max-h-64 flex flex-col gap-0.5">
      {logs.map((log) => (
        <div key={log.id}>
          <div
            class={`flex gap-2 items-start text-xs ${log.detail ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => log.detail && toggle(log.id)}
          >
            <span class="text-text-muted shrink-0 w-14">{log.time}</span>
            <span class={`shrink-0 px-1 rounded text-xs font-semibold w-8 text-center ${LOG_COLORS[log.level]}`}>{log.level}</span>
            <span class="text-text-muted shrink-0">[{log.source}]</span>
            <span class="text-text-secondary">{log.message}</span>
            {log.detail && <span class="text-text-muted ml-auto">{expanded.has(log.id) ? '▲' : '▼'}</span>}
          </div>
          {log.detail && expanded.has(log.id) && (
            <div class="ml-24 mt-0.5 text-red-400/80 text-xs bg-red-500/5 rounded p-1.5 font-mono leading-relaxed">
              {log.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
