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
        console.log(`[LeetSync Interceptor] Intercepted request: URL=${url}, body=${body.substring(0, 300)}`);
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
        }).catch((e) => console.error('[LeetSync] Error parsing submission check:', e));
      }

      // Check if this is a GraphQL submissionDetails query
      if (url.includes(GRAPHQL_URL) && body.includes('submissionDetails')) {
        console.log('[LeetSync Interceptor] Found submissionDetails GraphQL query!');
        const cloned = response.clone();
        cloned.json().then((data: any) => {
          if (data?.data?.submissionDetails) {
            handleGraphQLSubmission(data.data.submissionDetails, body);
          }
        }).catch((e) => console.error('[LeetSync] Error parsing GraphQL details:', e));
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
      xhr.addEventListener('load', async function () {
        try {
          let responseText = '';
          if (xhr.responseType === 'blob') {
            responseText = await (xhr.response as Blob).text();
          } else if (xhr.responseType === 'json') {
            responseText = JSON.stringify(xhr.response);
          } else if (xhr.responseType === 'arraybuffer') {
            responseText = new TextDecoder('utf-8').decode(xhr.response);
          } else {
            responseText = xhr.responseText;
          }

          if (requestUrl.includes('/graphql') || requestUrl.includes('/submissions/')) {
            const bodyStr = typeof body === 'string' ? body : '';
            console.log(`[LeetSync Interceptor] XHR request loaded: URL=${requestUrl}, status=${xhr.status}, body=${bodyStr.substring(0, 300)}`);
          }
          const submissionMatch = requestUrl.match(SUBMISSION_CHECK_PATTERN);
          if (submissionMatch && xhr.status === 200) {
            console.log(`[LeetSync Interceptor] Found submission check XHR request for ID: ${submissionMatch[1]}`);
            const data = JSON.parse(responseText);
            if (data && data.state === 'SUCCESS') {
              handleSubmissionResponse(data, submissionMatch[1]);
            }
          }

          // Check if this is a GraphQL submissionDetails query in XHR
          const bodyStr = typeof body === 'string' ? body : '';
          if (requestUrl.includes(GRAPHQL_URL) && bodyStr.includes('submissionDetails') && xhr.status === 200) {
            console.log('[LeetSync Interceptor] Found submissionDetails GraphQL query in XHR!');
            const responseData = JSON.parse(responseText);
            if (responseData?.data?.submissionDetails) {
              handleGraphQLSubmission(responseData.data.submissionDetails, bodyStr);
            }
          }
        } catch (e) {
          // Do not silently ignore! Print the error so we can debug!
          console.error('[LeetSync] Error in XHR interceptor:', e);
        }
      });
      return originalSend.apply(this, [body]);
    };

    return xhr;
  };

  const pendingSubmissions = new Map<string, any>();
  const submissionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const activeFetches = new Set<string>();

  function isSubmissionReady(sub: any): boolean {
    return Boolean(
      sub.code &&
      sub.language &&
      sub.status &&
      sub.questionNumber > 0 &&
      sub.difficulty &&
      sub.tags && sub.tags.length > 0
    );
  }

  function dispatchSubmission(submissionId: string, sub: any, isPartial: boolean = false) {
    if (seenSubmissions.has(submissionId)) return;
    
    seenSubmissions.add(submissionId);
    pendingSubmissions.delete(submissionId);
    if (submissionTimeouts.has(submissionId)) {
      clearTimeout(submissionTimeouts.get(submissionId)!);
      submissionTimeouts.delete(submissionId);
    }
    
    console.log(`[LeetSync] Submission captured successfully${isPartial ? ' (PARTIAL METADATA)' : ''}:`, sub);
    window.postMessage({ type: 'LEETSYNC_SUBMISSION', data: sub }, '*');
  }

  function mergeAndSendSubmission(submissionId: string, partialData: any) {
    if (seenSubmissions.has(submissionId)) return;

    let sub = pendingSubmissions.get(submissionId) || { submissionId, tags: [], url: window.location.href };
    
    // Intelligently merge non-empty values
    for (const key of Object.keys(partialData)) {
      const val = partialData[key];
      if (val !== undefined && val !== null && val !== '') {
        // For tags, only merge if it's an array and not empty
        if (key === 'tags') {
          if (Array.isArray(val) && val.length > 0) {
            sub[key] = val;
          }
        } else {
          sub[key] = val;
        }
      }
    }
    
    pendingSubmissions.set(submissionId, sub);
    console.log(`[LeetSync Debug] Merged submission state for ${submissionId}:`, sub);

    // Setup a 5-second timeout fallback if this is the first time we see this submission
    if (!submissionTimeouts.has(submissionId)) {
      const timeout = setTimeout(() => {
        if (!seenSubmissions.has(submissionId)) {
          console.warn(`[LeetSync] GraphQL metadata missing after 8 seconds for ${submissionId}. Syncing with partial metadata.`);
          // If we have at least the basic fields, send it
          if (sub.code && sub.status && sub.language) {
            dispatchSubmission(submissionId, sub, true);
          }
        }
      }, 8000);
      submissionTimeouts.set(submissionId, timeout);
    }
    
    // Actively trigger a fetch if we are missing rich metadata and haven't fetched yet
    if (!sub.difficulty || !sub.tags || sub.tags.length === 0) {
      const slug = sub.titleSlug || extractSlugFromPage();
      if (slug && !activeFetches.has(submissionId)) {
        activeFetches.add(submissionId);
        fetchProblemMetadata(slug, submissionId);
      }
    }

    if (isSubmissionReady(sub)) {
      dispatchSubmission(submissionId, sub, false);
    } else {
      console.log(
        `[LeetSync Debug] Waiting for more data for ${submissionId}...\n` +
        `Missing:\n` +
        `${sub.code ? '✓' : '✗'} code\n` +
        `${sub.language ? '✓' : '✗'} language\n` +
        `${sub.status ? '✓' : '✗'} status\n` +
        `${sub.questionNumber > 0 ? '✓' : '✗'} questionNumber\n` +
        `${sub.difficulty ? '✓' : '✗'} difficulty\n` +
        `${sub.tags && sub.tags.length > 0 ? '✓' : '✗'} tags`
      );
    }
  }

  async function fetchProblemMetadata(titleSlug: string, submissionId: string) {
    if (!titleSlug) return;
    
    console.log(`[LeetSync] Actively fetching missing metadata for ${titleSlug}...`);
    try {
      const response = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query questionData($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                questionFrontendId
                difficulty
                topicTags {
                  name
                }
              }
            }
          `,
          variables: { titleSlug }
        })
      });
      
      const json = await response.json();
      const question = json?.data?.question;
      if (question) {
        mergeAndSendSubmission(submissionId, {
          questionNumber: parseInt(question.questionFrontendId || '0', 10),
          difficulty: question.difficulty || '',
          tags: (question.topicTags || []).map((t: any) => t.name)
        });
      }
    } catch (e) {
      console.error(`[LeetSync] Failed to actively fetch metadata:`, e);
    }
  }

  /**
   * Handle a submission check API response (/submissions/detail/{id}/check/).
   */
  function handleSubmissionResponse(data: any, submissionId: string): void {
    if (seenSubmissions.has(submissionId)) return;
    
    console.log(`[LeetSync Debug] /check/ response data for ${submissionId}:`, data);

    // Extract status safely from various LeetCode properties
    let finalStatus = data.status_display || data.status_msg;
    if (!finalStatus && data.status_code !== undefined) {
      const codeMap: Record<number, string> = {
        10: 'Accepted',
        11: 'Wrong Answer',
        12: 'Memory Limit Exceeded',
        13: 'Output Limit Exceeded',
        14: 'Time Limit Exceeded',
        15: 'Runtime Error',
        20: 'Compile Error',
      };
      finalStatus = codeMap[data.status_code];
    }

    // Only process completed submissions (ignore PENDING state where status is missing)
    if (!finalStatus && data.state !== 'SUCCESS') return;

    const code = data.code ?? data.typed_code ?? extractCodeFromEditor();

    // Extract question number from REST response or page
    const questionNumber = parseInt(data.question_id ?? data.frontend_question_id ?? '0', 10) || extractNumberFromPage();

    mergeAndSendSubmission(submissionId, {
      titleSlug: extractSlugFromPage(),
      title: extractTitleFromPage(),
      questionNumber,
      difficulty: '',
      language: data.lang ?? '',
      code: code,
      status: finalStatus,
      runtime: data.status_runtime ?? '',
      runtimePercentile: data.runtime_percentile ?? 0,
      memory: data.status_memory ?? '',
      memoryPercentile: data.memory_percentile ?? 0,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle a GraphQL submissionDetails response.
   */
  function handleGraphQLSubmission(details: any, requestBodyStr: string): void {
    let submissionId = String(details.id ?? details.submissionId ?? '');
    
    // Extract submissionId from the request variables if missing from the response
    if (!submissionId) {
      try {
        const requestData = JSON.parse(requestBodyStr);
        if (requestData?.variables?.submissionId) {
          submissionId = String(requestData.variables.submissionId);
        }
      } catch (e) {
        // Ignore JSON parse errors for the request body
      }
    }

    if (!submissionId) {
      console.warn('[LeetSync] Could not extract submissionId from GraphQL response or request body.');
      return;
    }

    if (seenSubmissions.has(submissionId)) return;

    mergeAndSendSubmission(submissionId, {
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
    });
  }

  function extractCodeFromEditor(): string {
    try {
      const monaco = (window as any).monaco;
      if (monaco && typeof monaco.editor?.getModels === 'function') {
        const models = monaco.editor.getModels();
        if (models && models.length > 0) {
          return models[0].getValue() || '';
        }
      }
    } catch (e) {}

    // Fallback: DOM lines
    try {
      const codeLines = document.querySelectorAll('.view-line');
      if (codeLines && codeLines.length > 0) {
        return Array.from(codeLines).map(line => line.textContent || '').join('\n');
      }
    } catch (e) {}

    return '';
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

  /**
   * Try to extract the problem number from the page title or heading.
   * Matches patterns like "1. Two Sum" or "260. Single Number III".
   */
  function extractNumberFromPage(): number {
    // Try the page heading first
    const titleText = extractTitleFromPage();
    const headingMatch = titleText.match(/^(\d+)\./); 
    if (headingMatch) return parseInt(headingMatch[1], 10);

    // Try document.title (e.g., "Two Sum - LeetCode" doesn't have number, but some do)
    const docTitleMatch = document.title.match(/^(\d+)\./); 
    if (docTitleMatch) return parseInt(docTitleMatch[1], 10);

    return 0;
  }

  console.log('[LeetSync] Main world network interceptor active');
})();
