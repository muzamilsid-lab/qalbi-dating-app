'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { createClient }  from '@/lib/supabase/client';
import {
  CallStatus, CallEndReason, ParticipantState, LocalMediaState,
  BackgroundEffect, DailyRoomConfig, RingPayload,
} from '../types';

// ─── State ────────────────────────────────────────────────────────────────────

interface UseVideoCallState {
  status:          CallStatus;
  callId:          string | null;
  conversationId:  string | null;
  roomConfig:      DailyRoomConfig | null;
  localState:      LocalMediaState;
  remoteParticipant: ParticipantState | null;
  extensionCount:  number;
  startedAt:       Date | null;
  endReason:       CallEndReason | null;
  error:           string | null;
  incomingRing:    RingPayload | null;
}

const DEFAULT_LOCAL: LocalMediaState = {
  videoOn:       true,
  audioOn:       true,
  blurEnabled:   false,
  beautyEnabled: false,
  isFrontCamera: true,
  activeCamera:  null,
  activeMic:     null,
  activeSpeaker: null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseVideoCallOptions {
  myUserId:      string;
  myDisplayName: string;
}

export function useVideoCall({ myUserId, myDisplayName }: UseVideoCallOptions) {
  const supabase  = createClient();
  const callRef   = useRef<DailyCall | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [s, setS] = useState<UseVideoCallState>({
    status:            'idle',
    callId:            null,
    conversationId:    null,
    roomConfig:        null,
    localState:        DEFAULT_LOCAL,
    remoteParticipant: null,
    extensionCount:    0,
    startedAt:         null,
    endReason:         null,
    error:             null,
    incomingRing:      null,
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateStatus = (status: CallStatus) => setS(p => ({ ...p, status }));
  const updateLocal  = (patch: Partial<LocalMediaState>) =>
    setS(p => ({ ...p, localState: { ...p.localState, ...patch } }));

  // ── Subscribe to incoming ring notifications ───────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`ring:${myUserId}`)
      .on('broadcast', { event: 'ring' }, ({ payload }: { payload: RingPayload }) => {
        setS(p => {
          // Only show ring if we're idle
          if (p.status !== 'idle') return p;
          return { ...p, incomingRing: payload, status: 'ringing' };
        });
        // Play ring sound
        playRingTone();
      })
      .on('broadcast', { event: 'ring_cancelled' }, ({ payload }: { payload: { callId: string } }) => {
        setS(p => {
          if (p.callId === payload.callId || p.incomingRing?.callId === payload.callId) {
            return { ...p, status: 'missed', incomingRing: null };
          }
          return p;
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [myUserId]);

  // ── Initiate a call ───────────────────────────────────────────────────────

  const initiateCall = useCallback(async (
    conversationId: string,
    recipientId: string,
    recipientName: string,
  ) => {
    setS(p => ({ ...p, status: 'requesting', error: null }));

    try {
      const res = await fetch('/api/video/room', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationId, recipientId }),
      });
      if (!res.ok) throw new Error(await res.text());

      const { callId, roomConfig } = await res.json() as {
        callId: string;
        roomConfig: DailyRoomConfig;
      };

      setS(p => ({ ...p, callId, conversationId, roomConfig, status: 'requesting' }));
    } catch (err: any) {
      setS(p => ({ ...p, status: 'failed', error: err.message }));
    }
  }, []);

  // ── Accept an incoming call ───────────────────────────────────────────────

  const acceptCall = useCallback(async () => {
    const { incomingRing } = s;
    if (!incomingRing) return;
    stopRingTone();

    setS(p => ({ ...p, status: 'pre-call', incomingRing: null }));

    // Fetch room token
    const res = await fetch('/api/video/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callId: incomingRing.callId }),
    });
    if (!res.ok) { setS(p => ({ ...p, status: 'failed' })); return; }

    const { roomConfig } = await res.json();
    setS(p => ({ ...p, callId: incomingRing.callId, conversationId: incomingRing.conversationId, roomConfig, status: 'pre-call' }));
  }, [s]);

  // ── Decline ───────────────────────────────────────────────────────────────

  const declineCall = useCallback(async () => {
    const { incomingRing } = s;
    stopRingTone();
    setS(p => ({ ...p, status: 'idle', incomingRing: null }));
    if (!incomingRing) return;

    await fetch('/api/video/end', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callId: incomingRing.callId, action: 'decline' }),
    }).catch(() => {});
  }, [s]);

  // ── Join Daily.co room ────────────────────────────────────────────────────

  const joinRoom = useCallback(async () => {
    const { roomConfig, callId } = s;
    if (!roomConfig || !callId) return;

    updateStatus('joining');

    try {
      // Dynamically import Daily.co (browser-only)
      const { default: DailyIframe } = await import('@daily-co/daily-js');

      const co = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      callRef.current = co;

      // ── Event listeners ──────────────────────────────────────────────────

      co.on('joined-meeting', () => {
        updateStatus('active');
        setS(p => ({ ...p, startedAt: new Date() }));
      });

      co.on('participant-joined', (event: any) => {
        const p = event?.participant;
        if (!p || p.local) return;
        setS(prev => ({
          ...prev,
          remoteParticipant: mapParticipant(p),
        }));
      });

      co.on('participant-updated', (event: any) => {
        const p = event?.participant;
        if (!p || p.local) return;
        setS(prev => ({
          ...prev,
          remoteParticipant: mapParticipant(p),
        }));
      });

      co.on('participant-left', () => {
        setS(prev => ({ ...prev, remoteParticipant: null }));
        // Remote hung up
        endCall('remote_hangup');
      });

      co.on('error', (err: any) => {
        setS(prev => ({ ...prev, status: 'failed', error: err?.errorMsg ?? 'Connection error' }));
      });

      co.on('left-meeting', () => {
        setS(prev => ({ ...prev, status: 'ended' }));
      });

      // ── Join ─────────────────────────────────────────────────────────────

      await co.join({ url: roomConfig.roomUrl, token: roomConfig.token });
    } catch (err: any) {
      setS(p => ({ ...p, status: 'failed', error: err.message }));
    }
  }, [s]);

  // ── End call ──────────────────────────────────────────────────────────────

  const endCall = useCallback(async (reason: CallEndReason = 'local_hangup') => {
    setS(p => ({ ...p, status: 'ending', endReason: reason }));

    const co = callRef.current;
    if (co) {
      try { await co.leave(); } catch { /* ignore */ }
      try { co.destroy(); }     catch { /* ignore */ }
      callRef.current = null;
    }

    const { callId } = s;
    if (callId) {
      await fetch('/api/video/end', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ callId, action: 'end', reason }),
      }).catch(() => {});
    }

    setS(p => ({ ...p, status: 'ended', endReason: reason }));
  }, [s]);

  // ── Toggle video ──────────────────────────────────────────────────────────

  const toggleVideo = useCallback(async () => {
    const co = callRef.current;
    if (!co) return;
    const next = !s.localState.videoOn;
    await co.setLocalVideo(next);
    updateLocal({ videoOn: next });
  }, [s.localState.videoOn]);

  // ── Toggle audio ──────────────────────────────────────────────────────────

  const toggleAudio = useCallback(async () => {
    const co = callRef.current;
    if (!co) return;
    const next = !s.localState.audioOn;
    await co.setLocalAudio(next);
    updateLocal({ audioOn: next });
  }, [s.localState.audioOn]);

  // ── Background effect ─────────────────────────────────────────────────────

  const setBackgroundEffect = useCallback(async (effect: BackgroundEffect) => {
    const co = callRef.current;
    if (!co) return;

    const processor = effect === 'none'
      ? { type: 'none' as const }
      : { type: 'background-blur' as const, config: { strength: effect === 'blur-strong' ? 1 : 0.5 } };

    try {
      await co.updateInputSettings({ video: { processor } });
      updateLocal({ blurEnabled: effect !== 'none' });
    } catch { /* Daily.co blur may not be available on all devices */ }
  }, []);

  // ── Beauty filter (CSS filter applied externally to video element) ─────────
  const toggleBeauty = useCallback(() => {
    updateLocal({ beautyEnabled: !s.localState.beautyEnabled });
  }, [s.localState.beautyEnabled]);

  // ── Extend call ───────────────────────────────────────────────────────────

  const extendCall = useCallback(async () => {
    if (!s.callId || s.extensionCount >= 3) return;
    const res = await fetch('/api/video/end', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callId: s.callId, action: 'extend' }),
    });
    if (res.ok) setS(p => ({ ...p, extensionCount: p.extensionCount + 1 }));
  }, [s.callId, s.extensionCount]);

  // ── Report ────────────────────────────────────────────────────────────────

  const reportUser = useCallback(async (reason: string, frameDataUrl?: string) => {
    if (!s.callId) return;
    await fetch('/api/video/report', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callId: s.callId, reason, frameDataUrl }),
    });
  }, [s.callId]);

  // ── Capture frame for AI moderation ──────────────────────────────────────

  const captureFrame = useCallback((): string | null => {
    const co = callRef.current;
    if (!co) return null;
    try {
      // @ts-ignore — internal method
      const video = document.querySelector('[data-daily-video-remote]') as HTMLVideoElement | null;
      if (!video) return null;
      const canvas = document.createElement('canvas');
      canvas.width  = 320;
      canvas.height = 240;
      canvas.getContext('2d')?.drawImage(video, 0, 0, 320, 240);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch { return null; }
  }, []);

  // ── Get Daily call object (for video tile rendering) ──────────────────────

  const getCallObject = useCallback(() => callRef.current, []);

  // ── Dismiss post-call UI ──────────────────────────────────────────────────

  const dismissEnded = useCallback(() => {
    setS({
      status:            'idle',
      callId:            null,
      conversationId:    null,
      roomConfig:        null,
      localState:        DEFAULT_LOCAL,
      remoteParticipant: null,
      extensionCount:    0,
      startedAt:         null,
      endReason:         null,
      error:             null,
      incomingRing:      null,
    });
  }, []);

  return {
    ...s,
    initiateCall,
    acceptCall,
    declineCall,
    joinRoom,
    endCall,
    toggleVideo,
    toggleAudio,
    setBackgroundEffect,
    toggleBeauty,
    extendCall,
    reportUser,
    captureFrame,
    getCallObject,
    dismissEnded,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapParticipant(p: any): ParticipantState {
  return {
    sessionId:   p.session_id,
    userId:      p.user_id ?? p.session_id,
    displayName: p.user_name ?? 'Partner',
    videoTrack:  p.tracks?.video?.persistentTrack ?? null,
    audioTrack:  p.tracks?.audio?.persistentTrack ?? null,
    videoOn:     p.video ?? false,
    audioOn:     p.audio ?? false,
    isLocal:     p.local ?? false,
  };
}

let ringAudio: HTMLAudioElement | null = null;

function playRingTone() {
  if (typeof window === 'undefined') return;
  try {
    ringAudio = new Audio('/sounds/ring.mp3');
    ringAudio.loop = true;
    ringAudio.volume = 0.8;
    ringAudio.play().catch(() => {});
  } catch { /* silent */ }
}

function stopRingTone() {
  ringAudio?.pause();
  ringAudio = null;
}
