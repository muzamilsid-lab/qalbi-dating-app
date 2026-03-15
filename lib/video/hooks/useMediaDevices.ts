'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MediaDevice {
  deviceId: string;
  label:    string;
}

export interface MediaDevicesState {
  cameras:       MediaDevice[];
  microphones:   MediaDevice[];
  speakers:      MediaDevice[];
  activeCamera:  string | null;
  activeMic:     string | null;
  activeSpeaker: string | null;
  previewStream: MediaStream | null;
  hasVideo:      boolean;
  hasAudio:      boolean;
  error:         string | null;
  loading:       boolean;
  // Levels
  audioLevel:    number;   // 0–100
}

export function useMediaDevices() {
  const [state, setState] = useState<MediaDevicesState>({
    cameras:       [],
    microphones:   [],
    speakers:      [],
    activeCamera:  null,
    activeMic:     null,
    activeSpeaker: null,
    previewStream: null,
    hasVideo:      false,
    hasAudio:      false,
    error:         null,
    loading:       true,
    audioLevel:    0,
  });

  const streamRef    = useRef<MediaStream | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const rafRef       = useRef<number>(0);
  const audioCtxRef  = useRef<AudioContext | null>(null);

  // ── Enumerate devices ──────────────────────────────────────────────────────

  const enumerate = useCallback(async () => {
    try {
      const devices  = await navigator.mediaDevices.enumerateDevices();
      const cameras  = devices.filter(d => d.kind === 'videoinput').map(deviceToItem);
      const mics     = devices.filter(d => d.kind === 'audioinput').map(deviceToItem);
      const speakers = devices.filter(d => d.kind === 'audiooutput').map(deviceToItem);
      setState(s => ({ ...s, cameras, microphones: mics, speakers }));
    } catch {/* silent */}
  }, []);

  // ── Start preview stream ───────────────────────────────────────────────────

  const startPreview = useCallback(async (cameraId?: string, micId?: string) => {
    setState(s => ({ ...s, loading: true, error: null }));

    // Stop previous
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    cancelAnimationFrame(rafRef.current);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
        audio: micId    ? { deviceId: { exact: micId } }    : true,
      });

      streamRef.current = stream;

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      // Audio level metering
      if (hasAudio) {
        const ctx      = new AudioContext();
        const src      = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const tick = () => {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setState(s => ({ ...s, audioLevel: Math.round((avg / 128) * 100) }));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      await enumerate();

      setState(s => ({
        ...s,
        previewStream: stream,
        activeCamera:  stream.getVideoTracks()[0]?.getSettings().deviceId ?? s.cameras[0]?.deviceId ?? null,
        activeMic:     stream.getAudioTracks()[0]?.getSettings().deviceId ?? s.microphones[0]?.deviceId ?? null,
        hasVideo,
        hasAudio,
        loading: false,
        error:   null,
      }));
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera/mic permission denied. Please allow access in browser settings.'
        : err.name === 'NotFoundError'
        ? 'No camera or microphone found.'
        : `Device error: ${err.message}`;

      setState(s => ({ ...s, loading: false, error: msg, hasVideo: false, hasAudio: false }));
    }
  }, [enumerate]);

  // ── Switch camera ──────────────────────────────────────────────────────────

  const switchCamera = useCallback(async (deviceId: string) => {
    setState(s => ({ ...s, activeCamera: deviceId }));
    await startPreview(deviceId, state.activeMic ?? undefined);
  }, [startPreview, state.activeMic]);

  const switchMic = useCallback(async (deviceId: string) => {
    setState(s => ({ ...s, activeMic: deviceId }));
    await startPreview(state.activeCamera ?? undefined, deviceId);
  }, [startPreview, state.activeCamera]);

  const setSpeaker = useCallback((deviceId: string) => {
    setState(s => ({ ...s, activeSpeaker: deviceId }));
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    cancelAnimationFrame(rafRef.current);
    setState(s => ({ ...s, previewStream: null, audioLevel: 0 }));
  }, []);

  useEffect(() => {
    startPreview();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => {
      stopPreview();
      navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    };
  }, []);

  return { ...state, startPreview, stopPreview, switchCamera, switchMic, setSpeaker };
}

function deviceToItem(d: MediaDeviceInfo): MediaDevice {
  return { deviceId: d.deviceId, label: d.label || `Device ${d.deviceId.slice(0, 6)}` };
}
