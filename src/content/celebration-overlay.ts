/**
 * celebration-overlay.ts
 * Forwarder for in-page accepted celebration triggers.
 */

import { showAcceptedAnimation } from '@/animation/accepted';

export interface CelebrationData {
  problemTitle?: string;
  problemSlug?: string;
  commitSha?: string;
  repoOwner?: string;
  repoName?: string;
  difficulty?: string;
  language?: string;
}

/**
 * Trigger celebration animation on accepted sync completion.
 */
export function triggerInPageCelebration(_data?: CelebrationData): void {
  showAcceptedAnimation({
    title: 'ACCEPTED',
    subtitle: 'Repository Synced Successfully',
    github: true,
  });
}
