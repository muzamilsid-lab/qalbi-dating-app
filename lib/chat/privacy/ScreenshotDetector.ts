'use client';

/**
 * ScreenshotDetector — detects when the user takes a screenshot and
 * notifies the other party via a system message.
 *
 * Technique: Listen for the 'visibilitychange' + 'blur' combination that
 * happens on iOS/Android during screenshot, plus the Page Visibility API.
 * This is heuristic — no browser API directly exposes screenshots.
 *
 * Additional: Use CSS `pointer-events: none` + `user-select: none` on chat
 * content when screenshot mode is detected to deter casual screenshotting
 * (cannot fully prevent it, just creates friction + notification).
 */

type NotifyFn = (conversationId: string) => Promise<void>;

export class ScreenshotDetector {
  private static _instance: ScreenshotDetector | null = null;
  private notifyFn: NotifyFn | null = null;
  private conversationId: string | null = null;
  private lastBlur: number = 0;
  private readonly SCREENSHOT_WINDOW_MS = 500;

  static getInstance(): ScreenshotDetector {
    if (!ScreenshotDetector._instance) ScreenshotDetector._instance = new ScreenshotDetector();
    return ScreenshotDetector._instance;
  }

  attach(conversationId: string, notifyFn: NotifyFn): () => void {
    this.conversationId = conversationId;
    this.notifyFn       = notifyFn;

    const handleBlur = () => { this.lastBlur = Date.now(); };

    const handleFocus = () => {
      const elapsed = Date.now() - this.lastBlur;
      if (elapsed < this.SCREENSHOT_WINDOW_MS && elapsed > 0) {
        this.triggerNotify();
      }
    };

    // iOS-specific: visibilitychange fires when screenshot dialog appears
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        this.lastBlur = Date.now();
      } else {
        const elapsed = Date.now() - this.lastBlur;
        if (elapsed < this.SCREENSHOT_WINDOW_MS && elapsed > 0) {
          this.triggerNotify();
        }
      }
    };

    window.addEventListener('blur',             handleBlur);
    window.addEventListener('focus',            handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur',             handleBlur);
      window.removeEventListener('focus',            handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }

  private triggerNotify(): void {
    if (!this.notifyFn || !this.conversationId) return;
    this.notifyFn(this.conversationId).catch(() => {/* silent */});
  }
}

export const screenshotDetector = ScreenshotDetector.getInstance();

// ─── CSS anti-screenshot styles (applied to chat container) ──────────────────

export const ANTI_SCREENSHOT_STYLE: React.CSSProperties = {
  WebkitUserSelect: 'none',
  userSelect: 'none',
  // -webkit-touch-callout prevents long-press save on iOS
  // @ts-ignore — non-standard prop
  WebkitTouchCallout: 'none',
};
