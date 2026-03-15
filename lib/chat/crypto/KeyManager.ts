/**
 * KeyManager — Curve25519 key pair generation + secure storage in IndexedDB.
 * Uses TweetNaCl's box (X25519 ECDH + XSalsa20-Poly1305).
 *
 * Key hierarchy:
 *   identityKey   — long-lived, created at registration, never changes
 *   signedPrekey  — rotated weekly, signed with identityKey
 *   oneTimePrekeys — consumed once per conversation establishment
 */

import nacl      from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { openDB, IDBPDatabase }       from 'idb';
import { KeyPair, StoredKeyBundle }   from '../types';

const DB_NAME    = 'qalbi-keys';
const DB_VERSION = 1;
const STORE      = 'key-bundle';
const KEY_ID     = 'local';

const ONE_TIME_PREKEY_COUNT = 10;

// ─── DB schema ────────────────────────────────────────────────────────────────

interface KeyDB {
  [STORE]: {
    key: string;
    value: {
      identityKey:     { publicKey: string; secretKey: string };
      signedPrekey:    { publicKey: string; secretKey: string };
      prekeySignature: string;
      oneTimePrekeys:  Array<{ id: number; publicKey: string; secretKey: string }>;
      createdAt:       number;
      signedPrekeyRotatedAt: number;
    };
  };
}

async function getDB(): Promise<IDBPDatabase<KeyDB>> {
  return openDB<KeyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

// ─── KeyManager ───────────────────────────────────────────────────────────────

export class KeyManager {
  private static _instance: KeyManager | null = null;
  private db: IDBPDatabase<KeyDB> | null = null;
  private bundle: StoredKeyBundle | null = null;

  static getInstance(): KeyManager {
    if (!KeyManager._instance) KeyManager._instance = new KeyManager();
    return KeyManager._instance;
  }

  // ── Init: load or generate keys ────────────────────────────────────────────

  async init(): Promise<void> {
    this.db = await getDB();
    const stored = await this.db.get(STORE, KEY_ID);

    if (!stored) {
      await this.generateAndStore();
    } else {
      this.bundle = this.deserialise(stored);
      // Rotate signed prekey weekly
      const weekMs = 7 * 24 * 3600 * 1000;
      if (Date.now() - stored.signedPrekeyRotatedAt > weekMs) {
        await this.rotateSignedPrekey();
      }
    }
  }

  // ── Public key bundle to publish to server ─────────────────────────────────

  getPublicBundle(): {
    identityKey: string;
    signedPrekey: string;
    prekeySignature: string;
    oneTimePrekeys: string[];
  } {
    const b = this.requireBundle();
    return {
      identityKey:     encodeBase64(b.identityKey.publicKey),
      signedPrekey:    encodeBase64(b.signedPrekey.publicKey),
      prekeySignature: encodeBase64(b.prekeySignature),
      oneTimePrekeys:  b.oneTimePrekeys.map(k => encodeBase64(k.publicKey)),
    };
  }

  // ── Derive shared secret for a conversation ────────────────────────────────
  //    Uses ECDH: sharedSecret = DH(myIdentitySecret, theirIdentityPublic)

  deriveSharedSecret(theirIdentityPublicB64: string): Uint8Array {
    const b = this.requireBundle();
    const theirPub = decodeBase64(theirIdentityPublicB64);
    // nacl.box.before computes Curve25519 DH + HSalsa20 KDF
    return nacl.box.before(theirPub, b.identityKey.secretKey);
  }

  // ── Encrypt a message ──────────────────────────────────────────────────────

  encrypt(plaintext: string, sharedSecret: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
    const nonce     = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encoded   = new TextEncoder().encode(plaintext);
    const ciphertext = nacl.secretbox(encoded, nonce, sharedSecret);
    if (!ciphertext) throw new Error('Encryption failed');
    return { ciphertext, nonce };
  }

  // ── Decrypt a message ──────────────────────────────────────────────────────

  decrypt(ciphertext: Uint8Array, nonce: Uint8Array, sharedSecret: Uint8Array): string {
    const plaintext = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
    if (!plaintext) throw new Error('Decryption failed — message may be corrupted or keys mismatched');
    return new TextDecoder().decode(plaintext);
  }

  // ── Identity public key (base64) ───────────────────────────────────────────

  getIdentityPublicKey(): string {
    return encodeBase64(this.requireBundle().identityKey.publicKey);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async generateAndStore(): Promise<void> {
    const identityKey  = nacl.box.keyPair();
    const signedPrekey = nacl.box.keyPair();

    // Sign the signedPrekey.publicKey with identityKey.secretKey using NaCl sign
    const signKp     = nacl.sign.keyPair.fromSeed(identityKey.secretKey.slice(0, 32));
    const signature  = nacl.sign.detached(signedPrekey.publicKey, signKp.secretKey);

    const oneTimePrekeys = Array.from({ length: ONE_TIME_PREKEY_COUNT }, () =>
      nacl.box.keyPair()
    );

    this.bundle = {
      identityKey,
      signedPrekey,
      prekeySignature: signature,
      oneTimePrekeys,
    };

    await this.persist(Date.now(), Date.now());
  }

  private async rotateSignedPrekey(): Promise<void> {
    const b = this.requireBundle();
    const newPrekey = nacl.box.keyPair();
    const signKp    = nacl.sign.keyPair.fromSeed(b.identityKey.secretKey.slice(0, 32));
    const signature = nacl.sign.detached(newPrekey.publicKey, signKp.secretKey);

    b.signedPrekey    = newPrekey;
    b.prekeySignature = signature;
    await this.persist(
      (await this.db!.get(STORE, KEY_ID))!.createdAt,
      Date.now(),
    );
  }

  private async persist(createdAt: number, signedPrekeyRotatedAt: number): Promise<void> {
    const b = this.requireBundle();
    await this.db!.put(STORE, {
      identityKey:  { publicKey: encodeBase64(b.identityKey.publicKey),  secretKey: encodeBase64(b.identityKey.secretKey) },
      signedPrekey: { publicKey: encodeBase64(b.signedPrekey.publicKey), secretKey: encodeBase64(b.signedPrekey.secretKey) },
      prekeySignature: encodeBase64(b.prekeySignature),
      oneTimePrekeys: b.oneTimePrekeys.map((k, i) => ({
        id: i,
        publicKey:  encodeBase64(k.publicKey),
        secretKey:  encodeBase64(k.secretKey),
      })),
      createdAt,
      signedPrekeyRotatedAt,
    }, KEY_ID);
  }

  private deserialise(stored: KeyDB[typeof STORE]['value']): StoredKeyBundle {
    return {
      identityKey: {
        publicKey: decodeBase64(stored.identityKey.publicKey),
        secretKey: decodeBase64(stored.identityKey.secretKey),
      },
      signedPrekey: {
        publicKey: decodeBase64(stored.signedPrekey.publicKey),
        secretKey: decodeBase64(stored.signedPrekey.secretKey),
      },
      prekeySignature: decodeBase64(stored.prekeySignature),
      oneTimePrekeys:  stored.oneTimePrekeys.map(k => ({
        publicKey: decodeBase64(k.publicKey),
        secretKey: decodeBase64(k.secretKey),
      })),
    };
  }

  private requireBundle(): StoredKeyBundle {
    if (!this.bundle) throw new Error('KeyManager not initialised — call init() first');
    return this.bundle;
  }

  // ── Wipe all keys (on logout / account deletion) ──────────────────────────

  async wipe(): Promise<void> {
    if (this.db) await this.db.delete(STORE, KEY_ID);
    this.bundle = null;
  }
}

export const keyManager = KeyManager.getInstance();
