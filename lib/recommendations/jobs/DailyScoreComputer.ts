import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { RecommendationEngine } from '../RecommendationEngine';
import { RedisKeys } from '../types';

// ─── Configuration ────────────────────────────────────────────────────────────

interface ComputeJobConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl: string;
  /** Users active within this many days qualify for pre-computation (default 7) */
  activeWithinDays?: number;
  /** Max concurrent user computations (default 10) */
  concurrency?: number;
}

const DEFAULT_ACTIVE_WITHIN_DAYS = 7;
const DEFAULT_CONCURRENCY        = 10;

// ─── Daily score computer ─────────────────────────────────────────────────────

export class DailyScoreComputer {
  private readonly supabase;
  private readonly redis: Redis;
  private readonly engine: RecommendationEngine;
  private readonly activeWithinDays: number;
  private readonly concurrency: number;

  constructor(config: ComputeJobConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.redis    = new Redis(config.redisUrl);
    this.engine   = new RecommendationEngine({
      supabaseUrl:       config.supabaseUrl,
      supabaseServiceKey: config.supabaseServiceKey,
      redisUrl:          config.redisUrl,
    });
    this.activeWithinDays = config.activeWithinDays ?? DEFAULT_ACTIVE_WITHIN_DAYS;
    this.concurrency      = config.concurrency      ?? DEFAULT_CONCURRENCY;
  }

  async run(): Promise<{ processed: number; errors: number; durationMs: number }> {
    const startedAt = Date.now();

    // Prevent parallel runs
    const alreadyRunning = await this.redis.get(RedisKeys.lastComputeRun());
    if (alreadyRunning) {
      const lastRun = parseInt(alreadyRunning, 10);
      const ageHours = (Date.now() - lastRun) / 3_600_000;
      if (ageHours < 23) {
        console.log(`[DailyCompute] Skipping — last run ${ageHours.toFixed(1)}h ago`);
        return { processed: 0, errors: 0, durationMs: 0 };
      }
    }

    // Mark run start
    await this.redis.set(RedisKeys.lastComputeRun(), Date.now().toString(), 'EX', 26 * 3600);

    const userIds = await this.fetchActiveUserIds();
    console.log(`[DailyCompute] Computing feeds for ${userIds.length} users`);

    let processed = 0;
    let errors    = 0;

    // Process in chunks to limit concurrency
    for (let i = 0; i < userIds.length; i += this.concurrency) {
      const batch = userIds.slice(i, i + this.concurrency);

      const results = await Promise.allSettled(
        batch.map(id => this.engine.computeFeedForUser(id))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error('[DailyCompute] Error:', result.reason);
        }
      }

      // Small yield to avoid starving event loop
      await new Promise(r => setImmediate(r));
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[DailyCompute] Done — ${processed} ok, ${errors} errors, ${(durationMs / 1000).toFixed(1)}s`
    );

    return { processed, errors, durationMs };
  }

  // ── Fetch IDs of users active within configured window ────────────────────

  private async fetchActiveUserIds(): Promise<string[]> {
    const since = new Date(Date.now() - this.activeWithinDays * 86_400_000).toISOString();

    const { data, error } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .gte('last_active_at', since);

    if (error || !data) return [];
    return data.map((p: { id: string }) => p.id);
  }

  async destroy(): Promise<void> {
    await this.engine.destroy();
    await this.redis.quit();
  }
}

// ─── Standalone runner (node jobs/daily.ts) ───────────────────────────────────

if (require.main === module) {
  (async () => {
    const job = new DailyScoreComputer({
      supabaseUrl:        process.env.SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
      redisUrl:           process.env.REDIS_URL!,
    });

    try {
      const result = await job.run();
      console.log('[DailyCompute] Result:', result);
      process.exit(0);
    } catch (err) {
      console.error('[DailyCompute] Fatal:', err);
      process.exit(1);
    } finally {
      await job.destroy();
    }
  })();
}
