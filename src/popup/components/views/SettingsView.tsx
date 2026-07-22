import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Toggle } from '../ui/index';
import { ConfirmationDialog } from '../ui/dialogs';
import type { ToastData } from '../ui/dialogs';

interface SettingsViewProps {
  onNavigate: (view: string) => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

export function SettingsView({ onNavigate, addToast }: SettingsViewProps) {
  const [syncAccepted, setSyncAccepted] = useState(true);
  const [syncDrafts, setSyncDrafts] = useState(false);
  const [autoTags, setAutoTags] = useState(true);
  const [commitTemplate, setCommitTemplate] = useState('{id}. {title} ({difficulty}) - {runtime}');
  const [patToken, setPatToken] = useState('ghp_************************************');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSaveTemplate = () => {
    addToast({ variant: 'success', title: 'Settings Saved', message: 'Commit message format updated.' });
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <button onClick={() => onNavigate('dashboard')} class="text-text-muted hover:text-text-primary btn-press p-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Advanced Settings</h2>
          <p class="text-xs text-text-muted">Rules, formatting, and integrations</p>
        </div>
      </div>

      {/* Main Form */}
      <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">

        {/* Sync Rules */}
        <div class="flex flex-col gap-3">
          <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Sync Rules</span>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Sync Accepted Only</p>
              <p class="text-[11px] text-text-muted">Ignore failed / wrong answer attempts</p>
            </div>
            <Toggle checked={syncAccepted} onChange={() => setSyncAccepted(!syncAccepted)} />
          </div>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Sync Code Drafts</p>
              <p class="text-[11px] text-text-muted">Upload uncommitted workspace snapshots</p>
            </div>
            <Toggle checked={syncDrafts} onChange={() => setSyncDrafts(!syncDrafts)} />
          </div>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Auto-commit Tags & Topics</p>
              <p class="text-[11px] text-text-muted">Include tags like Array, Dynamic Programming in README</p>
            </div>
            <Toggle checked={autoTags} onChange={() => setAutoTags(!autoTags)} />
          </div>
        </div>

        {/* Commit Message Formatter */}
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Commit Message Formatter</span>
          <div class="ls-card flex flex-col gap-2">
            <label class="text-xs text-text-secondary">Template Format</label>
            <input
              type="text"
              value={commitTemplate}
              onInput={(e) => setCommitTemplate((e.target as HTMLInputElement).value)}
              class="w-full bg-bg-tertiary border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-blue/60"
            />
            <p class="text-[11px] text-text-muted">Available tags: <code>{'{id}'}</code>, <code>{'{title}'}</code>, <code>{'{difficulty}'}</code>, <code>{'{runtime}'}</code></p>
            <button
              onClick={handleSaveTemplate}
              class="self-end text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/30 px-3 py-1 rounded-lg hover:bg-accent-blue/20 transition-colors btn-press mt-1"
            >
              Save Template
            </button>
          </div>
        </div>

        {/* GitHub Integration */}
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">GitHub Integration</span>
          <div class="ls-card flex flex-col gap-3">
            <div>
              <p class="text-xs font-medium text-text-primary">Personal Access Token (PAT)</p>
              <p class="text-[11px] text-text-muted font-mono mt-0.5">{patToken}</p>
            </div>
            <div class="border-t border-border pt-2">
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="text-text-muted">API Rate Limit Usage</span>
                <span class="text-emerald-400 font-mono">4,820 / 5,000</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full" style={{ width: '96.4%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div class="flex flex-col gap-2 pt-2 border-t border-border">
          <span class="text-xs font-semibold text-red-400 uppercase tracking-wider">Danger Zone</span>
          <div class="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-text-primary">Reset Extension Cache</p>
                <p class="text-[11px] text-text-muted">Clears local problem manifests and logs</p>
              </div>
              <button
                onClick={() => setShowResetModal(true)}
                class="text-xs border border-red-500/30 text-red-400 rounded-lg px-2.5 py-1 hover:bg-red-500/10 transition-colors btn-press"
              >
                Reset Cache
              </button>
            </div>

            <div class="flex items-center justify-between border-t border-red-500/20 pt-2.5">
              <div>
                <p class="text-xs font-medium text-text-primary">Disconnect GitHub Account</p>
                <p class="text-[11px] text-text-muted">Removes OAuth token and stops auto-sync</p>
              </div>
              <button
                onClick={() => setShowDisconnectModal(true)}
                class="text-xs bg-red-500 text-white rounded-lg px-2.5 py-1 hover:bg-red-600 transition-colors btn-press"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Modals */}
      <ConfirmationDialog
        open={showDisconnectModal}
        title="Disconnect GitHub Account?"
        description="LeetSync will stop syncing your submissions until you log in again."
        confirmLabel="Disconnect"
        danger
        onConfirm={() => {
          setShowDisconnectModal(false);
          addToast({ variant: 'warning', title: 'Disconnected', message: 'GitHub account removed.' });
          onNavigate('auth');
        }}
        onCancel={() => setShowDisconnectModal(false)}
      />

      <ConfirmationDialog
        open={showResetModal}
        title="Reset Local Cache?"
        description="This will clear your cached manifests and activity logs. Your GitHub repository will remain untouched."
        confirmLabel="Reset Cache"
        danger
        onConfirm={() => {
          setShowResetModal(false);
          addToast({ variant: 'info', title: 'Cache Cleared', message: 'Local data has been reset.' });
        }}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}
