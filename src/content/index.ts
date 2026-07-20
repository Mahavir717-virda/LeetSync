/**
 * LeetSync Content Script
 *
 * Runs on leetcode.com/problems/* pages.
 * Injects the network interceptor into the page context and
 * relays detected submissions to the background service worker.
 */

import { MessageType } from '@/utils/constants';
import type { LeetCodeSubmission } from '@/types';

console.log('[LeetSync] Content script loaded on:', window.location.href);

/**
 * Listen for messages from the injected page-context script.
 * The injector posts submission data via window.postMessage.
 */
window.addEventListener('message', (event) => {
  // Only accept messages from the same window (our injected script)
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

/**
 * Inject the network interceptor script into the page context.
 * This runs in the MAIN world (not the content script isolated world),
 * so it can monkey-patch window.fetch and XMLHttpRequest.
 */
function injectInterceptor(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    script.remove();
    console.log('[LeetSync] Interceptor injected into page context');
  };
}

// Inject as early as possible (run_at: document_start)
injectInterceptor();
