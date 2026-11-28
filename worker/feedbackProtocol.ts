export const MAX_FEEDBACK_BODY_BYTES = 8192;
export const MIN_TITLE_CHARS = 3;
export const MAX_TITLE_CHARS = 120;
export const MIN_DETAILS_CHARS = 10;
export const MAX_DETAILS_CHARS = 2000;
export const MAX_META_CHARS = 120;
export const MAX_FALLBACK_URL_CHARS = 4000;
export const DEFAULT_FEEDBACK_REPO = 'capyboop/capygame';

export type FeedbackCategory = 'bug' | 'feature' | 'general';

export interface FeedbackContext {
  appVersion?: string;
  mode?: string;
  platform?: string;
  viewport?: string;
}

export interface ValidatedFeedbackPayload {
  category: FeedbackCategory;
  title: string;
  details: string;
  context: FeedbackContext;
}

export type FeedbackValidationResult =
  | { ok: true; payload: ValidatedFeedbackPayload }
  | { ok: false; honeypot: true }
  | { ok: false; honeypot?: false; status?: 400 | 413; error: string };

export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
}

export interface FeedbackCategoryMeta {
  prefix: string;
  labels: readonly string[];
  template: string;
  displayName: string;
}

const VALID_CATEGORIES = new Set<FeedbackCategory>(['bug', 'feature', 'general']);

const CATEGORY_META: Record<FeedbackCategory, FeedbackCategoryMeta> = {
  bug: {
    prefix: '[Bug]',
    labels: ['bug'],
    template: 'bug_report.yml',
    displayName: 'Bug Report',
  },
  feature: {
    prefix: '[Feature]',
    labels: ['enhancement'],
    template: 'feature_request.yml',
    displayName: 'Feature Request',
  },
  general: {
    prefix: '[Feedback]',
    labels: ['question'],
    template: '',
    displayName: 'General Feedback',
  },
};

const ALLOWED_EXACT_FEEDBACK_HOSTS = new Set<string>([
  'capyboop.com',
  'www.capyboop.com',
  'capyboop.github.io',
  /* capy-dev-only:start */
  'shthed.github.io',
  /* capy-dev-only:end */
  'appassets.androidplatform.net',
]);

const VALID_REPO_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const VALID_REPO_NAME_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;

const textEncoder = new TextEncoder();

export function getUtf8ByteLength(text: string): number {
  return textEncoder.encode(text).byteLength;
}

export function resolveFeedbackRepo(rawRepo?: string | null): string {
  const trimmed = typeof rawRepo === 'string' ? rawRepo.trim() : '';
  if (!trimmed) {
    return DEFAULT_FEEDBACK_REPO;
  }
  const segments = trimmed.split('/');
  if (segments.length !== 2) {
    return DEFAULT_FEEDBACK_REPO;
  }
  const [owner, repo] = segments;
  if (
    VALID_REPO_OWNER_PATTERN.test(owner) &&
    VALID_REPO_NAME_PATTERN.test(repo) &&
    repo !== '.' &&
    repo !== '..' &&
    !repo.includes('..')
  ) {
    return `${owner}/${repo}`;
  }
  return DEFAULT_FEEDBACK_REPO;
}

export function getFeedbackCategoryMeta(category: FeedbackCategory): FeedbackCategoryMeta {
  return CATEGORY_META[category];
}

