import { useState, useEffect } from 'preact/hooks';
import { MessageType } from '@/utils/constants';
import type { LeetSyncSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

type View = 'loading' | 'auth' | 'setup' | 'dashboard' | 'settings';

/**
 * Send a message to the background service worker.
 */
function sendMessage<T = any>(type: MessageType, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export function App() {
  const [view, setView] = useState<View>('loading');
  const [settings, setSettings] = useState<LeetSyncSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  // Load initial state
  useEffect(() => {
    (async () => {
      try {
        const authStatus = await sendMessage<{ authenticated: boolean; username: string | null }>(
          MessageType.GET_AUTH_STATUS
        );
        const currentSettings = await sendMessage<LeetSyncSettings>(MessageType.GET_SETTINGS);
        setSettings(currentSettings);

        if (!authStatus.authenticated) {
          setView('auth');
        } else if (!currentSettings.repoName) {
          setView('setup');
        } else {
          setView('dashboard');
        }
      } catch (err) {
        console.error('[LeetSync] Failed to load state:', err);
        setView('auth');
      }
    })();
  }, []);

  return (
    <div class="leetsync-popup">
      {/* Header */}
      <header class="header">
        <div class="header-brand">
          <svg class="header-logo" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 3L5 7l4 4" />
            <path d="M15 3l4 4-4 4" />
            <line x1="12" y1="21" x2="12" y2="14" />
            <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
          </svg>
          <h1 class="header-title">LeetSync</h1>
        </div>
        {view === 'dashboard' && (
          <button
            class="btn-icon"
            onClick={() => setView('settings')}
            title="Settings"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
        {view === 'settings' && (
          <button
            class="btn-icon"
            onClick={() => setView('dashboard')}
            title="Back"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </header>

      {/* Error Banner */}
      {error && (
        <div class="error-banner">
          <span>{error}</span>
          <button class="btn-icon btn-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Views */}
      <main class="main-content">
        {view === 'loading' && (
          <div class="center-content">
            <div class="spinner" />
            <p class="text-muted">Loading...</p>
          </div>
        )}

        {view === 'auth' && (
          <div class="auth-view">
            <div class="auth-hero">
              <svg class="auth-icon" viewBox="0 0 48 48" width="48" height="48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="8" fill="url(#grad)" />
                <path d="M16 20l4 4 8-8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M16 28h16" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.5" />
                <path d="M16 32h10" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.3" />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48">
                    <stop offset="0%" stop-color="#2ea043" />
                    <stop offset="100%" stop-color="#58a6ff" />
                  </linearGradient>
                </defs>
              </svg>
              <h2>Never lose a submission</h2>
              <p class="text-muted">Connect your GitHub to sync every LeetCode solution with full version history.</p>
            </div>

            <button
              class="btn btn-primary btn-github"
              onClick={async () => {
                setError(null);
                const result = await sendMessage(MessageType.LOGIN_OAUTH);
                if (result.success) setView('setup');
                else setError(result.error ?? 'OAuth login failed');
              }}
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Sign in with GitHub
            </button>

            <div class="divider">
              <span>or</span>
            </div>

            <div class="pat-section">
              <input
                type="password"
                id="pat-input"
                class="input"
                placeholder="Paste GitHub Personal Access Token"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const token = input.value.trim();
                    if (!token) return;
                    setError(null);
                    const result = await sendMessage(MessageType.LOGIN_PAT, { token });
                    if (result.success) setView('setup');
                    else setError(result.error ?? 'Invalid token');
                  }
                }}
              />
              <p class="text-hint">
                Need a token? <a href="https://github.com/settings/tokens/new?scopes=repo&description=LeetSync" target="_blank" rel="noopener">Create one here</a> with <code>repo</code> scope.
              </p>
            </div>
          </div>
        )}

        {view === 'setup' && (
          <div class="setup-view">
            <h2>Choose a Repository</h2>
            <p class="text-muted">Select an existing repo or create a new one for your solutions.</p>

            <button
              class="btn btn-primary"
              onClick={async () => {
                setError(null);
                const result = await sendMessage(MessageType.CREATE_REPO, {
                  name: 'leetcode-solutions',
                  isPrivate: false,
                });
                if (result.success) {
                  setView('dashboard');
                } else {
                  setError(result.error ?? 'Failed to create repo');
                }
              }}
            >
              + Create "leetcode-solutions"
            </button>

            <div class="text-hint" style={{ marginTop: '16px', textAlign: 'center' }}>
              <em>Repo selector coming in Phase 5</em>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div class="dashboard-view">
            {/* Connection Status */}
            <div class="status-card">
              <div class="status-row">
                <div class="status-indicator status-connected" />
                <div class="status-info">
                  <span class="status-username">{settings.githubUsername ?? 'Connected'}</span>
                  <span class="text-muted text-sm">
                    {settings.repoOwner}/{settings.repoName}
                  </span>
                </div>
                <div class={`sync-toggle ${settings.autoSync ? 'active' : ''}`}>
                  <span class="text-sm">{settings.autoSync ? 'Auto' : 'Off'}</span>
                  <div
                    class={`toggle ${settings.autoSync ? 'on' : ''}`}
                    onClick={async () => {
                      const updated = await sendMessage(MessageType.UPDATE_SETTINGS, {
                        autoSync: !settings.autoSync,
                      });
                      setSettings(updated);
                    }}
                  >
                    <div class="toggle-knob" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Syncs */}
            <div class="recent-section">
              <h3 class="section-title">Recent Syncs</h3>
              <div class="empty-state">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <p class="text-muted text-sm">No submissions synced yet.<br />Solve a problem on LeetCode to get started!</p>
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div class="settings-view">
            <h3 class="section-title">Settings</h3>

            <div class="setting-row">
              <div>
                <span class="setting-label">Sync Mode</span>
                <span class="text-muted text-sm">
                  {settings.syncMode === 'accepted_only' ? 'Only accepted solutions' : 'All submissions'}
                </span>
              </div>
              <select
                class="select"
                value={settings.syncMode}
                onChange={async (e) => {
                  const updated = await sendMessage(MessageType.UPDATE_SETTINGS, {
                    syncMode: (e.target as HTMLSelectElement).value,
                  });
                  setSettings(updated);
                }}
              >
                <option value="accepted_only">Accepted Only</option>
                <option value="all_submissions">All Submissions</option>
              </select>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">Folder Structure</span>
                <span class="text-muted text-sm">
                  How problems are organized in your repo
                </span>
              </div>
              <select
                class="select"
                value={settings.folderStructure || 'Topic'}
                onChange={async (e) => {
                  const updated = await sendMessage(MessageType.UPDATE_SETTINGS, {
                    folderStructure: (e.target as HTMLSelectElement).value,
                  });
                  setSettings(updated);
                }}
              >
                <option value="Topic">Topic (e.g. Array)</option>
                <option value="Difficulty">Difficulty (e.g. Easy)</option>
                <option value="Topic/Difficulty">Topic / Difficulty</option>
                <option value="Flat">Flat (No folders)</option>
              </select>
            </div>

            <div class="setting-row">
              <div>
                <span class="setting-label">Notifications</span>
                <span class="text-muted text-sm">Desktop alerts on sync</span>
              </div>
              <div
                class={`toggle ${settings.notifications ? 'on' : ''}`}
                onClick={async () => {
                  const updated = await sendMessage(MessageType.UPDATE_SETTINGS, {
                    notifications: !settings.notifications,
                  });
                  setSettings(updated);
                }}
              >
                <div class="toggle-knob" />
              </div>
            </div>

            <hr class="divider-line" />

            <div class="setting-row">
              <div>
                <span class="setting-label">Account</span>
                <span class="text-muted text-sm">{settings.githubUsername ?? 'Not connected'}</span>
              </div>
              <button
                class="btn btn-danger btn-sm"
                onClick={async () => {
                  await sendMessage(MessageType.LOGOUT);
                  setView('auth');
                  setSettings(DEFAULT_SETTINGS);
                }}
              >
                Disconnect
              </button>
            </div>

            <div class="version-info">
              <span class="text-muted text-xs">LeetSync v1.0.0</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
