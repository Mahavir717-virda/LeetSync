/**
 * LeetSync Network Interceptor — Injected into page context
 *
 * Monkey-patches window.fetch to intercept LeetCode's internal
 * submission check responses. This is more robust than DOM scraping
 * because it reads structured JSON directly from the API.
 *
 * This script runs in the MAIN world (page context), NOT the
 * content script isolated world. It communicates back via
 * window.postMessage.
 */

(function () {
  'use strict';

  // Avoid double-injection
  if (window.__LEETSYNC_INJECTED__) return;
  window.__LEETSYNC_INJECTED__ = true;

  var SUBMISSION_CHECK_PATTERN = /\/submissions\/detail\/(\d+)\/check\//;
  var GRAPHQL_URL = '/graphql';

  // Track seen submission IDs to deduplicate
  var seenSubmissions = new Set();

  /**
   * Monkey-patch window.fetch to intercept responses.
   */
  var originalFetch = window.fetch;
  window.fetch = async function () {
    var args = arguments;
    var response = await originalFetch.apply(this, args);

    try {
      var url = typeof args[0] === 'string' ? args[0] : args[0].url;

      // Check if this is a submission check response
      var submissionMatch = url.match(SUBMISSION_CHECK_PATTERN);
      if (submissionMatch) {
        var cloned = response.clone();
        cloned.json().then(function (data) {
          if (data && data.state === 'SUCCESS') {
            handleSubmissionResponse(data, submissionMatch[1]);
          }
        }).catch(function () { /* ignore parse errors */ });
      }

      // Check if this is a GraphQL submissionDetails query
      if (url.includes(GRAPHQL_URL) && args[1] && args[1].body) {
        var body = typeof args[1].body === 'string' ? args[1].body : '';
        if (body.includes('submissionDetails')) {
          var cloned2 = response.clone();
          cloned2.json().then(function (data) {
            if (data && data.data && data.data.submissionDetails) {
              handleGraphQLSubmission(data.data.submissionDetails);
            }
          }).catch(function () { /* ignore parse errors */ });
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
  function handleSubmissionResponse(data, submissionId) {
    // Deduplicate: LeetCode polls this endpoint multiple times
    if (seenSubmissions.has(submissionId)) return;
    seenSubmissions.add(submissionId);

    // Only process completed submissions
    if (data.status_display !== 'Accepted' && !data.status_display) return;

    var submission = {
      submissionId: submissionId,
      titleSlug: data.question_id ? extractSlugFromPage() : '',
      title: extractTitleFromPage(),
      questionNumber: 0, // Will be enriched later
      difficulty: '',
      tags: [],
      language: data.lang || '',
      code: data.code || data.typed_code || '',
      status: data.status_display || 'Unknown',
      runtime: data.status_runtime || '',
      runtimePercentile: data.runtime_percentile || 0,
      memory: data.status_memory || '',
      memoryPercentile: data.memory_percentile || 0,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Validate required fields before posting
    if (!submission.code || !submission.language) {
      console.warn('[LeetSync] Missing required fields, skipping:', submission);
      return;
    }

    console.log('[LeetSync] Submission captured:', submission);
    window.postMessage({ type: 'LEETSYNC_SUBMISSION', data: submission }, '*');
  }

  /**
   * Handle a GraphQL submissionDetails response.
   */
  function handleGraphQLSubmission(details) {
    var submissionId = String(details.id || details.submissionId || '');
    if (!submissionId || seenSubmissions.has(submissionId)) return;
    seenSubmissions.add(submissionId);

    var question = details.question || {};
    var topicTags = question.topicTags || [];

    var submission = {
      submissionId: submissionId,
      titleSlug: question.titleSlug || extractSlugFromPage(),
      title: question.title || extractTitleFromPage(),
      questionNumber: parseInt(question.questionFrontendId || '0', 10),
      difficulty: question.difficulty || '',
      tags: topicTags.map(function (t) { return t.name || t.slug; }),
      language: (details.lang && details.lang.name) ? details.lang.name : (details.lang || ''),
      code: details.code || '',
      status: details.statusDisplay || '',
      runtime: details.runtimeDisplay || details.runtime || '',
      runtimePercentile: details.runtimePercentile || 0,
      memory: details.memoryDisplay || details.memory || '',
      memoryPercentile: details.memoryPercentile || 0,
      timestamp: details.timestamp
        ? new Date(details.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      url: window.location.href,
    };

    if (!submission.code || !submission.language) {
      console.warn('[LeetSync] Missing required fields in GraphQL response, skipping');
      return;
    }

    console.log('[LeetSync] GraphQL submission captured:', submission);
    window.postMessage({ type: 'LEETSYNC_SUBMISSION', data: submission }, '*');
  }

  /**
   * Extract the problem slug from the current URL.
   * URL format: https://leetcode.com/problems/{slug}/...
   */
  function extractSlugFromPage() {
    var match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return (match && match[1]) ? match[1] : '';
  }

  /**
   * Extract the problem title from the page DOM (best-effort fallback).
   */
  function extractTitleFromPage() {
    var titleEl =
      document.querySelector('[data-cy="question-title"]') ||
      document.querySelector('.text-title-large') ||
      document.querySelector('h4[class*="title"]') ||
      document.querySelector('div[class*="question-title"]');
    return (titleEl && titleEl.textContent) ? titleEl.textContent.trim() : '';
  }

  console.log('[LeetSync] Network interceptor active');
})();
