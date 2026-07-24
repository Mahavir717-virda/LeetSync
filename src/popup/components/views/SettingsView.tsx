import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Toggle } from '../ui/index';
import { ConfirmationDialog } from '../ui/dialogs';
import type { ToastData } from '../ui/dialogs';
import type { LeetSyncSettings, SyncMode, FolderStructure } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface SettingsViewProps {
  settings?: LeetSyncSettings;
  onUpdateSettings?: (updates: Partial<LeetSyncSettings>) => Promise<void>;
  onLogout?: () => Promise<void>;
  onNavigate: (view: string) => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

export function SettingsView({
  settings = DEFAULT_SETTINGS,
  onUpdateSettings,
  onLogout,
  onNavigate,
  addToast,
}: SettingsViewProps) {
  const [syncMode, setSyncMode] = useState<SyncMode>(settings.syncMode || 'accepted_only');
  const [folderStructure, setFolderStructure] = useState<FolderStructure>(settings.folderStructure || 'Topic/Difficulty');
  const [autoSync, setAutoSync] = useState<boolean>(settings.autoSync ?? true);
  const [notifications, setNotifications] = useState<boolean>(settings.notifications ?? true);
  const [commitTemplate, setCommitTemplate] = useState<string>('{id}. {title} ({difficulty}) - {runtime}');
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (settings) {
      setSyncMode(settings.syncMode || 'accepted_only');
      setFolderStructure(settings.folderStructure || 'Topic/Difficulty');
      setAutoSync(settings.autoSync ?? true);
      setNotifications(settings.notifications ?? true);
    }
  }, [settings]);

  const handleSaveSyncMode = async (mode: SyncMode) => {
    setSyncMode(mode);
    if (onUpdateSettings) {
      await onUpdateSettings({ syncMode: mode });
      addToast({ variant: 'success', title: 'Sync Mode Updated', message: `Set to ${mode === 'accepted_only' ? 'Accepted Only' : 'All Submissions'}.` });
    }
  };

  const handleSaveFolderStructure = async (struct: FolderStructure) => {
    setFolderStructure(struct);
    if (onUpdateSettings) {
      await onUpdateSettings({ folderStructure: struct });
      addToast({ variant: 'success', title: 'Folder Layout Updated', message: `Set to ${struct}.` });
    }
  };

  const handleToggleAutoSync = async () => {
    const next = !autoSync;
    setAutoSync(next);
    if (onUpdateSettings) {
      await onUpdateSettings({ autoSync: next });
      addToast({ variant: 'info', title: 'Auto-Sync', message: next ? 'Auto-sync enabled.' : 'Auto-sync disabled.' });
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notifications;
    setNotifications(next);
    if (onUpdateSettings) {
      await onUpdateSettings({ notifications: next });
      addToast({ variant: 'info', title: 'Notifications', message: next ? 'Notifications enabled.' : 'Notifications disabled.' });
    }
  };

  const handleSaveTemplate = () => {
    addToast({ variant: 'success', title: 'Settings Saved', message: 'Commit message template saved.' });
  };

  const handleConfirmReset = async () => {
    setShowResetModal(false);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(['leetsync_submission_hashes', 'leetsync_recent_syncs', 'leetsync_metadata_cache', 'leetsync_migration_log']);
    }
    addToast({ variant: 'info', title: 'Cache Cleared', message: 'Local problem manifests and logs reset.' });
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectModal(false);
    if (onLogout) {
      await onLogout();
    }
    addToast({ variant: 'warning', title: 'Disconnected', message: 'GitHub account removed.' });
    onNavigate('auth');
  };

  // Mask GitHub token for security
  const maskedToken = settings.githubToken
    ? `${settings.githubToken.slice(0, 4)}...${settings.githubToken.slice(-4)}`
    : 'Not authenticated';

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div class="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <button onClick={() => onNavigate('dashboard')} class="text-text-muted hover:text-text-primary btn-press p-1">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Advanced Settings</h2>
          <p class="text-xs text-text-muted">Target repository & sync rules</p>
        </div>
      </div>

      {/* Main Form */}
      <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">

        {/* Target Repository */}
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Repository</span>
          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">
                {settings.repoOwner && settings.repoName ? `${settings.repoOwner}/${settings.repoName}` : 'No repo selected'}
              </p>
              <p class="text-[11px] text-text-muted">Layout: {settings.layoutVersion === 2 ? 'Topic/Difficulty' : 'Legacy Flat'}</p>
            </div>
            <button
              onClick={() => onNavigate('auth')}
              class="text-xs border border-border text-text-secondary rounded-lg px-2.5 py-1 hover:bg-bg-tertiary transition-colors btn-press"
            >
              Change Repo
            </button>
          </div>
        </div>

        {/* Sync Rules */}
        <div class="flex flex-col gap-3">
          <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Sync Rules</span>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Auto Sync on Submit</p>
              <p class="text-[11px] text-text-muted">Automatically sync accepted LeetCode submissions</p>
            </div>
            <Toggle checked={autoSync} onChange={handleToggleAutoSync} />
          </div>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Sync Mode</p>
              <p class="text-[11px] text-text-muted">Filter which submissions are committed</p>
            </div>
            <select
              value={syncMode}
              onChange={(e) => handleSaveSyncMode((e.target as HTMLSelectElement).value as SyncMode)}
              class="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
            >
              <option value="accepted_only">Accepted Only</option>
              <option value="all_submissions">All Submissions</option>
            </select>
          </div>

          <div class="ls-card flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-text-primary">Folder Structure</p>
                <p class="text-[11px] text-text-muted">How solutions are grouped in GitHub</p>
              </div>
              <select
                value={folderStructure}
                onChange={(e) => handleSaveFolderStructure((e.target as HTMLSelectElement).value as FolderStructure)}
                class="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
              >
                <option value="Topic/Difficulty">Topic / Difficulty</option>
                <option value="Topic">Topic</option>
                <option value="Difficulty">Difficulty</option>
                <option value="Flat">Flat</option>
              </select>
            </div>
            <div class="border-t border-border/60 pt-2 flex items-center justify-between">
              <span class="text-[11px] text-text-muted">Existing repository files in old layout?</span>
              <button
                onClick={() => onNavigate('migration')}
                class="text-xs text-accent-blue bg-accent-blue/10 border border-accent-blue/30 px-2.5 py-1 rounded-lg hover:bg-accent-blue/20 transition-colors btn-press flex items-center gap-1 font-medium shrink-0"
              >
                ⚡ Migrate Repository
              </button>
            </div>
          </div>

          <div class="ls-card flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-text-primary">Desktop Notifications</p>
              <p class="text-[11px] text-text-muted">Alert when a submission sync completes</p>
            </div>
            <Toggle checked={notifications} onChange={handleToggleNotifications} />
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
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-text-primary">Connected Account</p>
                <p class="text-[11px] text-text-muted">@{settings.githubUsername || 'Not connected'}</p>
              </div>
              <span class="text-xs px-2 py-0.5 rounded bg-bg-tertiary border border-border font-mono text-text-secondary">
                {settings.authMethod ? settings.authMethod.toUpperCase() : 'PAT'}
              </span>
            </div>
            <div class="border-t border-border pt-2">
              <p class="text-xs font-medium text-text-primary mb-0.5">Token Credential</p>
              <p class="text-[11px] text-text-muted font-mono">{maskedToken}</p>
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
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
      />

      <ConfirmationDialog
        open={showResetModal}
        title="Reset Local Cache?"
        description="This will clear your cached manifests and activity logs. Your GitHub repository will remain untouched."
        confirmLabel="Reset Cache"
        danger
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}
