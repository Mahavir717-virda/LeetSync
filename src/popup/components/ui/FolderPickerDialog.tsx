import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { LeetCodeSubmission } from '@/types';

interface FolderPickerDialogProps {
  open: boolean;
  submission: LeetCodeSubmission;
  onConfirm: (folder: string) => void;
  onCancel: () => void;
}

export function FolderPickerDialog({ open, submission, onConfirm, onCancel }: FolderPickerDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!open) return null;

  const options = (submission.topicTags || []).map(t => t.name);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSelectedIdx(prev => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        setSelectedIdx(prev => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        onConfirm(options[selectedIdx]);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx, options]);

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div class="bg-bg-secondary border border-border rounded-2xl p-5 w-80 shadow-modal flex flex-col gap-3 animate-slide-up">
        <h3 class="text-text-primary font-semibold text-sm">Choose Folder Layout</h3>
        <p class="text-text-secondary text-xs">
          This problem belongs to multiple topics. Which folder should be used? (This choice will be remembered).
        </p>
        <div class="flex flex-col gap-1.5 my-1">
          {options.map((opt, i) => (
            <button
              onClick={() => onConfirm(opt)}
              class={`flex items-center justify-between text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                i === selectedIdx 
                  ? 'bg-accent-blue/10 border-accent-blue text-text-primary' 
                  : 'bg-bg-tertiary border-border text-text-secondary'
              }`}
            >
              <span>{opt}</span>
              {i === selectedIdx && <span class="text-accent-blue text-xs">●</span>}
            </button>
          ))}
        </div>
        <div class="flex gap-2">
          <button onClick={onCancel} class="flex-1 text-xs border border-border text-text-secondary py-1.5 rounded-lg btn-press">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
