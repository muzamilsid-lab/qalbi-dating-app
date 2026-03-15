// ─── Session ────────────────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'passed' | 'failed' | 'expired';

export interface VerificationSession {
  id: string;
  user_id: string;
  status: SessionStatus;
  liveness_score: number | null;
  similarity_score: number | null;
  attempts: number;
  created_at: Date;
  completed_at: Date | null;
  expires_at: Date;
}

// ─── Face Reference ──────────────────────────────────────────────────────────

export interface FaceReference {
  id: string;
  user_id: string;
  encrypted_image: string;   // AES-256-GCM ciphertext (base64)
  iv: string;                // GCM initialisation vector (base64)
  image_hash: string;        // SHA-256 of original — for dedup
  rekognition_face_id: string | null;
  created_at: Date;
  delete_at: Date;           // GDPR: 24h TTL
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'session.initiate'
  | 'reference.upload'
  | 'liveness.check'
  | 'face.compare'
  | 'session.expire'
  | 'image.delete';

export interface AuditLog {
  id: string;
  session_id: string | null;
  user_id: string | null;
  action: AuditAction;
  result: 'success' | 'failure' | 'error';
  detail: Record<string, unknown>;
  ip_address: string;
  created_at: Date;
}

// ─── Liveness ────────────────────────────────────────────────────────────────

export interface FrameAnalysis {
  frameIndex: number;
  faceDetected: boolean;
  multipleFaces: boolean;
  eyeOpenLeft: number;
  eyeOpenRight: number;
  yaw: number;
  pitch: number;
  roll: number;
  smile: number;
  brightness: number;
  sharpness: number;
}

export interface LivenessResult {
  score: number;           // 0–100
  passed: boolean;
  blinkDetected: boolean;
  headMovementDetected: boolean;
  antiSpoofPassed: boolean;
  framesAnalyzed: number;
  failReason?: string;
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface InitiateResponse {
  sessionId: string;
  expiresAt: Date;
  cameraRequirements: {
    minWidth: number;
    minHeight: number;
    format: 'jpeg' | 'png';
    maxFrameIntervalMs: number;
  };
}

export interface UploadReferenceRequest {
  userId: string;
  imageBase64: string;   // base64-encoded JPEG/PNG
}

export interface UploadReferenceResponse {
  referenceId: string;
  faceDetected: boolean;
  faceQuality: 'high' | 'medium' | 'low';
}

export interface LivenessCheckRequest {
  sessionId: string;
  frames: string[];      // ordered array of base64-encoded frames
}

export interface LivenessCheckResponse {
  livenessScore: number;
  passed: boolean;
  detail: Omit<LivenessResult, 'score' | 'passed'>;
}

export interface CompareRequest {
  sessionId: string;
  captureBase64: string; // single live capture frame
}

export interface CompareResponse {
  verified: boolean;
  similarityScore: number;
  livenessScore: number;
  sessionStatus: SessionStatus;
}

// ─── Error codes ─────────────────────────────────────────────────────────────

export type FaceErrorCode =
  | 'FACE_NOT_DETECTED'
  | 'MULTIPLE_FACES'
  | 'LOW_QUALITY'
  | 'LIVENESS_FAILED'
  | 'MISMATCH'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'NO_REFERENCE'
  | 'INTERNAL_ERROR';
