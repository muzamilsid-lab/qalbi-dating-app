import { useCallback, useEffect, useRef, useState } from 'react';

export function useVoicePlayer(url: string, durationSeconds: number) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);   // 0–1
  const [elapsed,  setElapsed]  = useState(0);   // seconds
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(false);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const rafRef    = useRef<number>(0);

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    setProgress(p);
    setElapsed(audio.currentTime);
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // ── Play / Pause ──────────────────────────────────────────────────────────
  const toggle = useCallback(async () => {
    if (!audioRef.current) {
      setLoading(true);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
        setElapsed(0);
        cancelAnimationFrame(rafRef.current);
      });

      audio.addEventListener('error', () => {
        setError(true);
        setLoading(false);
        setPlaying(false);
      });

      audio.addEventListener('canplay', () => setLoading(false));
    }

    const audio = audioRef.current;

    if (playing) {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError(true);
      }
    }
  }, [url, playing, tick]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = fraction * audio.duration;
    setProgress(fraction);
    setElapsed(audio.currentTime);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [url]);

  return {
    playing, progress, elapsed,
    loading, error,
    toggle, seek,
    remaining: Math.max(0, durationSeconds - elapsed),
  };
}
