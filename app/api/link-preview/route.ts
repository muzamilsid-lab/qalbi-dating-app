import { NextRequest, NextResponse } from 'next/server';

const BLOCKED_PATTERNS = [
  /bit\.ly\/[a-z0-9]+$/i,
  /tinyurl\.com/i,
  /paypal.*verify/i,
  /account.*suspend/i,
];

const ALLOWED_PROTOCOLS = ['https:'];
const REQUEST_TIMEOUT_MS = 4_000;

// ─── GET /api/link-preview?url=... ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 422 });
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return NextResponse.json({ safe: false, url }, { status: 200 });
  }

  // Block known patterns
  if (BLOCKED_PATTERNS.some(p => p.test(url))) {
    return NextResponse.json({
      url, safe: false, title: null, description: null, image: null, siteName: null,
    });
  }

  // Block internal / private ranges
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')     ||
    hostname.startsWith('172.')    ||
    hostname === '127.0.0.1'
  ) {
    return NextResponse.json({ safe: false, url });
  }

  // Fetch the page HTML (server-side, so no CORS issues)
  let html = '';
  try {
    const res = await fetch(url, {
      signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'User-Agent': 'QalbiBot/1.0 (+https://qalbi.app/bot)',
        'Accept':     'text/html',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ url, safe: true, title: null, description: null, image: null, siteName: null });
    }

    // Only read first 50kb
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body');

    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (bytes < 50_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      bytes += value.byteLength;
    }
    reader.cancel();
    html = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc); merged.set(c, acc.length);
        return merged;
      }, new Uint8Array(0))
    );
  } catch {
    return NextResponse.json({
      url, safe: true, title: null, description: null, image: null, siteName: null,
    });
  }

  // Parse OG / meta tags
  const ogTitle       = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
                     ?? html.match(/<title>([^<]+)<\/title>/i)?.[1]
                     ?? null;
  const ogDescription = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
                     ?? html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
                     ?? null;
  const ogImage       = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? null;
  const ogSiteName    = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1] ?? null;

  return NextResponse.json(
    {
      url,
      safe:        true,
      title:       ogTitle       ? decode(ogTitle.slice(0, 120))       : null,
      description: ogDescription ? decode(ogDescription.slice(0, 200)) : null,
      image:       ogImage       ? sanitiseImageUrl(ogImage, parsed)   : null,
      siteName:    ogSiteName    ? ogSiteName.slice(0, 60)             : parsed.hostname,
    },
    {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
    },
  );
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function sanitiseImageUrl(raw: string, baseUrl: URL): string | null {
  try {
    const img = new URL(raw, baseUrl.origin);
    if (!ALLOWED_PROTOCOLS.includes(img.protocol)) return null;
    return img.toString();
  } catch {
    return null;
  }
}
