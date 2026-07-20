/**
 * LeetSync Content Script
 *
 * Runs on leetcode.com/problems/* pages.
 * Listens for submission details captured by our main-world script,
 * and forwards them to the background service worker.
 */

import { MessageType } from '@/utils/constants';
import type { LeetCodeSubmission } from '@/types';

console.log('[LeetSync] Content script loaded on:', window.location.href);

/**
 * Listen for messages from our main-world script.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const { type, data } = event.data ?? {};
  if (type !== 'LEETSYNC_SUBMISSION') return;

  console.log('[LeetSync] Submission intercepted by content script:', data);

  // Forward to background service worker
  chrome.runtime.sendMessage(
    { type: MessageType.SUBMISSION_DETECTED, payload: data as LeetCodeSubmission },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LeetSync] Error sending to background:', chrome.runtime.lastError.message);
        return;
      }
      console.log('[LeetSync] Background response:', response);
    }
  );
});
