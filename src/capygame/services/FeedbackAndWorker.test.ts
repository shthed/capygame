import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackIssueUrl,
  buildFeedbackCorsHeaders,
  buildGitHubIssuePayload,
  DEFAULT_FEEDBACK_REPO,
  isAllowedFeedbackOrigin,
  MAX_FALLBACK_URL_CHARS,
  MAX_FEEDBACK_BODY_BYTES,
  resolveFeedbackRepo,
  sanitizeFeedbackText,
  validateFeedbackPayload,
} from '../../../worker/feedbackProtocol';
import { handleFeedbackRequest } from '../../../worker/index';
import {
  buildGitHubIssueFallbackUrl,
  CANONICAL_FEEDBACK_API_URL,
  PUBLIC_ISSUES_URL,
  resolveFeedbackApiUrl,
  sanitizeGitHubIssueUrl,
  submitAnonymousFeedback,
  validateFeedbackDraft,
} from './FeedbackService';

test('FeedbackProtocol: origin allowlist, repo validation, text sanitization, and fallback URLs', () => {
  assert.equal(resolveFeedbackRepo(undefined), DEFAULT_FEEDBACK_REPO);
  assert.equal(resolveFeedbackRepo('capyboop/capygame'), 'capyboop/capygame');
  assert.equal(resolveFeedbackRepo('invalid/../../repo'), DEFAULT_FEEDBACK_REPO);

  assert.equal(isAllowedFeedbackOrigin('https://capyboop.com'), true);
  assert.equal(isAllowedFeedbackOrigin('https://www.capyboop.com'), true);
  assert.equal(isAllowedFeedbackOrigin('https://capyboop.github.io'), true);
  assert.equal(isAllowedFeedbackOrigin('https://evil.example.com'), false);
  assert.equal(isAllowedFeedbackOrigin('http://capyboop.com'), false);
  assert.equal(isAllowedFeedbackOrigin('https://capyboop.com:8443'), false);
  assert.equal(isAllowedFeedbackOrigin('http://localhost:3000', undefined, false), false);
  assert.equal(isAllowedFeedbackOrigin('http://localhost:3000', undefined, true), true);
  assert.equal(
    isAllowedFeedbackOrigin('https://staging.example.org', 'https://staging.example.org'),
    true
  );

  const corsAllowed = buildFeedbackCorsHeaders('https://capyboop.com');
  assert.equal(corsAllowed['Access-Control-Allow-Origin'], 'https://capyboop.com');
  assert.equal(corsAllowed['Access-Control-Allow-Methods'], 'POST, OPTIONS');

  const corsDenied = buildFeedbackCorsHeaders('https://evil.example.com');
  assert.equal(corsDenied['Access-Control-Allow-Origin'], undefined);
  assert.equal(corsDenied.Vary, 'Origin');

  // Markdown fence breakout & @mention neutralization while keeping emails intact
  const sanitized = sanitizeFeedbackText(
    'Ping @octocat and @org/team with ```js\nalert(1)\n``` contact user@example.com',
    true
  );
  assert.ok(!sanitized.includes('```'));
  assert.ok(sanitized.includes("'''"));
  assert.ok(sanitized.includes('@\u200Boctocat'));
  assert.ok(sanitized.includes('@\u200Borg/team'));
  assert.ok(sanitized.includes('user@example.com'));

  // Honeypot detection
  const hp = validateFeedbackPayload(
    JSON.stringify({
      category: 'bug',
      title: 'Spam',
      details: 'Spam details that are long enough',
      website: 'https://spam.example',
    })
  );
  assert.equal(hp.ok, false);
  assert.equal('honeypot' in hp && hp.honeypot, true);

  // Oversized UTF-8 body rejection
  const big = validateFeedbackPayload('x'.repeat(MAX_FEEDBACK_BODY_BYTES + 10));
  assert.equal(big.ok, false);
  assert.equal('status' in big && big.status, 413);

  // Valid payload & GitHub issue formatting
  const valid = validateFeedbackPayload(
    JSON.stringify({
      category: 'bug',
      title: 'Belt graphics flicker',
      details: 'Conveyor belt corners flicker on mobile Safari when zoomed out.',
      context: {
        appVersion: 'v1.6.0',
        mode: 'capytorio',
        platform: 'Web',
        viewport: '390x844',
      },
    })
  );
  assert.equal(valid.ok, true);
  if (valid.ok) {
    const issue = buildGitHubIssuePayload(valid.payload);
    assert.equal(issue.title, '[Bug]: Belt graphics flicker');
    assert.deepEqual(issue.labels, ['bug']);
    assert.ok(issue.body.includes('- **App Version**: v1.6.0'));
    assert.ok(issue.body.includes('- **Mode**: capytorio'));

    const fallback = buildFallbackIssueUrl(valid.payload);
    assert.ok(fallback.startsWith(`${PUBLIC_ISSUES_URL}/new?`));
    assert.ok(fallback.includes('template=bug_report.yml'));
    assert.ok(fallback.length <= MAX_FALLBACK_URL_CHARS);
  }
});

