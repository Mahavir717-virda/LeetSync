/**
 * LeetSync Network Interceptor — Executes in MAIN world
 *
 * Monkey-patches window.fetch to intercept LeetCode's internal
 * submission check responses. Because this script is declared
 * with "world": "MAIN" in the manifest, it executes directly
 * in the page context without violating Content Security Policy (CSP).
 */

(function () {
  'use strict';

  // Avoid double-injection
  if ((window as any).__LEETSYNC_INJECTED__) return;
  (window as any).__LEETSYNC_INJECTED__ = true;

  const SUBMISSION_CHECK_PATTERN = /\/submissions\/detail\/(\d+)\/check\//;
  const GRAPHQL_URL = '/graphql';

  // Track seen submission IDs to deduplicate
  const seenSubmissions = new Set<string>();

  /**
   * Monkey-patch window.fetch to intercept responses.
   */
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

      // Check if this is a submission check response
      const submissionMatch = url.match(SUBMISSION_CHECK_PATTERN);
      if (submissionMatch) {
        const cloned = response.clone();
        cloned.json().then((data: any) => {
          if (data && data.state === 'SUCCESS') {
            handleSubmissionResponse(data, submissionMatch[1]);
          }
        }).catch(() => { /* ignore parse errors */ });
      }

      // Check if this is a GraphQL submissionDetails query
      if (url.includes(GRAPHQL_URL) && args[1]?.body) {
        const body = typeof args[1].body === 'string' ? args[1].body : '';
        if (body.includes('submissionDetails')) {
          const cloned = response.clone();
          cloned.json().then((data: any) => {
            if (data?.data?.submissionDetails) {
              handleGraphQLSubmission(data.data.submissionDetails);
            }
          }).catch(() => { /* ignore parse errors */ });
        }
      }
    } catch (e) {
      // Never break the page — silently ignore interceptor errors
      console.debug('[LeetSync] Interceptor error (non-fatal):', e);
    }

    return response;
  };

  /**
   * Handle a submission check API response (/submissions/detail/{id}/check/).
   */
  function handleSubmissionResponse(data: any, submissionId: string): void {
    if (seenSubmissions.has(submissionId)) return;
    seenSubmissions.add(submissionId);

    // Only process completed submissions
    if (data.status_display !== 'Accepted' && !data.status_display) return;

    const submission = {
      submissionId,
      titleSlug: data.question_id ? extractSlugFromPage() : '',
      title: extractTitleFromPage(),
      questionNumber: 0, // Will be enriched later
      difficulty: '' as any,
      tags: [] as string[],
      language: data.lang ?? '',
      code: data.code ?? data.typed_code ?? '',
      status: data.status_display ?? 'Unknown',
      runtime: data.status_runtime ?? '',
      runtimePercentile: data.runtime_percentile ?? 0,
      memory: data.status_memory ?? '',
      memoryPercentile: data.memory_percentile ?? 0,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    if (!submission.code || !submission.language) {
      return;
    }

    console.log('[LeetSync] Submission captured:', submission);
    window.postMessage({ type: 'LEETSYNC_SUBMISSION', data: submission }, '*');
  }

  /**
   * Handle a GraphQL submissionDetails response.
   */
  function handleGraphQLSubmission(details: any): void {
    const submissionId = String(details.id ?? details.submissionId ?? '');
    if (!submissionId || seenSubmissions.has(submissionId)) return;
    seenSubmissions.add(submissionId);

    const submission = {
      submissionId,
      titleSlug: details.question?.titleSlug ?? extractSlugFromPage(),
      title: details.question?.title ?? extractTitleFromPage(),
      questionNumber: parseInt(details.question?.questionFrontendId ?? '0', 10),
      difficulty: details.question?.difficulty ?? '',
      tags: (details.question?.topicTags ?? []).map((t: any) => t.name ?? t.slug),
      language: details.lang?.name ?? details.lang ?? '',
      code: details.code ?? '',
      status: details.statusDisplay ?? '',
      runtime: details.runtimeDisplay ?? details.runtime ?? '',
      runtimePercentile: details.runtimePercentile ?? 0,
      memory: details.memoryDisplay ?? details.memory ?? '',
      memoryPercentile: details.memoryPercentile ?? 0,
      timestamp: details.timestamp
        ? new Date(details.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      url: window.location.href,
    };

    if (!submission.code || !submission.language) {
      return;
    }

    console.log('[LeetSync] GraphQL submission captured:', submission);
    window.postMessage({ type: 'LEETSYNC_SUBMISSION', data: submission }, '*');
  }

  function extractSlugFromPage(): string {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match?.[1] ?? '';
  }

  function extractTitleFromPage(): string {
    const titleEl =
      document.querySelector('[data-cy="question-title"]') ??
      document.querySelector('.text-title-large') ??
      document.querySelector('h4[class*="title"]') ??
      document.querySelector('div[class*="question-title"]');
    return titleEl?.textContent?.trim() ?? '';
  }

  console.log('[LeetSync] Main world network interceptor active');
})();
