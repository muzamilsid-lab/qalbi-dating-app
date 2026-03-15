// ─── Provider result ──────────────────────────────────────────────────────────

export type ModerationVerdict = 'clean' | 'queue' | 'reject';

export interface ModerationLabel {
  name:       string;
  confidence: number;   // 0–1
  parentName?: string;
}

export interface ProviderResult {
  verdict:    ModerationVerdict;
  confidence: number;             // highest flagged confidence
  reason:     string;
  labels:     ModerationLabel[];
  raw?:       unknown;
}

// ─── Queue item (DB shape) ────────────────────────────────────────────────────

export type ContentType      = 'photo' | 'message' | 'profile';
export type DetectionSource  = 'ai' | 'report' | 'pattern';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type ActionTaken      = 'none' | 'content_removed' | 'warning' | 'temp_ban' | 'perm_ban';

export interface QueueItem {
  id:               string;
  content_type:     ContentType;
  content_id:       string;
  user_id:          string;
  detection_source: DetectionSource;
  detection_reason: string;
  confidence:       number | null;
  raw_labels:       ModerationLabel[] | null;
  status:           ModerationStatus;
  priority:         number;
  reviewed_by:      string | null;
  reviewed_at:      string | null;
  action_taken:     ActionTaken;
  moderator_note:   string | null;
  created_at:       string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportReason =
  | 'fake_profile'
  | 'inappropriate_photos'
  | 'harassment'
  | 'underage'
  | 'spam'
  | 'other';

export type ReportStatus = 'pending' | 'investigating' | 'resolved';

export interface Report {
  id:               string;
  reporter_id:      string;
  reported_user_id: string;
  reason:           ReportReason;
  details:          string | null;
  evidence_urls:    string[];
  status:           ReportStatus;
  outcome:          string | null;
  queue_item_id:    string | null;
  created_at:       string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fake_profile:          'Fake profile / scam',
  inappropriate_photos:  'Inappropriate photos',
  harassment:            'Harassment / threats',
  underage:              'Underage user',
  spam:                  'Spam / solicitation',
  other:                 'Other',
};

// ─── Review action payload ────────────────────────────────────────────────────

export interface ReviewPayload {
  queueId:    string;
  action:     ActionTaken;
  note?:      string;
  banExpires?: string;   // ISO date for temp_ban
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const CONFIDENCE_REJECT = 0.80;
export const CONFIDENCE_QUEUE  = 0.50;