test('Worker handleFeedbackRequest: enforces CORS, rate limits, bounded body, honeypot, fallback, and GitHub creation', async () => {
  const makeReq = (init: RequestInit & { origin?: string | null }) => {
    const headers = new Headers(init.headers);
    if (init.origin !== null) {
      headers.set('Origin', init.origin ?? 'https://capyboop.com');
    }
    return new Request('https://capyboop.com/api/feedback', {
      ...init,
      headers,
    });
  };

  // 1. Forbidden origin -> 403
  const forbiddenRes = await handleFeedbackRequest(
    makeReq({ method: 'POST', origin: 'https://evil.example.com' }),
    {}
  );
  assert.equal(forbiddenRes.status, 403);
  assert.equal(forbiddenRes.headers.get('X-Frame-Options'), 'DENY');

  // 2. Preflight OPTIONS -> 204
  const preflightRes = await handleFeedbackRequest(makeReq({ method: 'OPTIONS' }), {});
  assert.equal(preflightRes.status, 204);
  assert.equal(preflightRes.headers.get('Access-Control-Allow-Origin'), 'https://capyboop.com');

  // 3. Wrong method -> 405
  const getRes = await handleFeedbackRequest(makeReq({ method: 'GET' }), {});
  assert.equal(getRes.status, 405);
  assert.equal(getRes.headers.get('Allow'), 'POST, OPTIONS');

  // 4. Rate limiter -> 429
  const rateRes = await handleFeedbackRequest(
    makeReq({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
      body: '{}',
    }),
    {
      FEEDBACK_RATE_LIMITER: {
        limit: async () => ({ success: false }),
      },
    }
  );
  assert.equal(rateRes.status, 429);
  assert.equal(rateRes.headers.get('Retry-After'), '60');

  // 5. Wrong Content-Type -> 415
  const ctRes = await handleFeedbackRequest(
    makeReq({ method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' }),
    {}
  );
  assert.equal(ctRes.status, 415);

  // 6. Streamed oversized body without Content-Length -> 413
  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_FEEDBACK_BODY_BYTES + 128).fill(65));
      controller.close();
    },
  });
  const bigStreamReq = new Request('https://capyboop.com/api/feedback', {
    method: 'POST',
    headers: {
      Origin: 'https://capyboop.com',
      'Content-Type': 'application/json',
    },
    body: oversizedStream,
    duplex: 'half',
  } as RequestInit);
  const bigRes = await handleFeedbackRequest(bigStreamReq, {});
  assert.equal(bigRes.status, 413);

  // 7. Honeypot -> 202 accepted silently
  const hpRes = await handleFeedbackRequest(
    makeReq({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'general',
        title: 'Bot test',
        details: 'Bot submission details here.',
        website: 'http://bot.example',
      }),
    }),
    {}
  );
  assert.equal(hpRes.status, 202);

  // 8. Missing CAPYBOOP_FEEDBACK_TOKEN -> 503 with fallbackUrl
  const unconfiguredRes = await handleFeedbackRequest(
    makeReq({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'feature',
        title: 'Add capybara hats',
        details: 'It would be awesome to unlock tiny straw hats in Forest Games.',
      }),
    }),
    {}
  );
  assert.equal(unconfiguredRes.status, 503);
  const unconfiguredJson = (await unconfiguredRes.json()) as {
    code?: string;
    fallbackUrl?: string;
  };
  assert.equal(unconfiguredJson.code, 'feedback_unconfigured');
  assert.ok(unconfiguredJson.fallbackUrl?.startsWith(`${PUBLIC_ISSUES_URL}/new?`));

  // 9. Successful GitHub issue creation -> 201 with sanitized issueUrl & security headers
  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody = '';
  const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    const hdrs = new Headers(init?.headers);
    capturedAuth = hdrs.get('Authorization') || '';
    capturedBody = String(init?.body || '');
    return new Response(
      JSON.stringify({
        number: 42,
        html_url: 'https://github.com/capyboop/capygame/issues/42',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const okRes = await handleFeedbackRequest(
    makeReq({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'bug',
        title: 'Audio pops on resume',
        details: 'Sound briefly pops when returning from a backgrounded mobile tab.',
        context: { appVersion: 'v1.6.0', mode: 'sanctuary', platform: 'Android Web' },
      }),
    }),
    { CAPYBOOP_FEEDBACK_TOKEN: 'ghp_test_token_123' },
    mockFetch
  );
  assert.equal(okRes.status, 201);
  assert.equal(capturedUrl, 'https://api.github.com/repos/capyboop/capygame/issues');
  assert.equal(capturedAuth, 'Bearer ghp_test_token_123');
  assert.ok(capturedBody.includes('[Bug]: Audio pops on resume'));
  const okJson = (await okRes.json()) as { ok?: boolean; issueNumber?: number; issueUrl?: string };
  assert.equal(okJson.ok, true);
  assert.equal(okJson.issueNumber, 42);
  assert.equal(okJson.issueUrl, 'https://github.com/capyboop/capygame/issues/42');
  assert.equal(okRes.headers.get('Cache-Control'), 'no-store');
});

