import { createClient } from '@supabase/supabase-js';
import { analysePhoto }    from './providers/RekognitionProvider';
import { moderateText }    from './providers/OpenAIModerationProvider';
import { scanText }        from './providers/PatternProvider';
import type {
  ContentType, DetectionSource, ActionTaken,
  ModerationVerdict, ProviderResult,
} from './types';
import { CONFIDENCE_REJECT, CONFIDENCE_QUEUE } from './types';

// ─── Supabase admin client ────────────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Queue writer ─────────────────────────────────────────────────────────────

async function enqueue(params: {
  contentType:     ContentType;
  contentId:       string;
  userId:          string;
  source:          DetectionSource;
  result:          ProviderResult;
  priority?:       number;
}): Promise<string | null> {
  const supabase = getAdmin();

  const { data, error } = await supabase.from('moderation_queue').insert({
    content_type:     params.contentType,
    content_id:       params.contentId,
    user_id:          params.userId,
    detection_source: params.source,
    detection_reason: params.result.reason,
    confidence:       params.result.confidence,
    raw_labels:       params.result.labels,
    status:           'pending',
    priority:         params.priority ?? 0,
    action_taken:     'none',
  }).select('id').single();

  if (error) {
    console.error('[ModerationService] enqueue error:', error);
    return null;
  }
  return data.id;
}

// ─── Auto-action on reject ────────────────────────────────────────────────────

async function autoReject(params: {
  contentType: ContentType;
  contentId:   string;
  userId:      string;
  reason:      string;
  queueId:     string;
}) {
  const supabase = getAdmin();

  // Mark queue item as rejected with auto action
  await supabase.from('moderation_queue')
    .update({
      status:       'rejected',
      action_taken: 'content_removed',
      reviewed_at:  new Date().toISOString(),
      moderator_note: `Auto-rejected: ${params.reason}`,
    })
    .eq('id', params.queueId);

  // Soft-delete content based on type
  if (params.contentType === 'photo') {
    await supabase.from('profile_photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.contentId);
  } else if (params.contentType === 'message') {
    await supabase.from('messages')
      .update({ unsent_at: new Date().toISOString() })
      .eq('id', params.contentId);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Screen a newly uploaded photo.
 * Returns verdict and queue ID if queued/rejected.
 */
export async function screenPhoto(params: {
  photoId:   string;
  userId:    string;
  s3Bucket?: string;
  s3Key?:    string;
  bytes?:    Uint8Array;
}): Promise<{ verdict: ModerationVerdict; queueId?: string }> {
  const result = await analysePhoto({
    bucket: params.s3Bucket,
    key:    params.s3Key,
    bytes:  params.bytes,
  });

  if (result.verdict === 'clean') return { verdict: 'clean' };

  const priority = result.verdict === 'reject' ? 50 : 10;
  const queueId  = await enqueue({
    contentType: 'photo',
    contentId:   params.photoId,
    userId:      params.userId,
    source:      'ai',
    result,
    priority,
  });

  if (result.verdict === 'reject' && queueId) {
    await autoReject({
      contentType: 'photo',
      contentId:   params.photoId,
      userId:      params.userId,
      reason:      result.reason,
      queueId,
    });
  }

  return { verdict: result.verdict, queueId: queueId ?? undefined };
}

/**
 * Screen a text message or bio.
 * Runs both OpenAI moderation and pattern matching in parallel.
 */
export async function screenText(params: {
  contentId:   string;
  contentType: 'message' | 'profile';
  userId:      string;
  text:        string;
}): Promise<{ verdict: ModerationVerdict; queueId?: string }> {
  const [aiResult, patternResult] = await Promise.all([
    moderateText(params.text),
    Promise.resolve(scanText(params.text)),
  ]);

  // Take the more severe verdict
  const verdictOrder: Record<ModerationVerdict, number> = { clean: 0, queue: 1, reject: 2 };
  const winner = verdictOrder[aiResult.verdict] >= verdictOrder[patternResult.verdict]
    ? aiResult
    : patternResult;

  const source: DetectionSource =
    winner === patternResult ? 'pattern' : 'ai';

  if (winner.verdict === 'clean') return { verdict: 'clean' };

  const queueId = await enqueue({
    contentType: params.contentType,
    contentId:   params.contentId,
    userId:      params.userId,
    source,
    result:      winner,
    priority:    winner.verdict === 'reject' ? 40 : 5,
  });

  if (winner.verdict === 'reject' && queueId) {
    await autoReject({
      contentType: params.contentType,
      contentId:   params.contentId,
      userId:      params.userId,
      reason:      winner.reason,
      queueId,
    });
  }

  return { verdict: winner.verdict, queueId: queueId ?? undefined };
}

/**
 * Screen a full profile (bio + photos via URL list).
 * Photos are analysed by fetching bytes; bio goes through text screening.
 */
export async function screenProfile(params: {
  userId:    string;
  bio?:      string;
}): Promise<{ verdicts: Array<{ field: string; verdict: ModerationVerdict }> }> {
  const verdicts: Array<{ field: string; verdict: ModerationVerdict }> = [];

  if (params.bio) {
    const r = await screenText({
      contentId:   params.userId,
      contentType: 'profile',
      userId:      params.userId,
      text:        params.bio,
    });
    verdicts.push({ field: 'bio', verdict: r.verdict });
  }

  return { verdicts };
}
