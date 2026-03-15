/**
 * DailyService — server-side Daily.co REST API calls.
 * Used exclusively in API routes (never imported client-side).
 */

const DAILY_API_BASE = 'https://api.daily.co/v1';
const DAILY_API_KEY  = process.env.DAILY_API_KEY!;

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DAILY_API_KEY}`,
  };
}

// ─── Room creation ────────────────────────────────────────────────────────────

export interface DailyRoom {
  id:         string;
  name:       string;
  url:        string;
  created_at: number;
  config:     Record<string, unknown>;
}

export async function createRoom(options: {
  maxDurationSeconds:  number;
  enableRecordingPrev: boolean;
}): Promise<DailyRoom> {
  const exp = Math.floor(Date.now() / 1000) + options.maxDurationSeconds + 300; // +5min buffer

  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      privacy: 'private',
      properties: {
        exp,
        max_participants:      2,
        enable_screenshare:    false,      // no screenshare in dates
        enable_recording:      'none',     // disable recording at room level
        start_video_off:       false,
        start_audio_off:       false,
        autojoin:              false,
        // Security
        enable_knocking:       false,
        eject_at_room_exp:     true,
        // Codecs
        video_codec:           'VP8',
        // Bandwidth caps
        sfu_switchover:        0.5,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily.co room creation failed: ${err}`);
  }

  return res.json();
}

// ─── Meeting token ────────────────────────────────────────────────────────────

export async function createToken(options: {
  roomName:        string;
  userId:          string;
  userName:        string;
  isOwner:         boolean;     // initiator gets owner powers (eject, etc.)
  expiresInSeconds: number;
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + options.expiresInSeconds;

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        room_name:      options.roomName,
        user_id:        options.userId,
        user_name:      options.userName,
        exp,
        is_owner:       options.isOwner,
        // Prevent recording from within the room
        enable_recording: false,
      },
    }),
  });

  if (!res.ok) throw new Error(`Daily.co token creation failed: ${await res.text()}`);
  const data = await res.json();
  return data.token as string;
}

// ─── Delete room (on call end) ────────────────────────────────────────────────

export async function deleteRoom(roomName: string): Promise<void> {
  await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    method:  'DELETE',
    headers: headers(),
  }).catch(() => {/* best-effort */});
}

// ─── Get active participant count ─────────────────────────────────────────────

export async function getRoomPresence(roomName: string): Promise<number> {
  const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}/presence`, {
    headers: headers(),
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return (data.data as any[])?.length ?? 0;
}