test('FeedbackService: endpoint resolution, URL sanitization, validation, and submit fallback handling', async () => {
  assert.equal(resolveFeedbackApiUrl(undefined, { hostname: 'capyboop.com' }), '/api/feedback');
  assert.equal(
    resolveFeedbackApiUrl(undefined, { hostname: 'www.capyboop.com' }),
    CANONICAL_FEEDBACK_API_URL
  );
  assert.equal(
    resolveFeedbackApiUrl(undefined, { hostname: 'capyboop.github.io' }),
    CANONICAL_FEEDBACK_API_URL
  );
  assert.equal(resolveFeedbackApiUrl(undefined, { hostname: 'localhost' }), '/api/feedback');
  assert.equal(
    resolveFeedbackApiUrl('https://custom.example.com/api/feedback', { hostname: 'capyboop.com' }),
    'https://custom.example.com/api/feedback'
  );
  assert.equal(
    resolveFeedbackApiUrl('javascript:alert(1)', { hostname: 'capyboop.com' }),
    '/api/feedback'
  );

  assert.equal(
    sanitizeGitHubIssueUrl('https://github.com/capyboop/capygame/issues/12'),
    'https://github.com/capyboop/capygame/issues/12'
  );
  assert.equal(sanitizeGitHubIssueUrl('https://evil.com/capyboop/capygame/issues/12'), undefined);
  assert.equal(sanitizeGitHubIssueUrl('javascript:alert(1)'), undefined);

  assert.equal(
    validateFeedbackDraft({ category: 'bug', title: 'Hi', details: '1234567890' }).ok,
    false
  );
  assert.equal(
    validateFeedbackDraft({ category: 'bug', title: 'Valid title', details: 'short' }).ok,
    false
  );
  assert.equal(
    validateFeedbackDraft({
      category: 'general',
      title: 'Great zoom!',
      details: 'Love zooming all the way into the Planck foam scale.',
    }).ok,
    true
  );

  const fallback = buildGitHubIssueFallbackUrl(
    { category: 'feature', title: 'Photo mode', details: 'Add a quick screenshot button.' },
    { appVersion: 'v1.6.0', mode: 'cosmic', platform: 'Web' }
  );
  assert.ok(fallback.startsWith(`${PUBLIC_ISSUES_URL}/new?`));
  assert.ok(fallback.includes('template=feature_request.yml'));

  // Successful submit
  const okResult = await submitAnonymousFeedback(
    {
      category: 'feature',
      title: 'Photo mode',
      details: 'Add a quick HUD-less screenshot button for cosmic views.',
    },
    {
      apiUrl: '/api/feedback',
      context: { appVersion: 'v1.6.0', mode: 'cosmic', platform: 'Web' },
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            ok: true,
            issueNumber: 9,
            issueUrl: 'https://github.com/capyboop/capygame/issues/9',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )) as typeof fetch,
    }
  );
  assert.equal(okResult.ok, true);
  if (okResult.ok) {
    assert.equal(okResult.issueNumber, 9);
    assert.equal(okResult.issueUrl, 'https://github.com/capyboop/capygame/issues/9');
  }

  // Network offline fallback
  const offlineResult = await submitAnonymousFeedback(
    {
      category: 'bug',
      title: 'Offline test',
      details: 'Testing offline network exception fallback path.',
    },
    {
      apiUrl: '/api/feedback',
      context: { appVersion: 'v1.6.0', mode: 'sanctuary', platform: 'Web' },
      fetchImpl: (async () => {
        throw new Error('Failed to fetch');
      }) as typeof fetch,
    }
  );
  assert.equal(offlineResult.ok, false);
  if (!offlineResult.ok) {
    assert.equal(offlineResult.code, 'network_error');
    assert.ok(offlineResult.fallbackUrl.startsWith(`${PUBLIC_ISSUES_URL}/new?`));
  }
});
