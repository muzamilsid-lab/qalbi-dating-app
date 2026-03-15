/**
 * LinkSafetyChecker — checks URLs for safety before rendering previews.
 *
 * Uses two layers:
 *   1. Client-side: blocklist of known phishing/spam patterns
 *   2. Server-side: /api/link-preview?url=... returns { safe: boolean, preview }
 */

const BLOCKED_PATTERNS = [
  /bit\.ly\/[a-z0-9]+$/i,
  /tinyurl\.com/i,
  /t\.co\//i,
  // Common phishing keywords
  /paypal.*verify/i,
  /bank.*secure/i,
  /account.*suspend/i,
  /login.*confirm/i,
];

export interface LinkPreview {
  url:         string;
  title:       string | null;
  description: string | null;
  image:       string | null;
  siteName:    string | null;
  safe:        boolean;
  checkedAt:   Date;
}

// In-memory cache: url → preview
const previewCache = new Map<string, LinkPreview>();

// ─── Extract URLs from text ────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const seen = new Set<string>();
  const unique: string[] = [];
  matches.forEach(m => { if (!seen.has(m)) { seen.add(m); unique.push(m); } });
  return unique.slice(0, 3);
}

// ─── Client-side safety check ─────────────────────────────────────────────────

export function isObviouslyUnsafe(url: string): boolean {
  return BLOCKED_PATTERNS.some(p => p.test(url));
}

// ─── Fetch preview via API ────────────────────────────────────────────────────

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const cached = previewCache.get(url);
  if (cached) return cached;

  if (isObviouslyUnsafe(url)) {
    const unsafe: LinkPreview = {
      url, title: null, description: null, image: null, siteName: null,
      safe: false, checkedAt: new Date(),
    };
    previewCache.set(url, unsafe);
    return unsafe;
  }

  try {
    const encoded  = encodeURIComponent(url);
    const response = await fetch(`/api/link-preview?url=${encoded}`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) throw new Error('Preview fetch failed');

    const data    = await response.json() as LinkPreview;
    const preview = { ...data, checkedAt: new Date() };
    previewCache.set(url, preview);
    return preview;
  } catch {
    return {
      url, title: null, description: null, image: null, siteName: null,
      safe: true, // fail-open
      checkedAt: new Date(),
    };
  }
}