export function sanitizeFeedbackText(input: string, preserveNewlines: boolean): string {
  let cleaned = input.replace(/\r\n?/g, '\n');
  if (preserveNewlines) {
    cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  } else {
    cleaned = cleaned
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  // Prevent triple-backtick code fence breakouts in GitHub markdown
  cleaned = cleaned.replace(/`{3,}/g, "'''");

  // Neutralize GitHub @mentions across punctuation boundaries while preserving emails
  cleaned = cleaned.replace(
    /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\/[a-zA-Z0-9_.-]+)?)/g,
    '$1@\u200B$2'
  );

  return cleaned.trim();
}

function sanitizeMetaField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = sanitizeFeedbackText(value, false).slice(0, MAX_META_CHARS).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function validateFeedbackPayload(rawBody: string): FeedbackValidationResult {
  if (typeof rawBody !== 'string' || rawBody.trim().length === 0) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }

  if (getUtf8ByteLength(rawBody) > MAX_FEEDBACK_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Feedback payload exceeds the ${MAX_FEEDBACK_BODY_BYTES}-byte limit.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'Malformed JSON body.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'Feedback payload must be a JSON object.' };
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.website === 'string' && record.website.trim().length > 0) {
    return { ok: false, honeypot: true };
  }

  const rawCategory = typeof record.category === 'string' ? record.category.trim() : '';
  if (!VALID_CATEGORIES.has(rawCategory as FeedbackCategory)) {
    return {
      ok: false,
      status: 400,
      error: 'Category must be one of: bug, feature, general.',
    };
  }
  const category = rawCategory as FeedbackCategory;

  if (typeof record.title !== 'string') {
    return { ok: false, status: 400, error: 'Title is required.' };
  }
  const title = sanitizeFeedbackText(record.title, false);
  if (title.length < MIN_TITLE_CHARS || title.length > MAX_TITLE_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `Title must be between ${MIN_TITLE_CHARS} and ${MAX_TITLE_CHARS} characters.`,
    };
  }

  if (typeof record.details !== 'string') {
    return { ok: false, status: 400, error: 'Details are required.' };
  }
  const details = sanitizeFeedbackText(record.details, true);
  if (details.length < MIN_DETAILS_CHARS || details.length > MAX_DETAILS_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `Details must be between ${MIN_DETAILS_CHARS} and ${MAX_DETAILS_CHARS} characters.`,
    };
  }

  const context: FeedbackContext = {};
  if (record.context && typeof record.context === 'object' && !Array.isArray(record.context)) {
    const ctx = record.context as Record<string, unknown>;
    const appVersion = sanitizeMetaField(ctx.appVersion);
    const mode = sanitizeMetaField(ctx.mode);
    const platform = sanitizeMetaField(ctx.platform);
    const viewport = sanitizeMetaField(ctx.viewport);
    if (appVersion) context.appVersion = appVersion;
    if (mode) context.mode = mode;
    if (platform) context.platform = platform;
    if (viewport) context.viewport = viewport;
  }

  return {
    ok: true,
    payload: {
      category,
      title,
      details,
      context,
    },
  };
}

export function buildGitHubIssuePayload(payload: ValidatedFeedbackPayload): GitHubIssuePayload {
  const meta = CATEGORY_META[payload.category];
  const issueTitle = `${meta.prefix}: ${payload.title}`.slice(0, 140);

  const envLines: string[] = [
    '- **Source**: Anonymous in-game feedback',
    `- **Category**: ${meta.displayName}`,
  ];
  if (payload.context.appVersion) {
    envLines.push(`- **App Version**: ${payload.context.appVersion}`);
  }
  if (payload.context.mode) {
    envLines.push(`- **Mode**: ${payload.context.mode}`);
  }
  if (payload.context.platform) {
    envLines.push(`- **Platform**: ${payload.context.platform}`);
  }
  if (payload.context.viewport) {
    envLines.push(`- **Viewport**: ${payload.context.viewport}`);
  }

  const body = [
    payload.details,
    '',
    '---',
    ...envLines,
  ].join('\n');

  return {
    title: issueTitle,
    body,
    labels: [...meta.labels],
  };
}

function sliceWithoutBrokenSurrogate(text: string, maxUnits: number): string {
  if (text.length <= maxUnits) return text;
  const sliced = text.slice(0, maxUnits);
  const lastCode = sliced.charCodeAt(sliced.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    return sliced.slice(0, -1);
  }
  return sliced;
}

export function buildFallbackIssueUrl(
  draft: Partial<ValidatedFeedbackPayload>,
  rawRepo?: string | null
): string {
  const repo = resolveFeedbackRepo(rawRepo);
  const category: FeedbackCategory =
    draft.category && VALID_CATEGORIES.has(draft.category) ? draft.category : 'general';
  const meta = CATEGORY_META[category];

  const assembleUrl = (titleValue: string, bodyValue: string): string => {
    const params = new URLSearchParams();
    if (meta.template) {
      params.set('template', meta.template);
    }
    if (titleValue) {
      params.set('title', `${meta.prefix}: ${titleValue}`);
    }
    if (bodyValue) {
      params.set('body', bodyValue);
    }
    const query = params.toString();
    return query
      ? `https://github.com/${repo}/issues/new?${query}`
      : `https://github.com/${repo}/issues/new/choose`;
  };

  let effectiveTitle = draft.title
    ? sliceWithoutBrokenSurrogate(sanitizeFeedbackText(draft.title, false), MAX_TITLE_CHARS)
    : '';
  const cleanDetails = draft.details
    ? sliceWithoutBrokenSurrogate(sanitizeFeedbackText(draft.details, true), 1200)
    : '';

  let suffix = '';
  if (cleanDetails) {
    const contextParts: string[] = [];
    if (draft.context?.appVersion) contextParts.push(`Version: ${draft.context.appVersion}`);
    if (draft.context?.mode) contextParts.push(`Mode: ${draft.context.mode}`);
    if (draft.context?.platform) contextParts.push(`Platform: ${draft.context.platform}`);
    suffix = contextParts.length > 0 ? `\n\n---\n${contextParts.join(' | ')}` : '';
  }

  const initialBody = cleanDetails ? `${cleanDetails}${suffix}` : '';
  const initialUrl = assembleUrl(effectiveTitle, initialBody);
  if (initialUrl.length <= MAX_FALLBACK_URL_CHARS) {
    return initialUrl;
  }

  if (effectiveTitle && assembleUrl(effectiveTitle, '').length > MAX_FALLBACK_URL_CHARS) {
    const titleChars = Array.from(effectiveTitle);
    let lo = 0;
    let hi = titleChars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = titleChars.slice(0, mid).join('');
      if (assembleUrl(candidate, '').length <= MAX_FALLBACK_URL_CHARS) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    effectiveTitle = titleChars.slice(0, lo).join('');
  }

  if (!cleanDetails) {
    return assembleUrl(effectiveTitle, '');
  }

  const detailChars = Array.from(cleanDetails);
  let lo = 0;
  let hi = detailChars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidateDetails =
      mid < detailChars.length ? `${detailChars.slice(0, mid).join('')}...` : cleanDetails;
    if (
      assembleUrl(effectiveTitle, `${candidateDetails}${suffix}`).length <= MAX_FALLBACK_URL_CHARS
    ) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  if (lo > 0) {
    const finalDetails =
      lo < detailChars.length ? `${detailChars.slice(0, lo).join('')}...` : cleanDetails;
    return assembleUrl(effectiveTitle, `${finalDetails}${suffix}`);
  }

  const suffixOnlyUrl = suffix ? assembleUrl(effectiveTitle, suffix.trimStart()) : '';
  if (suffixOnlyUrl && suffixOnlyUrl.length <= MAX_FALLBACK_URL_CHARS) {
    return suffixOnlyUrl;
  }
  return assembleUrl(effectiveTitle, '');
}

function parseStrictOrigin(originHeader: string | null | undefined): string | null {
  if (typeof originHeader !== 'string') return null;
  const trimmed = originHeader.trim();
  if (!trimmed || trimmed.includes('\\') || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.origin === 'null' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.origin.toLowerCase() !== trimmed.toLowerCase() ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isAllowedFeedbackOrigin(
  originHeader: string | null | undefined,
  extraOriginsCsv?: string | null,
  allowLocalhostOrigins: boolean = false
): boolean {
  const canonicalOrigin = parseStrictOrigin(originHeader);
  if (!canonicalOrigin) {
    return false;
  }

  const parsed = new URL(canonicalOrigin);
  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return allowLocalhostOrigins && (protocol === 'http:' || protocol === 'https:');
  }

  if (protocol === 'https:' && parsed.port === '' && ALLOWED_EXACT_FEEDBACK_HOSTS.has(hostname)) {
    return true;
  }

  if (extraOriginsCsv && extraOriginsCsv.trim().length > 0) {
    const extras = extraOriginsCsv
      .split(',')
      .map((entry) => parseStrictOrigin(entry))
      .filter((entry): entry is string => entry !== null);
    if (extras.some((allowed) => allowed.toLowerCase() === canonicalOrigin.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function buildFeedbackCorsHeaders(
  originHeader: string | null | undefined,
  allowedExtraOrigins?: string | null,
  allowLocalhostOrigins: boolean = false
): Record<string, string> {
  const canonicalOrigin = parseStrictOrigin(originHeader);
  if (
    canonicalOrigin &&
    isAllowedFeedbackOrigin(canonicalOrigin, allowedExtraOrigins, allowLocalhostOrigins)
  ) {
    return {
      'Access-Control-Allow-Origin': canonicalOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return {
    Vary: 'Origin',
  };
}
