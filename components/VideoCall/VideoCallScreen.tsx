'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx }                    from 'clsx';
import { useCallTimer }            from '@/lib/video/hooks/useCallTimer';
import { aiFrameMonitor }          from '@/lib/video/moderation/AIFrameMonitor';
import { ParticipantState, LocalMediaState, BackgroundEffect } from '@/lib/video/types';

// ─── Video tile ───────────────────────────────────────────────────────────────

interface VideoTileProps {
  track:         MediaStreamTrack | null;
  muted:         boolean;
  mirror?:       boolean;
  className?:    string;
  beautyFilter?: boolean;
  label?:        string;
  videoOff?:     boolean;
  avatarText?:   string;
}

function VideoTile({ track, muted, mirror, className, beautyFilter, label, videoOff, avatarText }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !track) return;
    const stream = new MediaStream([track]);
    videoRef.current.srcObject = stream;
    return () => { if (videoRef.current) videoRef.current.srcObject = null; };
  }, [track]);

  return (
    <div className={clsx('relative overflow-hidden bg-gray-900', className)}>
      {videoOff || !track ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          {avatarText ? (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white text-3xl font-bold">
              {avatarText}
            </div>
          ) : (
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-gray-600" fill="currentColor">
              <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          data-daily-video-remote={!muted ? '' : undefined}
          className="w-full h-full object-cover"
          style={{
            transform:  mirror ? 'scaleX(-1)' : undefined,
            filter:     beautyFilter
              ? 'brightness(1.06) contrast(0.93) saturate(1.12)'
              : undefined,
          }}
        />
      )}
      {label && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs font-medium">
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────

function ControlBtn({
  onClick, active, danger, icon, label, size = 'md',
}: {
  onClick:  () => void;
  active?:  boolean;
  danger?:  boolean;
  icon:     React.ReactNode;
  label:    string;
  size?:    'sm' | 'md' | 'lg';
}) {
  const sizeMap = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-16 h-16' };
  return (
    <motion.button
      onClick={onClick}
      className={clsx(
        sizeMap[size], 'rounded-full flex items-center justify-center',
        danger ? 'bg-red-500 shadow-lg shadow-red-500/30'
        : active ? 'bg-white/20'
        : 'bg-gray-800/80',
        'border border-white/10',
      )}
      whileTap={{ scale: 0.88 }}
      aria-label={label}
    >
      {icon}
    </motion.button>
  );
}

// ─── Report sheet ─────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or abuse',
  'Inappropriate behaviour',
  'Scam or impersonation',
  'Other',
];

function ReportSheet({ onReport, onClose }: { onReport: (reason: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState('');
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        className="relative w-full bg-gray-900 rounded-t-3xl px-5 pt-4 pb-10"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <h2 className="text-white font-bold text-lg mb-4">Report this person</h2>
        <div className="flex flex-col gap-2 mb-6">
          {REPORT_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={clsx(
                'text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                selected === r ? 'bg-red-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/15',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <motion.button
          disabled={!selected}
          onClick={() => onReport(selected)}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-base disabled:opacity-40"
          whileTap={{ scale: 0.97 }}
        >
          Submit Report
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main call screen ─────────────────────────────────────────────────────────

interface Props {
  callId:            string;
  myUserId:          string;
  myDisplayName:     string;
  localState:        LocalMediaState;
  remoteParticipant: ParticipantState | null;
  extensionCount:    number;
  startedAt:         Date | null;
  onToggleVideo:     () => void;
  onToggleAudio:     () => void;
  onSetBlur:         (e: BackgroundEffect) => void;
  onToggleBeauty:    () => void;
  onExtend:          () => void;
  onEndCall:         () => void;
  onReport:          (reason: string) => void;
  captureFrame:      () => string | null;
}

export function VideoCallScreen({
  callId, myUserId, myDisplayName, localState, remoteParticipant,
  extensionCount, startedAt, onToggleVideo, onToggleAudio,
  onSetBlur, onToggleBeauty, onExtend, onEndCall, onReport, captureFrame,
}: Props) {
  const [showControls, setShowControls] = useState(true);
  const [showReport,   setShowReport]   = useState(false);
  const [showWarning,  setShowWarning]  = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timer = useCallTimer({
    startedAt,
    extensionCount,
    onWarning: () => setShowWarning(true),
    onTimeUp:  onEndCall,
  });

  // Auto-hide controls after 4s
  const resetControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 4_000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  }, []);

  // Start AI frame monitor
  useEffect(() => {
    const partnerId = remoteParticipant?.userId;
    if (partnerId) {
      aiFrameMonitor.start(callId, partnerId);
    }
    return () => aiFrameMonitor.stop();
  }, [callId, remoteParticipant?.userId]);

  const handleReport = useCallback((reason: string) => {
    const frame = captureFrame();
    onReport(reason);
    setShowReport(false);
  }, [captureFrame, onReport]);

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950 flex flex-col"
      onClick={resetControlsTimer}
    >
      {/* Remote video — full screen */}
      <VideoTile
        track={remoteParticipant?.videoTrack ?? null}
        muted={false}
        videoOff={!remoteParticipant?.videoOn}
        avatarText={remoteParticipant?.displayName?.[0]}
        label={remoteParticipant?.displayName}
        className="absolute inset-0"
      />

      {/* Local video — PiP */}
      <div className="absolute top-safe-top top-4 right-4 w-28 rounded-2xl overflow-hidden shadow-xl border border-white/10">
        <div className="aspect-[3/4]">
          <VideoTile
            track={null}  // local video rendered via Daily call object
            muted={true}
            mirror
            beautyFilter={localState.beautyEnabled}
            videoOff={!localState.videoOn}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Timer + status bar */}
      <div className="absolute top-safe-top top-4 left-4 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 border border-white/10">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-mono font-semibold">
            {timer.formatted.elapsed}
          </span>
        </div>
      </div>

      {/* Warning banner */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            className="absolute top-16 left-1/2 -translate-x-1/2 w-[90%] max-w-sm"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500 shadow-lg">
              <span className="text-2xl">⏱️</span>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">
                  {timer.formatted.remaining} remaining
                </p>
                {timer.canExtend && (
                  <p className="text-white/80 text-xs">Tap extend to keep going</p>
                )}
              </div>
              {timer.canExtend && (
                <motion.button
                  onClick={onExtend}
                  className="px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs font-bold border border-white/20"
                  whileTap={{ scale: 0.95 }}
                >
                  +15 min
                </motion.button>
              )}
              <button onClick={() => setShowWarning(false)} className="text-white/60">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Gradient fade */}
            <div className="h-40 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="bg-black/60 px-6 pb-safe-bottom pb-8 pt-2 backdrop-blur-sm">
              {/* Effect toggles */}
              <div className="flex justify-center gap-4 mb-4">
                <EffectBtn
                  active={localState.blurEnabled}
                  label="Blur"
                  icon="🌫️"
                  onClick={() => onSetBlur(localState.blurEnabled ? 'none' : 'blur')}
                />
                <EffectBtn
                  active={localState.beautyEnabled}
                  label="Beauty"
                  icon="✨"
                  onClick={onToggleBeauty}
                />
                {timer.canExtend && (
                  <EffectBtn
                    active={false}
                    label="+15 min"
                    icon="⏱️"
                    onClick={onExtend}
                  />
                )}
                <EffectBtn
                  active={false}
                  label="Report"
                  icon="🚨"
                  onClick={() => setShowReport(true)}
                  danger
                />
              </div>

              {/* Main controls */}
              <div className="flex items-center justify-center gap-5">
                <ControlBtn
                  onClick={onToggleAudio}
                  active={!localState.audioOn}
                  icon={localState.audioOn ? <MicOnIcon /> : <MicOffIcon />}
                  label={localState.audioOn ? 'Mute' : 'Unmute'}
                />
                <ControlBtn
                  onClick={onToggleVideo}
                  active={!localState.videoOn}
                  icon={localState.videoOn ? <CamOnIcon /> : <CamOffIcon />}
                  label={localState.videoOn ? 'Camera off' : 'Camera on'}
                />
                {/* End call — prominent red */}
                <ControlBtn
                  onClick={onEndCall}
                  danger
                  size="lg"
                  icon={<EndCallIcon />}
                  label="End call"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report sheet */}
      <AnimatePresence>
        {showReport && (
          <ReportSheet onReport={handleReport} onClose={() => setShowReport(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Effect chip ──────────────────────────────────────────────────────────────

function EffectBtn({ active, label, icon, onClick, danger }: {
  active: boolean; label: string; icon: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-1',
        'px-3 py-2 rounded-xl text-xs font-semibold',
        danger ? 'text-red-400' : active ? 'text-violet-300' : 'text-white/60',
      )}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </motion.button>
  );
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
    <path d={d}/>
  </svg>
);

function MicOnIcon()  { return I('M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21h2v-3.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z'); }
function MicOffIcon() { return I('M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.31.43-2.05H19zm-7 7c-3.3 0-6-2.7-6-6H4c0 3.72 2.56 6.85 6 7.73V21h2v-2.06c1.08-.26 2.09-.75 2.96-1.4l-1.4-1.4c-.52.36-1.1.63-1.56.78zM4.27 3L3 4.27 7.73 9H6c0 3.3 2.7 6 6 6 .77 0 1.5-.15 2.17-.42L15.6 16c-.97.66-2.09 1-3.37 1h-.23c-3.3 0-5.97-2.73-5.97-6H4c0 3.5 2.47 6.45 5.78 7.17V20H7v2h10v-2h-2.78v-1.86c1.1-.27 2.1-.76 2.96-1.4L21 22l1.27-1.27L4.27 3z'); }
function CamOnIcon()  { return I('M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z'); }
function CamOffIcon() { return I('M21 6.5l-4-4-8.5 8.5-2.25-2.25L5 10l2.25 2.25-2.25 2.25L6.5 16l2.25-2.25L21 6.5zm-10.5 8L9 13l-1.5 1.5L9 16l1.5-1.5z M18.5 21l-8-8L3 19.5V21h10.5L18.5 21z'); }
function EndCallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  );
}
