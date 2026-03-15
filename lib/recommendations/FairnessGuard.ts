import Redis from 'ioredis';
import { RedisKeys } from './types';

// ─── Configuration ────────────────────────────────────────────────────────────

const MIN_IMPRESSIONS_PER_DAY = 2;          // guarantee every active user is seen at least N times/day
const SUPER_ATTRACTIVE_PERCENTILE = 0.90;   // top 10% by attractiveness score
const MAX_SUPER_ATTRACTIVE_RATIO  = 0.30;   // at most 30% of feed from super-attractive pool
const NEW_USER_BOOST_DAYS         = 7;      // protect new users for 7 days
const NEW_USER_MIN_IMPRESSIONS    = 10;     // force new users to reach this impression floor

export class FairnessGuard {
  constructor(private readonly redis: Redis) {}

  // ── Check if a candidate has had minimum daily impressions ───────────────

  async needsImpressionBoost(candidateId: string): Promise<boolean> {
    const key   = RedisKeys.impressionCount(candidateId);
    const count = await this.redis.get(key);
    return count === null || parseInt(count, 10) < MIN_IMPRESSIONS_PER_DAY;
  }

  // ── Record an impression for a viewer→candidate pair ─────────────────────

  async recordImpression(viewerId: string, candidateId: string): Promise<void> {
    const pipe = this.redis.pipeline();

    // Track per-candidate impression count (TTL 25h to cover a rolling day)
    const countKey = RedisKeys.impressionCount(candidateId);
    pipe.incr(countKey);
    pipe.expire(countKey, 25 * 3600);

    // Track per-viewer impression timestamps for the candidate
    const impKey = RedisKeys.impressions(viewerId);
    pipe.hset(impKey, candidateId, new Date().toISOString());
    pipe.expire(impKey, 7 * 86400); // 7 days

    await pipe.exec();
  }

  // ── Get hours since viewer last saw this candidate (null = never) ─────────

  async hoursSinceImpression(viewerId: string, candidateId: string): Promise<number | null> {
    const iso = await this.redis.hget(RedisKeys.impressions(viewerId), candidateId);
    if (!iso) return null;
    return (Date.now() - new Date(iso).getTime()) / 3_600_000;
  }

  // ── Fetch global attractiveness percentile for a user ────────────────────

  async getAttractivenessRank(userId: string): Promise<number> {
    const [rank, card] = await Promise.all([
      this.redis.zrank(RedisKeys.attractiveness(), userId),
      this.redis.zcard(RedisKeys.attractiveness()),
    ]);
    if (rank === null || card === 0) return 0.5;
    return rank / (card - 1);
  }

  // ── Rebalance feed: cap super-attractive profiles ─────────────────────────
  //    Returns a filtered + reordered list that respects the concentration cap.

  async rebalanceFeed(
    viewerId: string,
    candidateIds: string[],
  ): Promise<string[]> {
    if (candidateIds.length === 0) return [];

    const ranks = await Promise.all(
      candidateIds.map(id => this.getAttractivenessRank(id))
    );

    const superAttractive: string[] = [];
    const normal: string[] = [];

    candidateIds.forEach((id, i) => {
      if (ranks[i] >= SUPER_ATTRACTIVE_PERCENTILE) {
        superAttractive.push(id);
      } else {
        normal.push(id);
      }
    });

    const maxSuper = Math.floor(candidateIds.length * MAX_SUPER_ATTRACTIVE_RATIO);

    // Interleave: keep relative order within each group
    const result: string[] = [];
    let si = 0;
    let ni = 0;

    while (result.length < candidateIds.length) {
      // Insert one super-attractive only if budget remains
      if (si < superAttractive.length && si < maxSuper + Math.floor(result.length * MAX_SUPER_ATTRACTIVE_RATIO)) {
        result.push(superAttractive[si++]);
      } else if (ni < normal.length) {
        result.push(normal[ni++]);
      } else if (si < superAttractive.length) {
        result.push(superAttractive[si++]);
      } else {
        break;
      }
    }

    return result;
  }

  // ── Get candidates who need impression boosts (minimum exposure guarantee) ─

  async getUnderexposedCandidates(pool: string[]): Promise<string[]> {
    if (pool.length === 0) return [];

    const counts = await Promise.all(
      pool.map(async id => ({
        id,
        count: parseInt((await this.redis.get(RedisKeys.impressionCount(id))) ?? '0', 10),
      }))
    );

    return counts
      .filter(c => c.count < MIN_IMPRESSIONS_PER_DAY)
      .map(c => c.id);
  }

  // ── Update global attractiveness score ───────────────────────────────────
  //    Called after each like/pass to keep ranking fresh

  async updateAttractivenessScore(userId: string, delta: number): Promise<void> {
    await this.redis.zincrby(RedisKeys.attractiveness(), delta, userId);
  }
}
