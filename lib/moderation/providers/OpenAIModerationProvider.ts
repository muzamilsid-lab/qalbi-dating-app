import OpenAI from 'openai';
import type { ProviderResult, ModerationLabel, ModerationVerdict } from '../types';
import { CONFIDENCE_REJECT, CONFIDENCE_QUEUE } from '../types';

// ─── Singleton ────────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

// ─── Category mapping ─────────────────────────────────────────────────────────

// Categories that should auto-reject at high confidence
const REJECT_CATEGORIES = new Set([
  'sexual',
  'sexual/minors',
  'violence/graphic',
  'self-harm/instructions',
  'harassment/threatening',
  'illicit/violent',
]);

const QUEUE_CATEGORIES = new Set([
  'harassment',
  'hate',
  'hate/threatening',
  'self-harm',
  'self-harm/intent',
  'violence',
  'illicit',
]);

// ─── Public API ───────────────────────────────────────────────────────────────

export async function moderateText(text: string): Promise<ProviderResult> {
  if (!text.trim()) {
    return { verdict: 'clean', confidence: 0, reason: 'Empty text', labels: [] };
  }

  let result: OpenAI.Moderation;
  try {
    const response = await getClient().moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });
    result = response.results[0];
  } catch (err: any) {
    return {
      verdict:    'queue',
      confidence: 0,
      reason:     `OpenAI unavailable: ${err.message}`,
      labels:     [],
      raw:        err,
    };
  }

  if (!result.flagged) {
    return { verdict: 'clean', confidence: 0, reason: 'Clean', labels: [] };
  }

  // Build label list from category scores
  const scores = result.category_scores as unknown as Record<string, number>;
  const labels: ModerationLabel[] = Object.entries(scores)
    .filter(([, score]) => score >= CONFIDENCE_QUEUE)
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  const topLabel      = labels[0] ?? { name: 'flagged', confidence: 0 };
  const topConfidence = topLabel.confidence;

  let verdict: ModerationVerdict = 'queue';
  let reason = topLabel.name;

  for (const label of labels) {
    if (REJECT_CATEGORIES.has(label.name) && label.confidence >= CONFIDENCE_REJECT) {
      verdict = 'reject';
      reason  = label.name;
      break;
    }
  }

  return { verdict, confidence: topConfidence, reason, labels, raw: result };
}
