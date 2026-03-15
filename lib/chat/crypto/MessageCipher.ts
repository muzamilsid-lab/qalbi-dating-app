/**
 * MessageCipher — encrypt/decrypt message content using the per-conversation
 * shared secret derived by KeyManager.
 *
 * Shared secrets are cached in a Map<conversationId, Uint8Array> to avoid
 * repeated ECDH computation on every message.
 */

import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { keyManager }                  from './KeyManager';
import { MessageContent, EncryptedPayload } from '../types';

export class MessageCipher {
  private static _instance: MessageCipher | null = null;
  /** conversationId → shared secret */
  private readonly secrets = new Map<string, Uint8Array>();

  static getInstance(): MessageCipher {
    if (!MessageCipher._instance) MessageCipher._instance = new MessageCipher();
    return MessageCipher._instance;
  }

  // ── Register a conversation's shared secret (call after key exchange) ──────

  registerSecret(conversationId: string, theirIdentityPublicB64: string): void {
    if (this.secrets.has(conversationId)) return; // already set
    const secret = keyManager.deriveSharedSecret(theirIdentityPublicB64);
    this.secrets.set(conversationId, secret);
  }

  // ── Encrypt a message payload ──────────────────────────────────────────────

  encrypt(conversationId: string, content: MessageContent): {
    ciphertext: Uint8Array;
    nonceB64: string;
    senderPublicKey: string;
  } {
    const secret    = this.requireSecret(conversationId);
    const plaintext = JSON.stringify(content);
    const { ciphertext, nonce } = keyManager.encrypt(plaintext, secret);

    return {
      ciphertext,
      nonceB64:        encodeBase64(nonce),
      senderPublicKey: keyManager.getIdentityPublicKey(),
    };
  }

  // ── Decrypt a message payload ──────────────────────────────────────────────

  decrypt(conversationId: string, payload: EncryptedPayload): MessageContent {
    const secret    = this.requireSecret(conversationId);
    const nonce     = decodeBase64(payload.nonce as unknown as string);
    const plaintext = keyManager.decrypt(payload.ciphertext, nonce, secret);
    return JSON.parse(plaintext) as MessageContent;
  }

  // ── Decrypt from raw DB fields ─────────────────────────────────────────────

  decryptRaw(
    conversationId: string,
    ciphertextB64: string,
    nonceB64: string,
  ): MessageContent {
    const secret = this.requireSecret(conversationId);
    const { decodeBase64 } = require('tweetnacl-util');
    const ciphertext = decodeBase64(ciphertextB64) as Uint8Array;
    const nonce      = decodeBase64(nonceB64)      as Uint8Array;
    const plaintext  = keyManager.decrypt(ciphertext, nonce, secret);
    return JSON.parse(plaintext) as MessageContent;
  }

  forgetConversation(conversationId: string): void {
    this.secrets.delete(conversationId);
  }

  private requireSecret(conversationId: string): Uint8Array {
    const secret = this.secrets.get(conversationId);
    if (!secret) {
      throw new Error(
        `No shared secret for conversation ${conversationId}. ` +
        `Call registerSecret() after the key exchange.`
      );
    }
    return secret;
  }
}

export const messageCipher = MessageCipher.getInstance();
