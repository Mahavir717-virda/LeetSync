import { h } from 'preact';
import { useState } from 'preact/hooks';
import { TopHeader, ViewportMode } from './components/layout/TopHeader';
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { MigrationView } from './components/views/MigrationView';
import { LogsView } from './components/views/LogsView';
import { StatsView } from './components/views/StatsView';
import { SettingsView } from './components/views/SettingsView';
import { ToastContainer, useToast } from './components/ui/dialogs';

export function App() {
  const [view, setView] = useState<'auth' | 'dashboard' | 'migration' | 'logs' | 'stats' | 'settings'>('dashboard');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('popup');
  const [authenticated, setAuthenticated] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState('mahavir717/leetcode-solutions');
  const [autoSync, setAutoSync] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { toasts, add: addToast, remove: removeToast } = useToast();

  const handleConnectGitHub = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    setTimeout(() => {
      setIsLoggingIn(false);
      setAuthenticated(true);
      addToast({ variant: 'success', title: 'Connected', message: 'Successfully authenticated with GitHub.' });
    }, 1500);
  };

  const handleUsePAT = async (token: string) => {
    if (!token.startsWith('ghp_') && token.length < 10) {
      setAuthError('Invalid Personal Access Token format.');
      return;
    }
    setIsLoggingIn(true);
    setAuthError(null);
    setTimeout(() => {
      setIsLoggingIn(false);
      setAuthenticated(true);
      addToast({ variant: 'success', title: 'Authenticated', message: 'PAT token accepted.' });
    }, 1000);
  };

  const handleAuthenticated = (repo: string) => {
    setSelectedRepo(repo);
    setView('dashboard');
    addToast({ variant: 'info', title: 'Repository Set', message: `Target repository set to ${repo}.` });
  };

  const repoParts = selectedRepo.split('/');
  const repoOwner = repoParts[0] || 'mahavir717';
  const repoName = repoParts[1] || 'leetcode-solutions';

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
      <main class="flex-1 relative overflow-hidden flex flex-col">
        {!authenticated || view === 'auth' ? (
          <AuthView
            onAuthenticated={handleAuthenticated}
            onConnectGitHub={handleConnectGitHub}
            onUsePAT={handleUsePAT}
            isLoggingIn={isLoggingIn}
            error={authError}
          />
        ) : view === 'dashboard' ? (
          <DashboardView
            username={repoOwner}
            repoOwner={repoOwner}
            repoName={repoName}
            autoSync={autoSync}
            onToggleAutoSync={() => setAutoSync(!autoSync)}
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
