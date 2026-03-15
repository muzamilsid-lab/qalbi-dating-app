import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import {
  UserProfile,
  UserActivityData,
  ScoredCandidate,
  DiscoverCursor,
  DiscoverProfile,
  DiscoverResponse,
} from './types';
import { aggregateScore } from './scoring/ScoreAggregator';
import { FairnessGuard }  from './FairnessGuard';
import { RedisCache }     from './RedisCache';

// ─── Engine configuration ─────────────────────────────────────────────────────

interface EngineConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl: string;
  /** How many candidates to pre-score per viewer per run (default 200) */
  candidatePoolSize?: number;
  /** Score threshold below which a candidate is excluded (default 1) */
  minScore?: number;
  isDev?: boolean;
}

const DEFAULT_POOL_SIZE = 200;
const DEFAULT_MIN_SCORE = 1;

// ─── Main engine ──────────────────────────────────────────────────────────────

export class RecommendationEngine {
  private readonly supabase;
  private readonly redis: Redis;
  private readonly cache: RedisCache;
  private readonly fairness: FairnessGuard;
  private readonly poolSize: number;
  private readonly minScore: number;
  private readonly isDev: boolean;

  constructor(config: EngineConfig) {
    this.supabase  = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.redis     = new Redis(config.redisUrl);
    this.cache     = new RedisCache(this.redis);
    this.fairness  = new FairnessGuard(this.redis);
    this.poolSize  = config.candidatePoolSize ?? DEFAULT_POOL_SIZE;
    this.minScore  = config.minScore          ?? DEFAULT_MIN_SCORE;
    this.isDev     = config.isDev             ?? false;
  }

  // ── Public: get the discover feed for a viewer ────────────────────────────

  async getDiscoverFeed(
    viewerId: string,
    limit: number,
    rawCursor?: string,
  ): Promise<DiscoverResponse> {
    const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;

    // Ensure feed is warm
    if (!(await this.cache.feedExists(viewerId))) {
      await this.computeFeedForUser(viewerId);
    } else {
      const size = await this.cache.feedSize(viewerId);
      if (size < limit * 2) {
        // Low — recompute in background (fire-and-forget)
        this.computeFeedForUser(viewerId).catch(() => {/* silent */});
      }
    }

    // Read a page
    const { ids, nextCursor } = await this.cache.readFeedPage(viewerId, limit, cursor);

    // If still empty, fall back to random
    const candidateIds = ids.length > 0
      ? ids
      : await this.randomFallback(viewerId, limit);

    const profiles = await this.hydrateProfiles(viewerId, candidateIds);
    const total    = await this.cache.feedSize(viewerId);

    return {
      profiles,
      nextCursor: nextCursor ? encodeCursor(nextCursor) : null,
      hasMore:    nextCursor !== null,
      total,
      fromCache:  ids.length > 0,
    };
  }

  // ── Compute + cache scores for a single viewer ────────────────────────────

  async computeFeedForUser(viewerId: string): Promise<void> {
    const locked = await this.cache.acquireComputeLock(viewerId);
    if (!locked) return;

    try {
      const viewer = await this.fetchProfile(viewerId);
      if (!viewer) return;

      const candidates = await this.fetchCandidatePool(viewer);
      const scored     = await this.scoreAll(viewer, candidates);

      // Fairness: rebalance for super-attractive concentration
      const rebalanced = await this.fairness.rebalanceFeed(
        viewerId,
        scored.map(s => s.candidateId),
      );

      // Re-order scored list to match rebalanced order
      const scoreMap = new Map(scored.map(s => [s.candidateId, s]));
      const orderedScored = rebalanced
        .map(id => scoreMap.get(id)!)
        .filter(Boolean);

      await this.cache.writeFeed(viewerId, orderedScored);
    } finally {
      await this.cache.releaseComputeLock(viewerId);
    }
  }

  // ── Score a set of candidates against a viewer ────────────────────────────

