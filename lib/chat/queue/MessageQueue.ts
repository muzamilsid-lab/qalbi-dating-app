/**
 * MessageQueue — reliable message delivery with exponential backoff.
 *
 * Flow:
 *   1. send() writes to IndexedDB queue + sets status = 'queued'
 *   2. flush() processes pending items — calls sendFn
 *   3. On success: remove from queue, update status to 'sent'
 *   4. On failure: increment attempts, schedule next retry (exponential backoff)
 *   5. After MAX_ATTEMPTS: mark as 'failed'
 *
 * flush() is called:
 *   - Immediately after send()
 *   - On navigator online event
 *   - On visibility change (tab becomes active)
 */

import { chatDB }       from '../db/ChatIndexedDB';
import { QueuedMessage, MessageContent, ContentType } from '../types';

const MAX_ATTEMPTS  = 5;
const BASE_DELAY_MS = 2_000;

type StatusCallback = (localId: string, status: 'sending' | 'sent' | 'failed', serverId?: string) => void;

export type SendFn = (payload: {
  localId: string;
  conversationId: string;
  senderId: string;
  contentType: ContentType;
  content: MessageContent;
  expiresAt: Date | null;
}) => Promise<{ serverId: string }>;

// ─── MessageQueue ─────────────────────────────────────────────────────────────

export class MessageQueue {
  private static _instance: MessageQueue | null = null;
  private sendFn: SendFn | null = null;
  private onStatus: StatusCallback | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  static getInstance(): MessageQueue {
    if (!MessageQueue._instance) MessageQueue._instance = new MessageQueue();
    return MessageQueue._instance;
  }

  // ── Attach the network send function + status callback ───────────────────

  attach(sendFn: SendFn, onStatus: StatusCallback): void {
    this.sendFn   = sendFn;
    this.onStatus = onStatus;
  }

  // ── Start background flush loop + event listeners ─────────────────────────

  start(): void {
    if (this.flushTimer) return;

    // Flush every 10s as a safety net
    this.flushTimer = setInterval(() => this.flush(), 10_000);

    if (typeof window !== 'undefined') {
      window.addEventListener('online',    () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.flush();
      });
    }

    // Initial flush on start
    this.flush();
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ── Enqueue an outbound message ───────────────────────────────────────────

  async enqueue(msg: Omit<QueuedMessage, 'attempts' | 'nextRetryAt' | 'createdAt'>): Promise<void> {
    const queued: QueuedMessage = {
      ...msg,
      attempts:   0,
      nextRetryAt: new Date(),
      createdAt:   new Date(),
    };
    await chatDB.enqueue(queued);
    // Try immediately
    this.flush().catch(() => {/* silent */});
  }

  // ── Process pending queue ─────────────────────────────────────────────────

  async flush(): Promise<void> {
    if (this.flushing || !this.sendFn) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.flushing = true;

    try {
      const pending = await chatDB.getPendingQueue();

      await Promise.allSettled(pending.map(item => this.processItem(item)));
    } finally {
      this.flushing = false;
    }
  }

  // ─── Process a single queue item ─────────────────────────────────────────

  private async processItem(item: QueuedMessage): Promise<void> {
    const { sendFn, onStatus } = this;
    if (!sendFn) return;

    onStatus?.(item.localId, 'sending');

    try {
      const { serverId } = await sendFn({
        localId:        item.localId,
        conversationId: item.conversationId,
        senderId:       item.senderId,
        contentType:    item.contentType,
        content:        item.content,
        expiresAt:      item.expiresAt,
      });

      await chatDB.dequeue(item.localId);
      onStatus?.(item.localId, 'sent', serverId);
    } catch (err) {
      const attempts = item.attempts + 1;

      if (attempts >= MAX_ATTEMPTS) {
        await chatDB.dequeue(item.localId);
        onStatus?.(item.localId, 'failed');
        return;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s …
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempts - 1);
      await chatDB.updateQueueItem({
        ...item,
        attempts,
        nextRetryAt: new Date(Date.now() + delayMs),
      });
    }
  }

  async pendingCount(): Promise<number> {
    return chatDB.getQueueSize();
  }
}

export const messageQueue = MessageQueue.getInstance();
