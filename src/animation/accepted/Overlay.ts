/**
 * Overlay.ts
 * Single-instance celebration overlay rendering ONLY the Flying Golden Trophy Lottie animation
 * (https://lottie.host/77b65814-00a1-49bb-820a-17028bd0d4d0/gmqk1xs4LO.json)
 * with zero code metadata and complete memory-leak-free teardown.
 */

import { ConfettiLauncher } from './Confetti';
import { LottiePlayer } from './LottiePlayer';

export const TROPHY_LOTTIE_URL = 'https://lottie.host/77b65814-00a1-49bb-820a-17028bd0d4d0/gmqk1xs4LO.json';

export interface AcceptedOverlayOptions {
  title?: string;
  subtitle?: string;
  github?: boolean;
  lottieSrc?: string;
  onComplete?: () => void;
}

export class AcceptedOverlayManager {
  private static instance: AcceptedOverlayManager | null = null;
  private container: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private githubBadge: HTMLElement | null = null;
  private lottieContainer: HTMLElement | null = null;
  private confettiLauncher: ConfettiLauncher;
  private lottiePlayer: LottiePlayer | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private isDestroyed: boolean = false;

  private constructor() {
    this.confettiLauncher = new ConfettiLauncher();
  }

  /**
   * Get Singleton instance of AcceptedOverlayManager.
   */
  public static getInstance(): AcceptedOverlayManager {
    if (!AcceptedOverlayManager.instance) {
      AcceptedOverlayManager.instance = new AcceptedOverlayManager();
    }
    return AcceptedOverlayManager.instance;
  }

  /**
   * Show the Accepted Celebration Overlay featuring the Flying Golden Trophy animation.
   */
  public show(options: AcceptedOverlayOptions = {}): void {
    this.destroy();
    this.isDestroyed = false;

    // Use strictly the Flying Trophy Lottie URL
    const lottieSrc = options.lottieSrc ?? TROPHY_LOTTIE_URL;

    // 0 ms: Create fullscreen overlay
    this.buildDOM(options);

    if (!this.container || !this.card || !this.lottieContainer) return;

    // Initialize DotLottie player for Trophy
    this.lottiePlayer = new LottiePlayer(this.lottieContainer);
    this.lottiePlayer.play(lottieSrc, true, true);

    // Trigger overlay fade-in (0 ms)
    requestAnimationFrame(() => {
      if (this.container) {
        this.container.classList.add('ls-active');
      }
    });

    // 150 ms: Animate card into center
    this.addTimer(() => {
      if (this.card && !this.isDestroyed) {
        this.card.classList.add('ls-card-visible');
      }
    }, 150);

    // 350 ms: Flying Trophy animation trigger
    this.addTimer(() => {
      if (this.lottieContainer && !this.isDestroyed) {
        this.lottieContainer.classList.add('ls-trophy-fly-in');
      }
    }, 350);

    // 500 ms: Dual-side Confetti burst
    this.addTimer(() => {
      if (!this.isDestroyed) {
        this.confettiLauncher.launch();
      }
    }, 500);

    // 700 ms: GitHub Sync Badge slide-in
    this.addTimer(() => {
      if (this.githubBadge && !this.isDestroyed) {
        this.githubBadge.classList.add('ls-badge-visible');
      }
    }, 700);

    // 1500 ms: Subtle card pulse
    this.addTimer(() => {
      if (this.card && !this.isDestroyed) {
        this.card.classList.add('ls-card-pulse');
      }
    }, 1500);

    // 3200 ms: Fade away & Complete DOM Cleanup
    this.addTimer(() => {
      this.hide(() => {
        if (options.onComplete) {
          options.onComplete();
        }
      });
    }, 3200);
  }

  /**
   * Smoothly fade out the overlay and trigger completion callback.
   */
  public hide(callback?: () => void): void {
    if (!this.container) return;

    this.container.classList.remove('ls-active');
    this.container.classList.add('ls-fading');

    const hideTimer = setTimeout(() => {
      this.destroy();
      if (callback) callback();
    }, 300);

    this.timers.push(hideTimer);
  }

  /**
   * Completely destroy the overlay, clear timers, remove DOM nodes, prevent memory leaks.
   */
  public destroy(): void {
    this.isDestroyed = true;

    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];

    if (this.lottiePlayer) {
      this.lottiePlayer.cleanup();
      this.lottiePlayer = null;
    }
    this.confettiLauncher.cleanup();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.card = null;
    this.githubBadge = null;
    this.lottieContainer = null;
  }

  /**
   * Construct DOM structure with zero code metadata.
   */
  private buildDOM(options: AcceptedOverlayOptions): void {
    const container = document.createElement('div');
    container.id = 'leetsync-accepted-overlay';

    const title = options.title ?? 'ACCEPTED';
    const subtitle = options.subtitle ?? 'Repository Synced Successfully';
    const showGithub = options.github ?? true;

    container.innerHTML = `
      <div class="ls-accepted-card">
        <!-- Flying Trophy Lottie Animation Container -->
        <div class="ls-lottie-container"></div>

        <!-- Headings -->
        <h2 class="ls-accepted-title">${this.escapeHtml(title)}</h2>
        <p class="ls-accepted-subtitle">${this.escapeHtml(subtitle)}</p>

        <!-- 700 ms GitHub Badge -->
        ${
          showGithub
            ? `
          <div class="ls-github-badge">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span>GitHub ✓</span>
          </div>
        `
            : ''
        }
      </div>
    `;

    document.body.appendChild(container);

    this.container = container;
    this.card = container.querySelector('.ls-accepted-card');
    this.githubBadge = container.querySelector('.ls-github-badge');
    this.lottieContainer = container.querySelector('.ls-lottie-container');
  }

  private addTimer(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      if (!this.isDestroyed) {
        fn();
      }
    }, ms);
    this.timers.push(timer);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