  private async scoreAll(
    viewer: UserProfile,
    candidates: UserProfile[],
  ): Promise<ScoredCandidate[]> {
    const results: ScoredCandidate[] = [];

    // Fetch all activity data in parallel
    const activities = await Promise.all(
      candidates.map(c => this.fetchActivityData(c.id))
    );
    const ranks = await Promise.all(
      candidates.map(c => this.fairness.getAttractivenessRank(c.id))
    );
    const impressionHours = await Promise.all(
      candidates.map(c => this.fairness.hoursSinceImpression(viewer.id, c.id))
    );

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const activity  = activities[i];
      const rank      = ranks[i];
      const hours     = impressionHours[i];

      const score = aggregateScore({
        viewer,
        candidate,
        candidateActivity:       activity,
        attractivenessRank:      rank,
        mutualConnectionCount:   0, // TODO: fetch from match graph
        lastImpressionHoursAgo:  hours,
      });

      if (score.finalScore >= this.minScore) {
        results.push({
          candidateId: candidate.id,
          viewerId:    viewer.id,
          score,
          computedAt:  new Date(),
        });
      }
    }

    // Sort descending by finalScore
    return results.sort((a, b) => b.score.finalScore - a.score.finalScore);
  }

  // ── Hydrate candidate IDs → DiscoverProfile (with photo URLs) ────────────

  private async hydrateProfiles(
    viewerId: string,
    candidateIds: string[],
  ): Promise<DiscoverProfile[]> {
    if (candidateIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id, display_name, birth_date, city, nationality, bio, interests,
        is_verified, last_active_at,
        photos ( url, display_order ),
        lat, lng
      `)
      .in('id', candidateIds);

    if (error || !data) return [];

    // Maintain the order from candidateIds
    const profileMap = new Map<string, any>(data.map((p: any) => [p.id, p]));
    const viewerProfile = await this.fetchProfile(viewerId);

    return candidateIds
      .map(id => profileMap.get(id))
      .filter(Boolean)
      .map((p: any) => {
        const photos: string[] = (p.photos ?? [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((ph: any) => ph.url);

        const age = p.birth_date
          ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 86400000))
          : 0;

        const onlineThresholdMs = 5 * 60 * 1000;
        const online = p.last_active_at
          ? Date.now() - new Date(p.last_active_at).getTime() < onlineThresholdMs
          : false;

        const distance = viewerProfile
          ? Math.round(
              haversineKmLocal(viewerProfile.lat, viewerProfile.lng, p.lat ?? 0, p.lng ?? 0)
            )
          : undefined;

        return {
          id:          p.id,
          name:        p.display_name ?? 'Unknown',
          age,
          city:        p.city,
          nationality: p.nationality,
          bio:         p.bio,
          photos,
          interests:   p.interests ?? [],
          verified:    p.is_verified ?? false,
          online,
          distance,
        } satisfies DiscoverProfile;
      });
  }

  // ── Fetch a candidate pool for a viewer ───────────────────────────────────

  private async fetchCandidatePool(viewer: UserProfile): Promise<UserProfile[]> {
    const prefs = viewer.preferences;

    // Build query with basic hard filters
    let query = this.supabase
      .from('profiles')
      .select(`
        id, gender, birth_date, city, lat, lng, interests,
        occupation, bio, is_verified, last_active_at, created_at, updated_at,
        lifestyle ( smoking, drinking, religion, wants_children ),
        preferences ( interested_in, age_min, age_max, max_distance_km,
                      smoking, drinking, religion, wants_children ),
        photos ( id ),
        prompts ( id )
      `)
      .neq('id', viewer.id)
      .eq('is_active', true)
      .limit(this.poolSize);

    // Gender filter
    if (prefs.interestedIn !== 'everyone') {
      query = query.eq('gender', prefs.interestedIn === 'men' ? 'man' : 'woman');
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Filter already-swiped
    const unswiped = await this.cache.filterSwiped(
      viewer.id,
      data.map((p: any) => p.id),
    );

    const swipedSet = new Set(
      data.map((p: any) => p.id).filter((id: string) => !unswiped.includes(id))
    );

    return data
      .filter((p: any) => !swipedSet.has(p.id))
      .map((p: any) => mapRowToProfile(p));
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  private async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id, gender, birth_date, city, lat, lng, interests,
        occupation, bio, is_verified, last_active_at, created_at, updated_at,
        lifestyle ( smoking, drinking, religion, wants_children ),
        preferences ( interested_in, age_min, age_max, max_distance_km,
                      smoking, drinking, religion, wants_children ),
        photos ( id ),
        prompts ( id )
      `)
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return mapRowToProfile(data);
  }

  private async fetchActivityData(userId: string): Promise<UserActivityData> {
    const { data } = await this.supabase
      .from('user_activity_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      return {
        userId,
        lastActiveAt:       new Date(0),
        messagesReceived:   0,
        messagesReplied:    0,
        totalLikesReceived: 0,
        totalLikesSent:     0,
        likesReceivedBack:  0,
        profileViewCount:   0,
      };
    }

    return {
      userId,
      lastActiveAt:       new Date(data.last_active_at),
      messagesReceived:   data.messages_received  ?? 0,
      messagesReplied:    data.messages_replied   ?? 0,
      totalLikesReceived: data.likes_received     ?? 0,
      totalLikesSent:     data.likes_sent         ?? 0,
      likesReceivedBack:  data.likes_received_back ?? 0,
      profileViewCount:   data.profile_view_count ?? 0,
    };
  }

  // ── Random fallback when feed is empty ────────────────────────────────────

  private async randomFallback(viewerId: string, limit: number): Promise<string[]> {
    const { data } = await this.supabase
      .from('profiles')
      .select('id')
      .neq('id', viewerId)
      .eq('is_active', true)
      .limit(limit * 3); // over-fetch to account for swipe filtering

    if (!data) return [];
    const unswiped = await this.cache.filterSwiped(viewerId, data.map((p: any) => p.id));
    return unswiped.slice(0, limit);
  }

  // ── Realtime: handle a swipe event ───────────────────────────────────────

  async onSwipe(
    viewerId: string,
    candidateId: string,
    direction: 'like' | 'pass' | 'superlike',
  ): Promise<void> {
    await Promise.all([
      this.cache.markSwiped(viewerId, candidateId),
      this.cache.removeFromFeed(viewerId, candidateId),
      this.fairness.recordImpression(viewerId, candidateId),
      direction === 'like' || direction === 'superlike'
        ? this.fairness.updateAttractivenessScore(candidateId, direction === 'superlike' ? 3 : 1)
        : this.fairness.updateAttractivenessScore(candidateId, -0.5),
    ]);
  }

  async destroy(): Promise<void> {
    await this.redis.quit();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function mapRowToProfile(p: any): UserProfile {
  const age = p.birth_date
    ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 86400000))
    : 0;

  return {
    id:          p.id,
    gender:      p.gender ?? 'other',
    age,
    city:        p.city ?? '',
    lat:         p.lat  ?? 0,
    lng:         p.lng  ?? 0,
    interests:   p.interests ?? [],
    occupation:  p.occupation,
    bio:         p.bio,
    photoCount:  p.photos?.length  ?? 0,
    promptCount: p.prompts?.length ?? 0,
    preferences: {
      interestedIn:    p.preferences?.interested_in ?? 'everyone',
      ageMin:          p.preferences?.age_min       ?? 18,
      ageMax:          p.preferences?.age_max       ?? 99,
      maxDistanceKm:   p.preferences?.max_distance_km ?? 100,
      smoking:         p.preferences?.smoking,
      drinking:        p.preferences?.drinking,
      religion:        p.preferences?.religion,
      wantsChildren:   p.preferences?.wants_children,
    },
    lifestyle: {
      smoking:       p.lifestyle?.smoking,
      drinking:      p.lifestyle?.drinking,
      religion:      p.lifestyle?.religion,
      wantsChildren: p.lifestyle?.wants_children,
    },
    createdAt:    new Date(p.created_at),
    updatedAt:    new Date(p.updated_at),
    lastActiveAt: new Date(p.last_active_at ?? p.created_at),
    isVerified:   p.is_verified ?? false,
  };
}

function haversineKmLocal(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function encodeCursor(cursor: DiscoverCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): DiscoverCursor | undefined {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}
