'use client';

/**
 * AIFrameMonitor — periodically captures a video frame and sends it
 * to the moderation API. Flags don't auto-ban; they queue for human review.
 *
 * Interval: every 60 seconds during an active call.
 * Only runs when the remote video is visible and the tab is active.
 */

const CAPTURE_INTERVAL_MS = 60_000;
const CANVAS_WIDTH         = 320;
const CANVAS_HEIGHT        = 240;

type FlagType = 'nudity' | 'violence' | 'other';

export interface ModerationResult {
  safe:       boolean;
  flagType?:  FlagType;
  confidence: number;
}

export class AIFrameMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private callId: string | null = null;
  private participantUserId: string | null = null;

  start(callId: string, participantUserId: string): void {
    this.callId            = callId;
    this.participantUserId = participantUserId;
    this.timer = setInterval(() => this.capture(), CAPTURE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private capture(): void {
    if (document.visibilityState !== 'visible') return;

    // Find the remote video element (Daily.co renders it)
    const video = document.querySelector<HTMLVideoElement>('[data-daily-video-remote]');
    if (!video || video.readyState < 2) return;

    try {
      const canvas  = document.createElement('canvas');
      canvas.width  = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvas.getContext('2d')?.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

      fetch('/api/video/moderate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          callId:            this.callId,
          participantUserId: this.participantUserId,
          frameDataUrl:      dataUrl,
        }),
      }).catch(() => {/* best-effort, never crash the call */});
    } catch { /* canvas tainted or video not ready */ }
  }
}

export const aiFrameMonitor = new AIFrameMonitor();
