import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { RecommendationEngine } from '../RecommendationEngine';
import { RedisCache }           from '../RedisCache';
import { FairnessGuard }        from '../FairnessGuard';

// ─── Configuration ────────────────────────────────────────────────────────────

interface UpdaterConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl: string;
}

// ─── Realtime updater ─────────────────────────────────────────────────────────
//     Listens to swipes/matches via Supabase Realtime and immediately:
//     1. Removes swiped candidate from feed sorted set
//     2. Updates attractiveness scores in Redis
//     3. Triggers feed top-up if feed drops below threshold

const FEED_TOPUP_THRESHOLD = 20; // trigger recompute when feed has fewer than N items

export class RealtimeUpdater {
  private readonly supabase;
  private readonly engine: RecommendationEngine;
  private readonly cache: RedisCache;
  private readonly fairness: FairnessGuard;
  private channel: RealtimeChannel | null = null;
  private matchChannel: RealtimeChannel | null = null;

  constructor(config: UpdaterConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.engine   = new RecommendationEngine({
      supabaseUrl:        config.supabaseUrl,
      supabaseServiceKey: config.supabaseServiceKey,
      redisUrl:           config.redisUrl,
    });
    const redis     = new Redis(config.redisUrl);
    this.cache     = new RedisCache(redis);
    this.fairness  = new FairnessGuard(redis);
  }

  start(): void {
    this.subscribeToSwipes();
    this.subscribeToMessages();
    console.log('[RealtimeUpdater] Listening for events');
  }

  // ── Swipe events ──────────────────────────────────────────────────────────

  private subscribeToSwipes(): void {
    this.channel = this.supabase
      .channel('db-swipes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'swipes' },
        async (payload) => {
          try {
            await this.handleSwipe(payload.new as SwipeRow);
          } catch (err) {
            console.error('[RealtimeUpdater] swipe error:', err);
          }
        },
      )
      .subscribe();
  }

  private async handleSwipe(row: SwipeRow): Promise<void> {
    const direction = row.direction as 'like' | 'pass' | 'superlike';

    await this.engine.onSwipe(row.swiper_id, row.swiped_id, direction);

    // Check if feed needs a top-up
    const remaining = await this.cache.feedSize(row.swiper_id);
    if (remaining < FEED_TOPUP_THRESHOLD) {
      // Fire-and-forget background recompute
      this.engine.computeFeedForUser(row.swiper_id).catch(() => {/* silent */});
    }
  }

  // ── Message events (to update response rates) ────────────────────────────

  private subscribeToMessages(): void {
    this.matchChannel = this.supabase
      .channel('db-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          try {
            await this.handleNewMessage(payload.new as MessageRow);
          } catch (err) {
            console.error('[RealtimeUpdater] message error:', err);
          }
        },
      )
      .subscribe();
  }

  private async handleNewMessage(row: MessageRow): Promise<void> {
    // Recompute response rate for the sender asynchronously
    const { data: stats } = await this.supabase
      .from('user_activity_stats')
      .select('messages_received, messages_replied')
      .eq('user_id', row.sender_id)
      .single();

    if (stats && stats.messages_received > 0) {
      const rate = stats.messages_replied / stats.messages_received;
      await this.cache.setResponseRate(row.sender_id, rate);
    }
  }

  stop(): void {
    if (this.channel)      this.supabase.removeChannel(this.channel);
    if (this.matchChannel) this.supabase.removeChannel(this.matchChannel);
    this.channel      = null;
    this.matchChannel = null;
    console.log('[RealtimeUpdater] Stopped');
  }
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface SwipeRow {
  id: string;
  swiper_id: string;
  swiped_id: string;
  direction: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
}
