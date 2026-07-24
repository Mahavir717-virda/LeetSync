/**
 * AcceptedAnimation.ts
 * Main orchestrator for the Accepted Celebration Animation system.
 * Exposes clean, high-level, promise-based public API for content scripts.
 */

import { AcceptedOverlayManager, AcceptedOverlayOptions } from './Overlay';
import './styles.css';

/**
 * Show the premium 60 FPS Accepted Celebration Animation.
 * Returns a Promise that resolves when the animation and cleanup complete at 2200ms.
 */
export function showAcceptedAnimation(
  options: AcceptedOverlayOptions = {}
): Promise<void> {
  return new Promise<void>((resolve) => {
    const manager = AcceptedOverlayManager.getInstance();
    manager.show({
      ...options,
      onComplete: () => {
        if (options.onComplete) {
          options.onComplete();
        }
        resolve();
      },
    });
  });
}

/**
 * Programmatically fade out the active animation.
 */
export function hideAcceptedAnimation(): void {
  const manager = AcceptedOverlayManager.getInstance();
  manager.hide();
}

/**
 * Instantly destroy active animation DOM elements and clear timers.
 */
export function destroyAcceptedAnimation(): void {
  const manager = AcceptedOverlayManager.getInstance();
  manager.destroy();
}
