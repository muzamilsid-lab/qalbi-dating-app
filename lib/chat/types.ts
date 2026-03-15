// ─── Wire types (match DB schema) ─────────────────────────────────────────────

export type ContentType =
  | 'text' | 'image' | 'voice' | 'gif'
  | 'location' | 'date_suggestion' | 'system';

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface DBMessage {
  id: string;
  conversationId: string;
  senderId: string;
  contentEncrypted: Uint8Array | null;
  contentType: ContentType;
  metadata: Record<string, unknown>;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  deletedAt: Date | null;
  expiresAt: Date | null;
  unsentAt: Date | null;
}

export interface DBConversation {
  id: string;
  matchId: string;
  lastMessageId: string | null;
  lastActivityAt: Date;
  userAId: string;
  userBId: string;
  userAUnreadCount: number;
  userBUnreadCount: number;
}

// ─── Decrypted (client-side) message ──────────────────────────────────────────

export interface DecryptedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: ContentType;
  content: MessageContent;
  status: MessageStatus;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  expiresAt: Date | null;
  reactions: Reaction[];
  // Local-only fields
  localId?: string;    // optimistic ID before server ack
  failReason?: string;
}

export type MessageContent =
  | TextContent
  | ImageContent
  | VoiceContent
  | GifContent
  | LocationContent
  | DateSuggestionContent
  | SystemContent;

export interface TextContent     { type: 'text';            text: string }
export interface ImageContent    { type: 'image';           url: string; width: number; height: number; blurHash?: string; sizeBytes: number }
export interface VoiceContent    { type: 'voice';           url: string; durationMs: number; waveform: number[] }
export interface GifContent      { type: 'gif';             giphyId: string; url: string; width: number; height: number; title: string }
export interface LocationContent { type: 'location';        lat: number; lng: number; label?: string }
export interface DateSuggestionContent { type: 'date_suggestion'; suggestedAt: string; venueName?: string; venueAddress?: string; note?: string; status: 'pending' | 'accepted' | 'declined' }
export interface SystemContent   { type: 'system';          event: string; body?: string }

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
  reactorIds: string[];
}

// ─── Realtime events ──────────────────────────────────────────────────────────

export interface TypingEvent {
  userId: string;
  displayName: string;
  conversationId: string;
  isTyping: boolean;
}

export interface PresenceState {
  userId: string;
  online: boolean;
  lastSeenAt: Date | null;
}

export interface ReadReceiptEvent {
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface DeliveryEvent {
  messageId: string;
  deliveredAt: Date;
}

// ─── Message queue ────────────────────────────────────────────────────────────

export interface QueuedMessage {
  localId: string;
  conversationId: string;
  senderId: string;
  contentType: ContentType;
  content: MessageContent;
  expiresAt: Date | null;
  attempts: number;
  nextRetryAt: Date;
  createdAt: Date;
}

// ─── Crypto ───────────────────────────────────────────────────────────────────

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface StoredKeyBundle {
  identityKey: KeyPair;
  signedPrekey: KeyPair;
  prekeySignature: Uint8Array;
  oneTimePrekeys: KeyPair[];
}

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  senderPublicKey: string;  // base64 — so recipient knows which public key was used
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

export interface PrivacySettings {
  readReceipts: boolean;
  disappearingDefault: boolean;
  screenshotNotify: boolean;
}

// ─── Conversation with participant info ───────────────────────────────────────

export interface ConversationWithPartner extends DBConversation {
  partner: {
    id: string;
    displayName: string;
    photoUrl: string | null;
    isVerified: boolean;
    privacySettings: PrivacySettings;
  };
  myUnreadCount: number;
}
