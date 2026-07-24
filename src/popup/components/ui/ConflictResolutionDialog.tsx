import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { LeetCodeSubmission, Solution } from '@/types';

interface ConflictResolutionDialogProps {
  open: boolean;
  submission: LeetCodeSubmission;
  existingSolutions: Solution[];
  onResolve: (action: 'replace' | 'save_as_new', label?: string) => void;
}

export function ConflictResolutionDialog({ open, submission, existingSolutions, onResolve }: ConflictResolutionDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'replace' | 'save_as_new'>('replace');
  const [selectedLabel, setSelectedLabel] = useState('Optimal');
  const [customLabel, setCustomLabel] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(0);

  if (!open) return null;

  const defaults = ['Brute Force', 'Better', 'Optimal', 'Custom'];
  const finalLabel = selectedLabel === 'Custom' ? customLabel : selectedLabel;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setFocusedIdx(prev => (prev + 1) % (defaults.length + 2));
      } else if (e.key === 'ArrowUp') {
        setFocusedIdx(prev => (prev - 1 + defaults.length + 2) % (defaults.length + 2));
      } else if (e.key === 'Enter') {
        if (focusedIdx === 0) {
          setSelectedAction('replace');
        } else if (focusedIdx === 1) {
          setSelectedAction('save_as_new');
        } else {
          const labelIdx = focusedIdx - 2;
          setSelectedLabel(defaults[labelIdx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIdx]);

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div class="bg-bg-secondary border border-border rounded-2xl p-5 w-80 shadow-modal flex flex-col gap-3 animate-slide-up">
        <h3 class="text-text-primary font-semibold text-sm">Existing Solution Found</h3>
        
        <div class="text-xs text-text-secondary">
          <p class="font-medium text-text-primary">Current Solutions:</p>
          <ul class="list-disc pl-4 mt-1">
            {existingSolutions.map(s => (
              <li>{s.label} ({s.language})</li>
            ))}
          </ul>
        </div>

        <div class="flex flex-col gap-2">
          <label class={`flex items-center gap-2 text-xs text-text-primary cursor-pointer p-1.5 rounded-lg border transition-all ${
            focusedIdx === 0 ? 'bg-accent-blue/10 border-accent-blue' : 'border-transparent'
          }`}>
            <input type="radio" checked={selectedAction === 'replace'} onChange={() => setSelectedAction('replace')} />
            Replace Default Solution
          </label>
          <label class={`flex items-center gap-2 text-xs text-text-primary cursor-pointer p-1.5 rounded-lg border transition-all ${
            focusedIdx === 1 ? 'bg-accent-blue/10 border-accent-blue' : 'border-transparent'
          }`}>
            <input type="radio" checked={selectedAction === 'save_as_new'} onChange={() => setSelectedAction('save_as_new')} />
            Save as New Variant
          </label>
        </div>

        {selectedAction === 'save_as_new' && (
          <div class="flex flex-col gap-2 mt-1">
            <span class="text-xs text-text-secondary">Select Label:</span>
            <div class="grid grid-cols-2 gap-1.5">
              {defaults.map((d, i) => (
                <button
                  onClick={() => setSelectedLabel(d)}
                  class={`text-xs px-2.5 py-1.5 rounded-lg border text-center transition-all ${
                    selectedLabel === d ? 'bg-accent-blue/10 border-accent-blue text-text-primary' : 'bg-bg-tertiary border-border text-text-secondary'
                  } ${focusedIdx === i + 2 ? 'ring-2 ring-accent-blue' : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>
            {selectedLabel === 'Custom' && (
              <input
                type="text"
                placeholder="e.g. DFS, Two Pointer"
                value={customLabel}
                onInput={(e) => setCustomLabel((e.target as HTMLInputElement).value)}
                class="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue/60"
              />
            )}
          </div>
        )}

        <div class="flex gap-2 mt-2">
          <button onClick={() => onResolve(selectedAction, finalLabel)} class="flex-1 text-xs bg-accent-blue text-white py-1.5 rounded-lg font-medium btn-press">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
