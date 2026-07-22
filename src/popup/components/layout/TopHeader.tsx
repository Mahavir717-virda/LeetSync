import { h } from 'preact';

export type ViewportMode = 'popup' | 'panel' | 'tab';

interface TopHeaderProps {
  viewportMode: ViewportMode;
  onToggleViewport: (mode: ViewportMode) => void;
  authenticated: boolean;
  username?: string;
  onNavigateSettings?: () => void;
}

export function TopHeader({ viewportMode, onToggleViewport, authenticated, username, onNavigateSettings }: TopHeaderProps) {
  return (
    <header class="flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border select-none">
      {/* Brand */}
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10B981" stroke-width="2">
            <path d="M9 3L5 7l4 4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="21" x2="12" y2="14" stroke-linecap="round"/>
            <circle cx="12" cy="14" r="1" fill="#10B981" stroke="none"/>
          </svg>
        </div>
        <span class="text-sm font-bold text-text-primary tracking-tight">LeetSync</span>
      </div>

      {/* Controls */}
      <div class="flex items-center gap-2">
        {/* Viewport switcher */}
        <div class="flex items-center bg-bg-tertiary border border-border rounded-lg p-0.5">
          <button
            onClick={() => onToggleViewport('popup')}
            title="Compact Popup Mode (380px)"
            class={`px-2 py-0.5 text-xs rounded transition-colors btn-press ${viewportMode === 'popup' ? 'bg-bg-secondary text-accent-blue font-medium shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Popup
          </button>
          <button
            onClick={() => onToggleViewport('panel')}
            title="Side Panel Mode (680px)"
            class={`px-2 py-0.5 text-xs rounded transition-colors btn-press ${viewportMode === 'panel' ? 'bg-bg-secondary text-accent-blue font-medium shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Panel
          </button>
          <button
            onClick={() => onToggleViewport('tab')}
            title="Full Tab Mode"
            class={`px-2 py-0.5 text-xs rounded transition-colors btn-press ${viewportMode === 'tab' ? 'bg-bg-secondary text-accent-blue font-medium shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Full
          </button>
        </div>

        {/* User / Settings Button */}
        {authenticated && (
          <button
            onClick={onNavigateSettings}
            title="Settings"
            class="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-text-muted transition-colors btn-press"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
