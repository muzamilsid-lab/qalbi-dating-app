import Redis from 'ioredis';
import { RedisKeys, ScoredCandidate, DiscoverCursor } from './types';

// ─── Feed page size caps ───────────────────────────────────────────────────────

const FEED_MAX_SIZE    = 500; // max candidates stored in sorted set per viewer
const FEED_TTL_SECONDS = 6 * 3600; // 6-hour TTL on cached feeds

export class RedisCache {
  constructor(private readonly redis: Redis) {}

  // ── Write scored candidates into a viewer's feed sorted set ─────────────

  async writeFeed(viewerId: string, candidates: ScoredCandidate[]): Promise<void> {
    if (candidates.length === 0) return;

    const key = RedisKeys.discoverFeed(viewerId);
    const pipe = this.redis.pipeline();

    // ZADD score member — use finalScore as the sort key
    const args: (string | number)[] = [];
    for (const c of candidates) {
      args.push(c.score.finalScore, c.candidateId);
    }
    pipe.zadd(key, ...args);

    // Trim to max size (keep top N by score)
    pipe.zremrangebyrank(key, 0, -(FEED_MAX_SIZE + 1));

    // Refresh TTL
    pipe.expire(key, FEED_TTL_SECONDS);

    await pipe.exec();
  }

  // ── Read a page from the sorted set (cursor-based, descending score) ──────

  async readFeedPage(
    viewerId: string,
    limit: number,
    cursor?: DiscoverCursor,
  ): Promise<{ ids: string[]; nextCursor: DiscoverCursor | null }> {
    const key = RedisKeys.discoverFeed(viewerId);

    let results: string[];

    if (!cursor) {
      // First page — highest scores first
      results = await this.redis.zrevrange(key, 0, limit - 1);
    } else {
      // Use offset-based pagination (cursor stores offset for simplicity with sorted sets)
      results = await this.redis.zrevrange(key, cursor.offset, cursor.offset + limit - 1);
    }

    const nextOffset = (cursor?.offset ?? 0) + results.length;
    const total = await this.redis.zcard(key);
    const hasMore = nextOffset < total;

    const nextCursor: DiscoverCursor | null = hasMore
      ? { lastScore: 0, lastId: results[results.length - 1] ?? '', offset: nextOffset }
      : null;

    return { ids: results, nextCursor };
  }

  // ── Remove a candidate from viewer's feed (on swipe) ─────────────────────

  async removeFromFeed(viewerId: string, candidateId: string): Promise<void> {
    await this.redis.zrem(RedisKeys.discoverFeed(viewerId), candidateId);
  }

  // ── Mark candidate as swiped ─────────────────────────────────────────────

  async markSwiped(viewerId: string, candidateId: string): Promise<void> {
    const key = RedisKeys.swipedSet(viewerId);
    await this.redis.sadd(key, candidateId);
    await this.redis.expire(key, 30 * 86400); // 30-day TTL
  }

  // ── Check if already swiped ───────────────────────────────────────────────

  async hasSwiped(viewerId: string, candidateId: string): Promise<boolean> {
    return (await this.redis.sismember(RedisKeys.swipedSet(viewerId), candidateId)) === 1;
  }

  // ── Filter out already-swiped candidates ─────────────────────────────────

  async filterSwiped(viewerId: string, candidateIds: string[]): Promise<string[]> {
    if (candidateIds.length === 0) return [];

    const pipe = this.redis.pipeline();
    for (const id of candidateIds) {
      pipe.sismember(RedisKeys.swipedSet(viewerId), id);
    }
    const results = await pipe.exec();
    return candidateIds.filter((_, i) => results?.[i]?.[1] !== 1);
  }

  // ── Activity rate caches (response rate, like-back rate) ─────────────────

  async getResponseRate(userId: string): Promise<number> {
    const val = await this.redis.hget(RedisKeys.responseRate(userId), 'rate');
    return val ? parseFloat(val) : 0.5;
  }

  async setResponseRate(userId: string, rate: number): Promise<void> {
    await this.redis.hset(RedisKeys.responseRate(userId), 'rate', rate.toString());
    await this.redis.expire(RedisKeys.responseRate(userId), 24 * 3600);
  }

  async getLikeBackRate(userId: string): Promise<number> {
    const val = await this.redis.hget(RedisKeys.likeBackRate(userId), 'rate');
    return val ? parseFloat(val) : 0.5;
  }

  async setLikeBackRate(userId: string, rate: number): Promise<void> {
    await this.redis.hset(RedisKeys.likeBackRate(userId), 'rate', rate.toString());
    await this.redis.expire(RedisKeys.likeBackRate(userId), 24 * 3600);
  }

  // ── Recently active users (for candidate pool query) ──────────────────────

  async getRecentlyActiveUsers(minScore: number, maxScore: number, limit: number): Promise<string[]> {
    return this.redis.zrevrangebyscore(
      RedisKeys.recentlyActive(),
      maxScore,
      minScore,
      'LIMIT', 0, limit,
    );
  }

  async touchRecentlyActive(userId: string): Promise<void> {
    await this.redis.zadd(RedisKeys.recentlyActive(), Date.now(), userId);
  }

  // ── Feed existence check ──────────────────────────────────────────────────

  async feedExists(viewerId: string): Promise<boolean> {
    return (await this.redis.exists(RedisKeys.discoverFeed(viewerId))) === 1;
  }

  async feedSize(viewerId: string): Promise<number> {
    return this.redis.zcard(RedisKeys.discoverFeed(viewerId));
  }

  // ── Compute lock (prevent parallel recompute for same user) ──────────────

  async acquireComputeLock(userId: string, ttlSeconds = 60): Promise<boolean> {
    const result = await this.redis.set(
      `jobs:compute_lock:${userId}`,
      '1',
      'EX', ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async releaseComputeLock(userId: string): Promise<void> {
    await this.redis.del(`jobs:compute_lock:${userId}`);
  }
}
