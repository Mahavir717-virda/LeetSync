import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Spinner } from '../ui/index';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_REPOS = [
  { id: 1, full_name: 'mahavir717/leetcode-solutions',  private: false, stars: 12, description: 'My LeetCode journey' },
  { id: 2, full_name: 'mahavir717/algo-practice',       private: false, stars: 3,  description: 'DSA practice problems' },
  { id: 3, full_name: 'mahavir717/dsa-prep',            private: true,  stars: 0,  description: 'Private prep repo' },
  { id: 4, full_name: 'mahavir717/competitive-coding',  private: false, stars: 7,  description: 'Competitive programming' },
];

interface AuthViewProps {
  onAuthenticated: (repo: string) => void;
  onConnectGitHub: () => Promise<void>;
  onUsePAT: (token: string) => Promise<void>;
  isLoggingIn: boolean;
  error?: string | null;
}

export function AuthView({ onAuthenticated, onConnectGitHub, onUsePAT, isLoggingIn, error }: AuthViewProps) {
  const [patValue, setPatValue] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [showRepos, setShowRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('leetcode-solutions');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);

  const filteredRepos = MOCK_REPOS.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const handleContinue = () => {
    if (selectedRepo) onAuthenticated(selectedRepo);
  };

  return (
    <div class="flex flex-col gap-5 p-4 animate-slide-in-right">
      {/* Hero */}
      <div class="flex flex-col items-center gap-3 pt-4 text-center">
        {/* Logo */}
        <div class="relative w-14 h-14">
          <div class="w-14 h-14 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10B981" stroke-width="1.8">
              <path d="M9 3L5 7l4 4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="21" x2="12" y2="14" stroke-linecap="round"/>
              <circle cx="12" cy="14" r="1.5" fill="#10B981" stroke="none"/>
            </svg>
          </div>
          <span class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </span>
        </div>
        <div>
          <h1 class="text-base font-bold text-text-primary">LeetSync</h1>
          <p class="text-xs text-text-secondary mt-0.5">Seamlessly Sync LeetCode to GitHub</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div class="bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* OAuth Button */}
      <button
        onClick={onConnectGitHub}
        disabled={isLoggingIn}
        class="w-full flex items-center justify-center gap-2.5 bg-bg-secondary border border-border text-text-primary text-sm font-medium py-2.5 rounded-xl hover:border-border hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 btn-press disabled:opacity-50"
      >
        {isLoggingIn ? (
          <><Spinner size={15} /><span class="text-text-secondary">Connecting...</span></>
        ) : (
          <>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Connect GitHub Account
          </>
        )}
      </button>

      {/* Divider */}
      <div class="flex items-center gap-3">
        <div class="flex-1 h-px bg-border" />
        <span class="text-xs text-text-muted">or use PAT</span>
        <div class="flex-1 h-px bg-border" />
      </div>

      {/* PAT Input */}
      <div class="flex flex-col gap-1.5">
        <input
          type="password"
          placeholder="ghp_xxxxxxxxxxxx Personal Access Token"
          value={patValue}
          onInput={(e) => setPatValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && onUsePAT(patValue)}
          class="w-full bg-bg-tertiary border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted font-mono focus:outline-none focus:border-accent-blue/60 transition-colors"
        />
        <a
          href="https://github.com/settings/tokens/new?scopes=repo&description=LeetSync"
          target="_blank" rel="noopener"
          class="text-xs text-accent-blue hover:underline self-start"
        >
          Create token with repo scope ↗
        </a>
      </div>

      {/* Mock Account Preview — shows after "connecting" */}
      <div class="ls-card">
        <div class="flex items-center gap-2.5">
          <img
            src="https://avatars.githubusercontent.com/u/1?v=4"
            alt="avatar"
            class="w-7 h-7 rounded-full border border-border"
            onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="%2321262d"/><text x="12" y="17" text-anchor="middle" fill="%238B949E" font-size="12">M</text></svg>'; }}
          />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-text-primary">mahavir717</p>
            <p class="text-xs text-text-muted">GitHub Account</p>
          </div>
          <span class="flex items-center gap-1 text-xs text-emerald-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        </div>

        {/* Repo Selector */}
        <div class="mt-3 border-t border-border pt-3">
          <p class="text-xs text-text-muted mb-2">Select repository to sync into</p>

          {/* Dropdown trigger */}
          <div
            class="relative"
            onClick={() => setShowRepos(!showRepos)}
          >
            <div class="flex items-center justify-between bg-bg-tertiary border border-border rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-text-muted transition-colors">
              <span class="text-xs text-text-primary truncate">
                {selectedRepo || 'Choose a repository…'}
              </span>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class={`shrink-0 transition-transform ${showRepos ? 'rotate-180' : ''}`}>
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </div>

            {showRepos && (
              <div class="absolute top-full mt-1 left-0 right-0 bg-bg-secondary border border-border rounded-xl shadow-modal z-20 overflow-hidden animate-slide-up">
                <div class="p-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Search repos…"
                    value={repoSearch}
                    onInput={(e) => { e.stopPropagation(); setRepoSearch((e.target as HTMLInputElement).value); }}
                    onClick={(e) => e.stopPropagation()}
                    class="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/60"
                  />
                </div>
                <div class="max-h-36 overflow-y-auto">
                  {filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedRepo(repo.full_name); setShowRepos(false); setRepoSearch(''); }}
                      class={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-tertiary transition-colors ${selectedRepo === repo.full_name ? 'bg-bg-tertiary' : ''}`}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" class="text-text-muted shrink-0">
                        <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/>
                      </svg>
                      <span class="text-xs text-text-primary truncate flex-1">{repo.full_name}</span>
                      {repo.private && <span class="text-xs text-text-muted">🔒</span>}
                      {selectedRepo === repo.full_name && <span class="text-emerald-400 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); setShowRepos(false); }}
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent-blue hover:bg-bg-tertiary transition-colors border-t border-border"
                >
                  <span>+</span> Create New Repository
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Continue CTA */}
      <button
        onClick={handleContinue}
        disabled={!selectedRepo}
        class={`
          w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 btn-press
          ${selectedRepo
            ? 'bg-accent-blue text-white hover:bg-blue-500 shadow-blue-glow animate-fade-in'
            : 'bg-bg-tertiary text-text-muted cursor-not-allowed border border-border'
          }
        `}
      >
        Continue to Dashboard →
      </button>

      {/* Create Repo Modal */}
      {showCreateModal && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div class="bg-bg-secondary border border-border rounded-2xl p-5 w-72 shadow-modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-sm font-semibold text-text-primary mb-4">Create New Repository</h3>
            <div class="flex flex-col gap-3">
              <div>
                <label class="text-xs text-text-muted mb-1 block">Repository Name</label>
                <input
                  type="text"
                  value={newRepoName}
                  onInput={(e) => setNewRepoName((e.target as HTMLInputElement).value)}
                  class="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue/60"
                />
              </div>
              <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!newRepoPrivate} onChange={() => setNewRepoPrivate(false)} class="accent-accent-blue" />
                  <span class="text-xs text-text-secondary">Public</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={newRepoPrivate} onChange={() => setNewRepoPrivate(true)} class="accent-accent-blue" />
                  <span class="text-xs text-text-secondary">Private</span>
                </label>
              </div>
            </div>
            <div class="flex gap-2 mt-4">
              <button onClick={() => setShowCreateModal(false)} class="flex-1 text-xs border border-border text-text-secondary rounded-lg py-2 hover:bg-bg-tertiary transition-colors btn-press">Cancel</button>
              <button
                onClick={() => {
                  const fullName = `mahavir717/${newRepoName}`;
                  setSelectedRepo(fullName);
                  setShowCreateModal(false);
                }}
                class="flex-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg py-2 hover:bg-emerald-500/20 transition-colors btn-press"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
