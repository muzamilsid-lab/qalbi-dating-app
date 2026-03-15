import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

/**
 * AES-256-GCM encryption service.
 *
 * Layout of stored blob: <iv (12 bytes)><tag (16 bytes)><ciphertext>
 * Stored as base64 to be DB-safe.
 */
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hexKey = config.encryption.key;
    if (hexKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  // ─── Encrypt ──────────────────────────────────────────────────────────────

  encrypt(plaintext: Buffer | string): { ciphertext: string; iv: string } {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'base64') : plaintext;
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Concatenate tag + ciphertext, store separately from IV
    const blob = Buffer.concat([tag, encrypted]);

    return {
      ciphertext: blob.toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  // ─── Decrypt ──────────────────────────────────────────────────────────────

  decrypt(ciphertext: string, iv: string): Buffer {
    const ivBuf = Buffer.from(iv, 'base64');
    const blob = Buffer.from(ciphertext, 'base64');

    const tag = blob.subarray(0, TAG_BYTES);
    const encrypted = blob.subarray(TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, ivBuf);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  // ─── Image helpers ────────────────────────────────────────────────────────

  encryptImage(base64Image: string): { ciphertext: string; iv: string } {
    const raw = Buffer.from(base64Image, 'base64');
    return this.encrypt(raw);
  }

  decryptImage(ciphertext: string, iv: string): string {
    const raw = this.decrypt(ciphertext, iv);
    return raw.toString('base64');
  }

  // ─── Hashing ──────────────────────────────────────────────────────────────

  /** SHA-256 of original image bytes — used for deduplication */
  hashImage(base64Image: string): string {
    const raw = Buffer.from(base64Image, 'base64');
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Constant-time equality check — prevents timing attacks */
  secureCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }

  /** Wipe a buffer from memory after use */
  static wipe(buf: Buffer): void {
    buf.fill(0);
  }
}

// Singleton — key loaded once at startup
export const encryptionService = new EncryptionService();
