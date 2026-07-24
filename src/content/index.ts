/**
 * LeetSync Content Script
 *
 * Runs on leetcode.com/problems/* pages.
 * Listens for submission details captured by our main-world script,
 * forwards them to background, and displays in-page celebration when GitHub sync succeeds.
 */

import { MessageType } from '@/utils/constants';
import type { LeetCodeSubmission } from '@/types';
import { showAcceptedAnimation } from '@/animation/accepted';
import { injectFolderPickerDialog, injectConflictResolutionDialog } from './prompt-injector';

console.log('[LeetSync] Content script loaded on:', window.location.href);

/**
 * Listen for submission events from our main-world network interceptor script.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const { type, data } = event.data ?? {};
  if (type !== 'LEETSYNC_SUBMISSION') return;

  console.log('[LeetSync] Submission intercepted by content script:', data);

  // Forward to background service worker safely
  try {
    if (!chrome.runtime?.id) {
      console.warn('[LeetSync] Extension context invalidated — please refresh the LeetCode tab to reconnect LeetSync.');
      return;
    }

    chrome.runtime.sendMessage(
      { type: MessageType.SUBMISSION_DETECTED, payload: data as LeetCodeSubmission },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[LeetSync] Background communication error (non-fatal):', chrome.runtime.lastError.message);
          return;
        }
        console.log('[LeetSync] Background response:', response);
      }
    );
  } catch (err: any) {
    console.warn('[LeetSync] Extension context disconnected:', err?.message || err);
  }
});

/**
 * Listen for messages from background service worker (e.g., SYNC_COMPLETED trigger).
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SYNC_COMPLETED') {
    console.log('[LeetSync] Received SYNC_COMPLETED event in content script');
    
    // Play 60 FPS Premium Accepted Animation (Pure celebration without code info)
    showAcceptedAnimation({
      title: 'ACCEPTED',
      subtitle: 'Repository Synced Successfully',
      github: true,
    });

    sendResponse({ received: true });
  }

  if (message?.type === 'FOLDER_SELECTION_REQUIRED') {
    console.log('[LeetSync] In-page folder selection required for:', message.payload.submission.title);
    injectFolderPickerDialog(message.payload.submission, (folder) => {
      chrome.storage.local.set({
        LEETSYNC_FOLDER_SELECTION_RESOLUTION: {
          submissionId: message.payload.submission.submissionId,
          selectedFolder: folder,
        }
      });
    });
    sendResponse({ received: true });
  }

  if (message?.type === 'COLLISION_DETECTED') {
    console.log('[LeetSync] In-page collision resolution required for:', message.payload.submission.title);
    injectConflictResolutionDialog(message.payload.submission, message.payload.existingSolutions || [], (action, label) => {
      chrome.storage.local.set({
        LEETSYNC_CONFLICT_RESOLUTION: {
          submissionId: message.payload.submission.submissionId,
          action,
          label,
        }
      });
    });
    sendResponse({ received: true });
  }
});
