/**
 * PhotoTokenService — HMAC-based short-lived signed tokens for private/match photos.
 *
 * Token format: base64url(JSON payload) + '.' + HMAC-SHA256
 * Payload: { photoId, viewerId, exp }
 *
 * Used server-side to generate URLs; validated in /api/photos/token route.
 * No external dependencies — uses Node.js built-in `crypto`.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.PHOTO_TOKEN_SECRET!;
const TOKEN_TTL_SECONDS = 60 * 60;   // 1 hour

interface TokenPayload {
  photoId:  string;
  viewerId: string;
  exp:      number;   // Unix timestamp
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function signPhotoToken(photoId: string, viewerId: string): string {
  const payload: TokenPayload = {
    photoId,
    viewerId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const data = b64url(Buffer.from(JSON.stringify(payload)));
  const sig  = b64url(
    createHmac('sha256', SECRET)
      .update(data)
      .digest(),
  );

  return `${data}.${sig}`;
}

export interface VerifyResult {
  ok:       boolean;
  payload?: TokenPayload;
  error?:   string;
}

export function verifyPhotoToken(token: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'Malformed token' };

  const [data, sig] = parts;

  // Constant-time signature comparison
  const expectedSig = b64url(
    createHmac('sha256', SECRET)
      .update(data)
      .digest(),
  );

  const expected = Buffer.from(expectedSig);
  const actual   = Buffer.from(sig);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, error: 'Invalid signature' };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'Invalid payload' };
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) {
    return { ok: false, error: 'Token expired' };
  }

  return { ok: true, payload };
}

/**
 * Build a signed photo URL for the given viewer.
 * The returned URL should be proxied through /api/photos/token?t=...
 */
export function buildPhotoUrl(photoId: string, viewerId: string): string {
  const token = signPhotoToken(photoId, viewerId);
  return `/api/photos/token?t=${encodeURIComponent(token)}`;
}
