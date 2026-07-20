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

  const SUBMISSION_CHECK_PATTERN = /\/submissions\/detail\/(\d+)\/(?:v2\/)?check\//;
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
      let url = '';
      let body = '';

      if (args[0] instanceof Request) {
        url = args[0].url;
        try {
          const clonedReq = args[0].clone();
          body = await clonedReq.text();
        } catch (_) {}
      } else {
        url = typeof args[0] === 'string' ? args[0] : '';
        const options = args[1];
        if (options && options.body) {
          body = typeof options.body === 'string' ? options.body : '';
        }
      }

      // Debug log for every intercepted request to help diagnose the LeetCode query
      if (url.includes('/graphql') || url.includes('/submissions/')) {
        const queryName = body.includes('operationName') 
          ? (body.match(/"operationName"\s*:\s*"([^"]+)"/) || [])[1] 
          : 'non-graphql';
        console.log(`[LeetSync Interceptor] Intercepted request: URL=${url}, operationName=${queryName || 'unknown'}`);
      }

      // Check if this is a submission check response
      const submissionMatch = url.match(SUBMISSION_CHECK_PATTERN);
      if (submissionMatch) {
        console.log(`[LeetSync Interceptor] Found submission check REST request for ID: ${submissionMatch[1]}`);
        const cloned = response.clone();
        cloned.json().then((data: any) => {
          if (data && data.state === 'SUCCESS') {
            handleSubmissionResponse(data, submissionMatch[1]);
          }
        }).catch(() => { /* ignore parse errors */ });
      }

      // Check if this is a GraphQL submissionDetails query
      if (url.includes(GRAPHQL_URL) && body.includes('submissionDetails')) {
        console.log('[LeetSync Interceptor] Found submissionDetails GraphQL query!');
        const cloned = response.clone();
        cloned.json().then((data: any) => {
          if (data?.data?.submissionDetails) {
            handleGraphQLSubmission(data.data.submissionDetails);
          }
        }).catch(() => { /* ignore parse errors */ });
      }
    } catch (e) {
      // Never break the page — silently ignore interceptor errors
      console.debug('[LeetSync] Interceptor error (non-fatal):', e);
    }

    return response;
  };

  /**
   * Monkey-patch XMLHttpRequest to intercept older XHR polling requests.
   */
  const originalXHR = window.XMLHttpRequest;
  (window as any).XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = '';

    xhr.open = function (method: string, url: string | URL, ...args: any[]) {
      requestUrl = typeof url === 'string' ? url : (url as URL).href;
      if (requestUrl.includes('/graphql') || requestUrl.includes('/submissions/')) {
        console.log(`[LeetSync Interceptor] Intercepted XHR request: URL=${requestUrl}`);
      }
      return originalOpen.apply(this, [method, url, ...args] as any);
    };

    xhr.send = function (body?: any) {
      xhr.addEventListener('load', function () {
        try {
          if (requestUrl.includes('/graphql') || requestUrl.includes('/submissions/')) {
            console.log(`[LeetSync Interceptor] XHR request loaded: URL=${requestUrl}, status=${xhr.status}`);
          }
          const submissionMatch = requestUrl.match(SUBMISSION_CHECK_PATTERN);
          if (submissionMatch && xhr.status === 200) {
            console.log(`[LeetSync Interceptor] Found submission check XHR request for ID: ${submissionMatch[1]}`);
            const data = JSON.parse(xhr.responseText);
            if (data && data.state === 'SUCCESS') {
              handleSubmissionResponse(data, submissionMatch[1]);
            }
          }
        } catch (e) {
          // Silently ignore XHR response parse errors
        }
      });
      return originalSend.apply(this, [body]);
    };

    return xhr;
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
