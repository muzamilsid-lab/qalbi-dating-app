import type { ProviderResult, ModerationLabel } from '../types';

// ─── Contact info extraction patterns ────────────────────────────────────────

// International phone numbers — covers GCC formats (+966, +971, +974, etc.) + generic
const PHONE_RE = /(?:\+|00)?\d[\d\s\-().]{7,}\d/g;

// Social media handles / usernames across common platforms
const SOCIAL_RE =
  /(?:snap(?:chat)?|insta(?:gram)?|ig|tiktok|fb|facebook|twitter|x\.com|telegram|tg|whatsapp|wa)[:\s@#]*[a-z0-9._-]{3,}/gi;

// Raw @handle pattern (could be any platform)
const HANDLE_RE = /@[a-zA-Z0-9._]{3,}/g;

// External URLs (not internal app links)
const URL_RE = /https?:\/\/[^\s]+|(?:www|bit\.ly|t\.me|wa\.me)[^\s]*/gi;

// ─── Banned words ─────────────────────────────────────────────────────────────
// English terms (lowercase)

const ENGLISH_BAD = [
  // Explicit/slurs — represented here as patterns; expand as needed
  'fuck', 'bitch', 'cunt', 'whore', 'slut', 'nigger', 'faggot',
  'kys', 'kill yourself', 'die bitch',
  // Scam / off-platform solicitation
  'onlyfans', 'cashapp me', 'send money', 'western union', 'moneygram',
  'paypal me', 'gift card', 'bitcoin address',
  // Self-harm
  'suicide', 'self harm', 'cut myself',
];

// Arabic terms (common harassment / explicit / hate speech)
// Using transliterated Unicode — ensure source file is UTF-8
const ARABIC_BAD = [
  'كس',    // explicit
  'طيز',   // explicit
  'شرموطة', // slur
  'عاهرة',  // slur
  'زب',    // explicit
  'أنيك',  // explicit
  'يلعن',  // curse
  'كلب',   // derogatory
  'خنزير', // derogatory
  'موت',   // threat context
  'اقتلك', // "I'll kill you"
  'اخويا اعطيني رقمك', // soliciting contact off-platform
];

// Build fast regex from word lists
function buildWordRegex(words: string[]): RegExp {
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'gi');
}

const ENGLISH_RE = buildWordRegex(ENGLISH_BAD);
const ARABIC_RE  = buildWordRegex(ARABIC_BAD);

// ─── Result type ──────────────────────────────────────────────────────────────

export interface PatternMatch {
  type:    'phone' | 'social' | 'handle' | 'url' | 'bad_word_en' | 'bad_word_ar';
  match:   string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function scanText(text: string): ProviderResult {
  const matches: PatternMatch[] = [];

  const run = (re: RegExp, type: PatternMatch['type']) => {
    const found = text.match(re);
    if (found) found.forEach(m => matches.push({ type, match: m.trim() }));
  };

  run(PHONE_RE,      'phone');
  run(SOCIAL_RE,     'social');
  run(HANDLE_RE,     'handle');
  run(URL_RE,        'url');
  run(ENGLISH_RE,    'bad_word_en');
  run(ARABIC_RE,     'bad_word_ar');

  if (matches.length === 0) {
    return { verdict: 'clean', confidence: 0, reason: 'No patterns', labels: [] };
  }

  // Hard reject for explicit bad words; queue for contact sharing
  const hasHardViolation = matches.some(
    m => m.type === 'bad_word_en' || m.type === 'bad_word_ar',
  );
  const hasContactShare = matches.some(
    m => m.type === 'phone' || m.type === 'social',
  );

  const labels: ModerationLabel[] = matches.map(m => ({
    name:       m.type,
    confidence: hasHardViolation ? 0.9 : 0.6,
  }));

  const seen = new Set<string>();
  const uniqueTypes: string[] = [];
  matches.forEach(m => { if (!seen.has(m.type)) { seen.add(m.type); uniqueTypes.push(m.type); } });
  const topTypes = uniqueTypes.join(', ');

  return {
    verdict:    hasHardViolation ? 'reject' : 'queue',
    confidence: hasHardViolation ? 0.9 : 0.6,
    reason:     `Pattern match: ${topTypes}`,
    labels,
    raw:        matches,
  };
}

/**
 * Exported separately for use in bio/profile text analysis.
 * Returns all extracted contact info for display in the moderation dashboard.
 */
export function extractContactInfo(text: string): PatternMatch[] {
  const out: PatternMatch[] = [];
  const run = (re: RegExp, type: PatternMatch['type']) => {
    const found = text.match(re);
    if (found) found.forEach(m => out.push({ type, match: m.trim() }));
  };
  run(PHONE_RE,  'phone');
  run(SOCIAL_RE, 'social');
  run(HANDLE_RE, 'handle');
  run(URL_RE,    'url');
  return out;
}
