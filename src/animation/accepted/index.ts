/**
 * src/animation/accepted/index.ts
 * Public entrypoint for the Accepted Celebration Animation system.
 */

export {
  showAcceptedAnimation,
  hideAcceptedAnimation,
  destroyAcceptedAnimation,
} from './AcceptedAnimation';

export { AcceptedOverlayManager } from './Overlay';
export type { AcceptedOverlayOptions } from './Overlay';
export { ConfettiLauncher } from './Confetti';
export type { ConfettiOptions } from './Confetti';
export { LottiePlayer } from './LottiePlayer';
