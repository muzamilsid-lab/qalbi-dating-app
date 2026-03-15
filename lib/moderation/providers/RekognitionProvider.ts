import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  type ModerationLabel as AWSLabel,
} from '@aws-sdk/client-rekognition';
import type { ProviderResult, ModerationLabel, ModerationVerdict } from '../types';
import { CONFIDENCE_REJECT, CONFIDENCE_QUEUE } from '../types';

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  if (!_client) {
    _client = new RekognitionClient({
      region:      process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// ─── Categories that trigger moderation ──────────────────────────────────────

const REJECT_CATEGORIES = new Set([
  'Explicit Nudity',
  'Nudity',
  'Graphic Male Nudity',
  'Graphic Female Nudity',
  'Sexual Activity',
  'Illustrated Explicit Nudity',
  'Violence',
  'Graphic Violence Or Gore',
  'Physical Violence',
  'Weapon Violence',
  'Weapons',
  'Drugs',
  'Drug Products',
  'Drug Use',
  'Drug Paraphernalia',
  'Child Erotica',
]);

const QUEUE_CATEGORIES = new Set([
  'Suggestive',
  'Non-Explicit Nudity',
  'Partial Nudity',
  'Revealing Clothes',
  'Barechested Male',
  'Female Swimwear Or Underwear',
  'Male Swimwear Or Underwear',
  'Air Crash',
  'Emaciated Bodies',
  'Corpses',
  'Hanging',
  'Rude Gestures',
  'Middle Finger',
  'Gambling',
  'Tobacco',
]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a photo already stored in S3.
 * Pass either { bucket, key } for S3 or { bytes } for raw image bytes.
 */
export async function analysePhoto(source: {
  bucket?: string;
  key?:    string;
  bytes?:  Uint8Array;
}): Promise<ProviderResult> {
  const client = getClient();

  const command = new DetectModerationLabelsCommand({
    Image: source.bytes
      ? { Bytes: source.bytes }
      : { S3Object: { Bucket: source.bucket!, Name: source.key! } },
    MinConfidence: CONFIDENCE_QUEUE * 100,   // AWS uses 0–100
  });

  let awsLabels: AWSLabel[] = [];
  try {
    const response = await client.send(command);
    awsLabels = response.ModerationLabels ?? [];
  } catch (err: any) {
    // If Rekognition is unavailable, queue for human review rather than blocking
    return {
      verdict:    'queue',
      confidence: 0,
      reason:     `Rekognition unavailable: ${err.message}`,
      labels:     [],
      raw:        err,
    };
  }

  if (awsLabels.length === 0) {
    return { verdict: 'clean', confidence: 0, reason: 'No flags', labels: [] };
  }

  // Map to internal labels
  const labels: ModerationLabel[] = awsLabels.map(l => ({
    name:       l.Name ?? '',
    confidence: (l.Confidence ?? 0) / 100,
    parentName: l.ParentName ?? undefined,
  }));

  // Sort by confidence descending
  labels.sort((a, b) => b.confidence - a.confidence);

  const topLabel      = labels[0];
  const topConfidence = topLabel.confidence;

  // Determine verdict
  let verdict: ModerationVerdict = 'clean';
  let reason = topLabel.name;

  for (const label of labels) {
    const cat = label.name;
    if (REJECT_CATEGORIES.has(cat) && label.confidence >= CONFIDENCE_REJECT) {
      verdict = 'reject';
      reason  = cat;
      break;
    }
    if (
      (REJECT_CATEGORIES.has(cat) || QUEUE_CATEGORIES.has(cat)) &&
      label.confidence >= CONFIDENCE_QUEUE
    ) {
      verdict = 'queue';
      reason  = cat;
    }
  }

  return { verdict, confidence: topConfidence, reason, labels, raw: awsLabels };
}
