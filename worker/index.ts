import {
  buildFallbackIssueUrl,
  buildFeedbackCorsHeaders,
  buildGitHubIssuePayload,
  isAllowedFeedbackOrigin,
  MAX_FEEDBACK_BODY_BYTES,
  resolveFeedbackRepo,
  validateFeedbackPayload,
} from './feedbackProtocol';

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnv {
  ASSETS: AssetsBinding;
  FEEDBACK_RATE_LIMITER?: RateLimitBinding;
  CAPYBOOP_FEEDBACK_TOKEN?: string;
  CAPYBOOP_FEEDBACK_REPO?: string;
  ALLOWED_EXTRA_ORIGINS?: string;
  ALLOW_LOCALHOST_ORIGINS?: string;
}

const API_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"],
  ['X-Content-Type-Options', 'nosniff'],
  ['Cache-Control', 'no-store'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'DENY'],
];

function mergeApiSecurityHeaders(extraHeaders?: Record<string, string>): Headers {
  const headers = new Headers(extraHeaders);
  for (const [name, value] of API_SECURITY_HEADERS) {
    headers.set(name, value);
  }
  return headers;
}

function apiJsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return Response.json(body, {
    status,
    headers: mergeApiSecurityHeaders(extraHeaders),
  });
}

function extractClientIp(request: Request): string {
  const raw = (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    ''
  ).trim();
  return raw.length > 0 ? raw : 'unknown';
}

async function readBoundedUtf8Body(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; tooLarge: true }> {
  const rawContentLength = request.headers.get('Content-Length');
  if (rawContentLength !== null) {
    const parsedLength = Number(rawContentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return { ok: false, tooLarge: true };
    }
  }

  if (!request.body) {
    const text = await request.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > maxBytes) {
      return { ok: false, tooLarge: true };
    }
    return { ok: true, text };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

export async function handleFeedbackRequest(
  request: Request,
  env: Pick<
    WorkerEnv,
    | 'FEEDBACK_RATE_LIMITER'
    | 'CAPYBOOP_FEEDBACK_TOKEN'
    | 'CAPYBOOP_FEEDBACK_REPO'
    | 'ALLOWED_EXTRA_ORIGINS'
    | 'ALLOW_LOCALHOST_ORIGINS'
  >,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const allowLocalhost = env.ALLOW_LOCALHOST_ORIGINS === 'true';
  const originAllowed = isAllowedFeedbackOrigin(origin, env.ALLOWED_EXTRA_ORIGINS, allowLocalhost);
  const corsHeaders = buildFeedbackCorsHeaders(origin, env.ALLOWED_EXTRA_ORIGINS, allowLocalhost);

  if (!originAllowed) {
    console.error(
      JSON.stringify({
        event: 'feedback_origin_rejected',
        origin,
      })
    );
    return apiJsonResponse({ ok: false, error: 'Forbidden origin' }, 403, corsHeaders);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: mergeApiSecurityHeaders(corsHeaders),
    });
  }

  if (request.method !== 'POST') {
    return apiJsonResponse({ ok: false, error: 'Method not allowed' }, 405, {
      ...corsHeaders,
      Allow: 'POST, OPTIONS',
    });
  }

  if (env.FEEDBACK_RATE_LIMITER) {
    const clientIp = extractClientIp(request);
    const rl = await env.FEEDBACK_RATE_LIMITER.limit({ key: `feedback:${clientIp}` });
    if (!rl.success) {
      return apiJsonResponse({ ok: false, error: 'Too many requests' }, 429, {
        ...corsHeaders,
        'Retry-After': '60',
      });
    }
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return apiJsonResponse(
      { ok: false, error: 'Expected application/json content type.' },
      415,
      corsHeaders
    );
  }

  const bodyRead = await readBoundedUtf8Body(request, MAX_FEEDBACK_BODY_BYTES);
  if (!bodyRead.ok) {
    return apiJsonResponse(
      {
        ok: false,
        error: `Feedback payload exceeds the ${MAX_FEEDBACK_BODY_BYTES}-byte limit.`,
      },
      413,
      corsHeaders
    );
  }

  const validation = validateFeedbackPayload(bodyRead.text);
  if (!validation.ok) {
    if (validation.honeypot) {
      return apiJsonResponse({ ok: true, accepted: true }, 202, corsHeaders);
    }
    return apiJsonResponse(
      { ok: false, error: validation.error },
      validation.status ?? 400,
      corsHeaders
    );
  }

  const repo = resolveFeedbackRepo(env.CAPYBOOP_FEEDBACK_REPO);
  const fallbackUrl = buildFallbackIssueUrl(validation.payload, repo);
  const token = env.CAPYBOOP_FEEDBACK_TOKEN?.trim();
  if (!token) {
    return apiJsonResponse(
      {
        ok: false,
        code: 'feedback_unconfigured',
        error:
          'In-app feedback relay is not configured yet. You can submit directly on GitHub.',
        fallbackUrl,
      },
      503,
      corsHeaders
    );
  }

  const issuePayload = buildGitHubIssuePayload(validation.payload);
  try {
    const ghRes = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'CapyGame-Feedback-Relay',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issuePayload),
    });

    if (!ghRes.ok) {
      console.error(
        JSON.stringify({
          event: 'feedback_github_error',
          status: ghRes.status,
        })
      );
      return apiJsonResponse(
        {
          ok: false,
          code: 'upstream_error',
          error: 'Could not reach GitHub right now. Please try again or use the GitHub link.',
          fallbackUrl,
        },
        502,
        corsHeaders
      );
    }

    const created = (await ghRes.json()) as { number?: number; html_url?: string } | null;
    const issueNumber = typeof created?.number === 'number' ? created.number : undefined;
    let issueUrl = `https://github.com/${repo}/issues`;
    if (typeof created?.html_url === 'string') {
      try {
        const parsedIssueUrl = new URL(created.html_url.trim());
        if (
          parsedIssueUrl.protocol.toLowerCase() === 'https:' &&
          parsedIssueUrl.hostname.toLowerCase() === 'github.com' &&
          parsedIssueUrl.port === '' &&
          parsedIssueUrl.username === '' &&
          parsedIssueUrl.password === '' &&
          parsedIssueUrl.pathname.toLowerCase().startsWith(`/${repo.toLowerCase()}/issues`)
        ) {
          issueUrl = parsedIssueUrl.toString();
        }
      } catch {
        // Fall back to canonical repo issues URL
      }
    }

    return apiJsonResponse(
      {
        ok: true,
        issueNumber,
        issueUrl,
      },
      201,
      corsHeaders
    );
  } catch (ghErr) {
    console.error(
      JSON.stringify({
        event: 'feedback_github_error',
        status: 'network_exception',
        message: ghErr instanceof Error ? ghErr.name : 'unknown',
      })
    );
    return apiJsonResponse(
      {
        ok: false,
        code: 'upstream_error',
        error: 'Could not reach GitHub right now. Please try again or use the GitHub link.',
        fallbackUrl,
      },
      502,
      corsHeaders
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/feedback') {
      return handleFeedbackRequest(request, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return apiJsonResponse({ ok: false, error: 'Not found' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
