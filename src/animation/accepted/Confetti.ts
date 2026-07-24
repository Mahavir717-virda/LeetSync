/**
 * Confetti.ts
 * GPU-accelerated dual-burst confetti engine using canvas-confetti.
 * High-performance, 60 FPS, respects prefers-reduced-motion.
 */

import confetti from 'canvas-confetti';

export interface ConfettiOptions {
  particleCount?: number;
  colors?: string[];
  durationMs?: number;
}

export class ConfettiLauncher {
  private isReducedMotion: boolean;

  constructor() {
    this.isReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Launch a dual-side celebratory confetti burst at ~500ms mark.
   */
  launch(options: ConfettiOptions = {}): void {
    if (this.isReducedMotion) {
      console.log('[LeetSync Confetti] Reduced motion enabled — skipping particle burst');
      return;
    }

    const colors = options.colors ?? ['#F59E0B', '#FFFFFF', '#3B82F6', '#10B981'];
    const totalParticles = options.particleCount ?? 150;
    const countPerSide = Math.floor(totalParticles / 2);

    // Left Burst
    confetti({
      particleCount: countPerSide,
      angle: 60,
      spread: 55,
      origin: { x: 0.15, y: 0.65 },
      colors,
      ticks: 200,
      gravity: 1.1,
      scalar: 1.0,
      drift: 0,
      zIndex: 99999999,
    });

    // Right Burst
    confetti({
      particleCount: countPerSide,
      angle: 120,
      spread: 55,
      origin: { x: 0.85, y: 0.65 },
      colors,
      ticks: 200,
      gravity: 1.1,
      scalar: 1.0,
      drift: 0,
      zIndex: 99999999,
    });
  }

  /**
   * Clean up any active confetti canvases.
   */
  cleanup(): void {
    try {
      confetti.reset();
    } catch (_) {}
  }
}
