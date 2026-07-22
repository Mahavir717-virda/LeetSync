import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { MessageType } from '@/utils/constants';
import type { LeetSyncSettings, RecentSync, MigrationPlan } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { TopHeader, ViewportMode } from './components/layout/TopHeader';
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { MigrationView } from './components/views/MigrationView';
import { LogsView } from './components/views/LogsView';
import { StatsView } from './components/views/StatsView';
import { SettingsView } from './components/views/SettingsView';
import { ToastContainer, useToast } from './components/ui/dialogs';

/**
 * Send a message to the Chrome extension background service worker.
 */
function sendMessage<T = any>(type: MessageType | string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } else {
      resolve({} as T);
    }
  });
}

export function App() {
  const [view, setView] = useState<'loading' | 'auth' | 'dashboard' | 'migration' | 'logs' | 'stats' | 'settings'>('loading');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('popup');
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState<LeetSyncSettings>(DEFAULT_SETTINGS);
  const [recentSyncs, setRecentSyncs] = useState<RecentSync[]>([]);
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  // Load initial extension state on mount
  const loadExtensionData = async () => {
    try {
      // 1. Get Auth Status
      const authStatus = await sendMessage<{ authenticated: boolean; username: string | null }>(MessageType.GET_AUTH_STATUS);
      const isAuth = !!authStatus?.authenticated;
      setAuthenticated(isAuth);

      // 2. Get Settings
      const currentSettings = await sendMessage<LeetSyncSettings>(MessageType.GET_SETTINGS);
      if (currentSettings && currentSettings.repoOwner) {
        setSettings(currentSettings);
      }

      // 3. Get Recent Syncs
      const syncs = await sendMessage<RecentSync[]>(MessageType.GET_RECENT_SYNCS);
      if (Array.isArray(syncs)) {
        setRecentSyncs(syncs);
      }

      // Route view based on auth state
      if (!isAuth) {
        setView('auth');
      } else if (!currentSettings?.repoName) {
        setView('auth');
      } else {
        setView('dashboard');
      }
    } catch (err) {
      console.warn('[LeetSync] Standalone/Development mode fallback:', err);
      setAuthenticated(true);
      setView('dashboard');
    }
  };

  useEffect(() => {
    loadExtensionData();

    // Listen for storage changes to update UI live when submissions sync in background
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.leetsync_settings?.newValue) {
          setSettings(changes.leetsync_settings.newValue);
        }
        if (changes.leetsync_recent_syncs?.newValue) {
          setRecentSyncs(changes.leetsync_recent_syncs.newValue);
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
      return () => chrome.storage.onChanged.removeListener(storageListener);
    }
  }, []);

  // Auth Handlers
  const handleConnectGitHub = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await sendMessage<{ success: boolean; error?: string }>(MessageType.LOGIN_OAUTH);
      setIsLoggingIn(false);
      if (res?.success) {
        await loadExtensionData();
        addToast({ variant: 'success', title: 'Connected', message: 'Successfully authenticated with GitHub.' });
      } else {
        setAuthError(res?.error || 'OAuth login failed.');
      }
    } catch (err: any) {
      setIsLoggingIn(false);
      setAuthError(err.message || 'OAuth login failed.');
    }
  };

  const handleUsePAT = async (token: string) => {
    if (!token) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await sendMessage<{ success: boolean; error?: string }>(MessageType.LOGIN_PAT, { token });
      setIsLoggingIn(false);
      if (res?.success) {
        await loadExtensionData();
        addToast({ variant: 'success', title: 'Authenticated', message: 'PAT token verified.' });
      } else {
        setAuthError(res?.error || 'Invalid Personal Access Token.');
      }
    } catch (err: any) {
      setIsLoggingIn(false);
      setAuthError(err.message || 'Failed to authenticate token.');
    }
  };

  const handleAuthenticated = async (repo: string) => {
    const parts = repo.split('/');
    if (parts.length === 2) {
      await sendMessage(MessageType.SELECT_REPO, { owner: parts[0], name: parts[1] });
      await loadExtensionData();
      setView('dashboard');
      addToast({ variant: 'info', title: 'Repository Connected', message: `Synced to ${repo}.` });
    }
  };

  // Toggle Auto Sync
  const handleToggleAutoSync = async () => {
    const updated = await sendMessage<LeetSyncSettings>(MessageType.UPDATE_SETTINGS, {
      autoSync: !settings.autoSync,
    });
    if (updated) setSettings(updated);
  };

  const repoOwner = settings.repoOwner || 'mahavir717';
  const repoName = settings.repoName || 'leetcode-solutions';

  return (
    <div class={`mx-auto bg-bg-primary text-text-primary flex flex-col transition-all duration-300 ${
      viewportMode === 'popup' ? 'popup-mode border border-border shadow-modal rounded-xl overflow-hidden' :
      viewportMode === 'panel' ? 'panel-mode max-w-2xl border-x border-border min-h-screen' :
      'tab-mode max-w-5xl min-h-screen'
    }`}>
      {/* Top Header */}
      <TopHeader
        viewportMode={viewportMode}
        onToggleViewport={setViewportMode}
        authenticated={authenticated}
        username={repoOwner}
        onNavigateSettings={() => setView('settings')}
      />

      {/* Main View Router */}
      <main class="flex-1 relative overflow-hidden flex flex-col min-h-0">
        {view === 'loading' ? (
          <div class="flex-1 flex flex-col items-center justify-center gap-2 p-6">
            <div class="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            <p class="text-xs text-text-muted">Loading LeetSync...</p>
          </div>
        ) : !authenticated || view === 'auth' ? (
          <AuthView
            onAuthenticated={handleAuthenticated}
            onConnectGitHub={handleConnectGitHub}
            onUsePAT={handleUsePAT}
            isLoggingIn={isLoggingIn}
            error={authError}
          />
        ) : view === 'dashboard' ? (
          <DashboardView
            username={settings.githubUsername || repoOwner}
            repoOwner={repoOwner}
            repoName={repoName}
            autoSync={settings.autoSync}
            recentSyncs={recentSyncs}
            streakDays={settings.streak?.current ?? 14}
            totalSynced={recentSyncs.length > 0 ? recentSyncs.length : 342}
            onToggleAutoSync={handleToggleAutoSync}
            onNavigate={(v) => setView(v as any)}
            addToast={addToast}
          />
        ) : view === 'migration' ? (
          <MigrationView
            onNavigate={(v) => setView(v as any)}
            addToast={addToast}
          />
        ) : view === 'logs' ? (
          <LogsView
            onNavigate={(v) => setView(v as any)}
          />
        ) : view === 'stats' ? (
          <StatsView
            recentSyncs={recentSyncs}
            onNavigate={(v) => setView(v as any)}
          />
        ) : view === 'settings' ? (
          <SettingsView
            onNavigate={(v) => setView(v as any)}
            addToast={addToast}
          />
        ) : null}
      </main>

      {/* Floating Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
