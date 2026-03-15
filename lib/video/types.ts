// ─── Call state machine ───────────────────────────────────────────────────────

export type CallStatus =
  | 'idle'
  | 'requesting'        // outbound: waiting for recipient
  | 'ringing'           // inbound: showing ring UI
  | 'pre-call'          // accepted: camera/mic test
  | 'joining'           // entering Daily.co room
  | 'active'            // in call
  | 'ending'            // hangup in progress
  | 'ended'             // call finished, show feedback
  | 'declined'
  | 'missed'
  | 'failed';

export type CallEndReason =
  | 'local_hangup'
  | 'remote_hangup'
  | 'duration_limit'
  | 'network_error'
  | 'declined'
  | 'missed';

// ─── DB-level call record ─────────────────────────────────────────────────────

export interface VideoCall {
  id:              string;
  conversationId:  string;
  initiatorId:     string;
  recipientId:     string;
  status:          CallStatus;
  dailyRoomName:   string | null;
  dailyRoomUrl:    string | null;
  startedAt:       Date | null;
  endedAt:         Date | null;
  durationSeconds: number | null;
  extensionCount:  number;
  createdAt:       Date;
}

// ─── Participant video state ──────────────────────────────────────────────────

export interface ParticipantState {
  sessionId:    string;
  userId:       string;
  displayName:  string;
  videoTrack:   MediaStreamTrack | null;
  audioTrack:   MediaStreamTrack | null;
  videoOn:      boolean;
  audioOn:      boolean;
  isLocal:      boolean;
}

// ─── Local media controls ─────────────────────────────────────────────────────

export interface LocalMediaState {
  videoOn:       boolean;
  audioOn:       boolean;
  blurEnabled:   boolean;
  beautyEnabled: boolean;
  isFrontCamera: boolean;
  activeCamera:  string | null;
  activeMic:     string | null;
  activeSpeaker: string | null;
}

// ─── Background effect ────────────────────────────────────────────────────────

export type BackgroundEffect = 'none' | 'blur' | 'blur-strong';

// ─── Post-call rating ─────────────────────────────────────────────────────────

export interface CallRating {
  callId:         string;
  rating:         1 | 2 | 3 | 4 | 5;
  unmatchAfter:   boolean;
  note?:          string;
}

// ─── Ring notification payload (sent via Supabase Realtime broadcast) ─────────

export interface RingPayload {
  callId:         string;
  conversationId: string;
  initiatorId:    string;
  initiatorName:  string;
  initiatorPhoto: string | null;
}

// ─── Daily.co room config ─────────────────────────────────────────────────────

export interface DailyRoomConfig {
  roomName:  string;
  roomUrl:   string;
  token:     string;
  expiresAt: number;
}

// ─── Call durations ───────────────────────────────────────────────────────────

export const BASE_DURATION_MINUTES = 15;
export const EXTENSION_MINUTES     = 15;
export const MAX_EXTENSIONS        = 3;
export const WARNING_SECONDS       = 60; // show warning banner this many seconds before end
