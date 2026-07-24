/**
 * LottiePlayer.ts
 * Integrates lottie-web light renderer (CSP-compliant, no eval) to render Lottie animation JSON directly into the overlay container.
 */

import lottie from 'lottie-web/build/player/lottie_light';

export class LottiePlayer {
  private container: HTMLElement | null = null;
  private animationInstance: any = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Load and play Lottie animation from URL or JSON object.
   */
  async play(
    srcUrlOrData: string | Record<string, unknown>,
    loop: boolean = true,
    autoplay: boolean = true
  ): Promise<void> {
    if (!this.container) return;

    try {
      if (typeof srcUrlOrData === 'string') {
        this.animationInstance = lottie.loadAnimation({
          container: this.container,
          renderer: 'svg',
          loop,
          autoplay,
          path: srcUrlOrData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
          },
        });
      } else {
        this.animationInstance = lottie.loadAnimation({
          container: this.container,
          renderer: 'svg',
          loop,
          autoplay,
          animationData: srcUrlOrData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
          },
        });
      }
    } catch (error) {
      console.warn('[LeetSync LottiePlayer] Failed to load animation:', error);
    }
  }

  cleanup(): void {
    if (this.animationInstance?.destroy) {
      this.animationInstance.destroy();
    }
    this.animationInstance = null;
    this.container = null;
  }
}
