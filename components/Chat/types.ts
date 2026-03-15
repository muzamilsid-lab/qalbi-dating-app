export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageType =
  | 'text'
  | 'image'
  | 'voice'
  | 'video'
  | 'gif'
  | 'location'
  | 'date_suggestion';

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

// ─── Per-type payloads ────────────────────────────────────────────────────────

export interface TextPayload     { text: string }

export interface ImagePayload {
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  alt?: string;
}

export interface VoicePayload {
  url: string;
  durationSeconds: number;
  /** Normalised amplitude values 0–1 for waveform bars */
  waveform: number[];
}

export interface VideoPayload {
  url: string;
  thumbnailUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export interface GifPayload {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface LocationPayload {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
  /** Optional static map image URL (generated server-side) */
  staticMapUrl?: string;
}

export interface DateSuggestionPayload {
  suggestedAt: Date;
  venueName?: string;
  venueAddress?: string;
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
}

type PayloadMap = {
  text:            TextPayload;
  image:           ImagePayload;
  voice:           VoicePayload;
  video:           VideoPayload;
  gif:             GifPayload;
  location:        LocationPayload;
  date_suggestion: DateSuggestionPayload;
};

export interface Message<T extends MessageType = MessageType> {
  id: string;
  type: T;
  payload: PayloadMap[T];
  senderId: string;
  /** ISO string */
  sentAt: string;
  status: MessageStatus;
  reactions: Reaction[];
  replyTo?: { id: string; preview: string };
}

// ─── Display grouping ─────────────────────────────────────────────────────────

export interface MessageGroup {
  date: string;                 // display label e.g. "Today", "Monday"
  messages: MessageWithMeta[];
}

export interface MessageWithMeta extends Message {
  /** First message from this sender in consecutive run */
  isGroupStart: boolean;
  /** Last message in consecutive run — shows tail + status */
  isGroupEnd: boolean;
  isMine: boolean;
}

export type ReactionEmoji = '❤️' | '😂' | '😮' | '😢' | '😠' | '👍';
export const REACTION_EMOJIS: ReactionEmoji[] = ['❤️', '😂', '😮', '😢', '😠', '👍'];
