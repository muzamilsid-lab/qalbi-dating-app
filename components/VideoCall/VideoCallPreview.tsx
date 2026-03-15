'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { clsx }                    from 'clsx';
import { useEffect, useRef }       from 'react';
import { useMediaDevices }         from '@/lib/video/hooks/useMediaDevices';

interface Props {
  onJoin:    () => void;
  onCancel:  () => void;
  partnerName: string;
}

// ─── Level bar ────────────────────────────────────────────────────────────────

function AudioLevelBar({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-0.5 h-5" aria-label={`Mic level: ${level}%`}>
      {Array.from({ length: 12 }, (_, i) => {
        const threshold = (i / 12) * 100;
        const active    = level >= threshold;
        return (
          <motion.div
            key={i}
            className={clsx(
              'w-1.5 rounded-sm',
              active
                ? i > 9 ? 'bg-red-400' : i > 6 ? 'bg-amber-400' : 'bg-emerald-400'
                : 'bg-white/20',
            )}
            animate={{ height: active ? 4 + (i / 12) * 14 : 4 }}
            transition={{ duration: 0.05 }}
          />
        );
      })}
    </div>
  );
}

// ─── Device selector ──────────────────────────────────────────────────────────

function DeviceSelect({
  label, devices, active, onChange,
}: {
  label: string;
  devices: { deviceId: string; label: string }[];
  active: string | null;
  onChange: (id: string) => void;
}) {
  if (devices.length <= 1) return null;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/50 text-xs uppercase tracking-wider">{label}</label>
      <select
        value={active ?? ''}
        onChange={e => onChange(e.target.value)}
        className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-400 truncate"
      >
        {devices.map(d => (
          <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function VideoCallPreview({ onJoin, onCancel, partnerName }: Props) {
  const media   = useMediaDevices();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && media.previewStream) {
      videoRef.current.srcObject = media.previewStream;
    }
  }, [media.previewStream]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe-top pt-5 pb-4">
        <button onClick={onCancel} className="text-white/60 hover:text-white transition-colors text-sm font-medium">
          Cancel
        </button>
        <p className="text-white font-semibold text-sm">Test your camera & mic</p>
        <div className="w-12" />
      </div>

      {/* Camera preview */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-gray-900">
          {media.loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
          ) : media.error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
              </div>
              <p className="text-white/80 text-sm">{media.error}</p>
              <button onClick={() => media.startPreview()} className="text-violet-400 text-sm font-semibold">
                Try again
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {/* Mic level overlay */}
          {media.hasAudio && (
            <div className="absolute bottom-4 left-4">
              <AudioLevelBar level={media.audioLevel} />
            </div>
          )}

          {/* Status badges */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <StatusBadge
              active={media.hasVideo}
              activeLabel="Camera on"
              inactiveLabel="No camera"
              icon={<CamIcon />}
            />
            <StatusBadge
              active={media.hasAudio}
              activeLabel="Mic on"
              inactiveLabel="No mic"
              icon={<MicIcon />}
            />
          </div>
        </div>
      </div>

      {/* Device settings */}
      <div className="px-5 pt-4 pb-2 flex flex-col gap-3">
        <DeviceSelect
          label="Camera"
          devices={media.cameras}
          active={media.activeCamera}
          onChange={media.switchCamera}
        />
        <DeviceSelect
          label="Microphone"
          devices={media.microphones}
          active={media.activeMic}
          onChange={media.switchMic}
        />
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe-bottom pb-8 flex flex-col gap-3">
        <p className="text-white/40 text-xs text-center">
          Ready to meet {partnerName}? Your 15-minute video date begins now.
        </p>
        <motion.button
          onClick={() => { media.stopPreview(); onJoin(); }}
          disabled={media.loading || !!media.error}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
          whileTap={{ scale: 0.97 }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
          </svg>
          Join Video Date
        </motion.button>
      </div>
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

function StatusBadge({ active, activeLabel, inactiveLabel, icon }: {
  active: boolean; activeLabel: string; inactiveLabel: string; icon: React.ReactNode;
}) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
      active ? 'bg-black/40 text-white' : 'bg-red-500/80 text-white',
    )}>
      {icon}
      <span>{active ? activeLabel : inactiveLabel}</span>
    </div>
  );
}

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
      <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
      <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21h2v-3.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
    </svg>
  );
}
