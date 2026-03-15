import { config as loadDotenv } from 'dotenv';
import path from 'path';

loadDotenv({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),

  db: {
    url: required('DATABASE_URL'),
    poolMin: parseInt(optional('DB_POOL_MIN', '2'), 10),
    poolMax: parseInt(optional('DB_POOL_MAX', '10'), 10),
  },

  aws: {
    accessKeyId:     required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    region:          optional('AWS_REGION', 'us-east-1'),
    collectionId:    optional('AWS_REKOGNITION_COLLECTION', 'face-verification'),
  },

  encryption: {
    // 32-byte key encoded as 64-char hex string
    key: required('ENCRYPTION_KEY'),
  },

  session: {
    ttlSeconds:   parseInt(optional('SESSION_TTL_SECONDS', '300'), 10), // 5 min
    maxAttempts:  parseInt(optional('SESSION_MAX_ATTEMPTS', '3'), 10),
  },

  rateLimit: {
    windowMs:     parseInt(optional('RATE_LIMIT_WINDOW_MS', String(60 * 60 * 1000)), 10), // 1h
    maxRequests:  parseInt(optional('RATE_LIMIT_MAX', '3'), 10),
  },

  gdpr: {
    imageRetentionMs: parseInt(optional('IMAGE_RETENTION_MS', String(24 * 60 * 60 * 1000)), 10), // 24h
  },

  similarity: {
    threshold: parseFloat(optional('SIMILARITY_THRESHOLD', '95')),
  },

  liveness: {
    minFrames:        parseInt(optional('LIVENESS_MIN_FRAMES', '10'), 10),
    passScore:        parseInt(optional('LIVENESS_PASS_SCORE', '70'), 10),
    blinkThreshold:   parseFloat(optional('BLINK_EYE_THRESHOLD', '0.3')),
    headTurnDegrees:  parseFloat(optional('HEAD_TURN_DEGREES', '15')),
    antiSpoofStdDev:  parseFloat(optional('ANTI_SPOOF_STD_DEV', '1.2')),
  },
} as const;

export type Config = typeof config;
