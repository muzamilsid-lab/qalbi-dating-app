import {
  CompareFacesCommand,
  CreateCollectionCommand,
  DetectFacesCommand,
  FaceDetail,
  IndexFacesCommand,
  QualityFilter,
  RekognitionClient,
} from '@aws-sdk/client-rekognition';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { query, withTransaction } from '../db/client';
import { AppError } from '../errors/AppError';
import {
  CompareResponse,
  FaceReference,
  FrameAnalysis,
  InitiateResponse,
  LivenessCheckResponse,
  LivenessResult,
  UploadReferenceResponse,
  VerificationSession,
} from '../types';
import { encryptionService, EncryptionService } from './EncryptionService';

// ─── AWS client (singleton) ──────────────────────────────────────────────────

const rekognition = new RekognitionClient({
  region: config.aws.region,
  credentials: {
    accessKeyId:     config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class FaceVerificationService {
  // ─── Initiate session ────────────────────────────────────────────────────

  async initiateSession(userId: string): Promise<InitiateResponse> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + config.session.ttlSeconds * 1000);

    await query(
      `INSERT INTO verification_sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt]
    );

    return {
      sessionId,
      expiresAt,
      cameraRequirements: {
        minWidth:          1280,
        minHeight:         720,
        format:            'jpeg',
        maxFrameIntervalMs: 200, // max gap between liveness frames (~5fps min)
      },
    };
  }

  // ─── Upload reference photo ───────────────────────────────────────────────

  async uploadReference(
    userId: string,
    imageBase64: string
  ): Promise<UploadReferenceResponse> {
    // 1. Detect face quality via Rekognition
    const detection = await rekognition.send(
      new DetectFacesCommand({
        Image: { Bytes: base64ToBytes(imageBase64) },
        Attributes: ['ALL'],
      })
    );

    const faces = detection.FaceDetails ?? [];
    if (faces.length === 0) throw new AppError('FACE_NOT_DETECTED');
    if (faces.length > 1) throw new AppError('MULTIPLE_FACES');

    const face = faces[0];
    const quality = this.assessQuality(face);
    if (quality === 'low') throw new AppError('LOW_QUALITY');

    // 2. Ensure Rekognition collection exists
    await this.ensureCollection();

    // 3. Index face in Rekognition collection
    let rekognitionFaceId: string | null = null;
    try {
      const indexResult = await rekognition.send(
        new IndexFacesCommand({
          CollectionId:    config.aws.collectionId,
          Image:           { Bytes: base64ToBytes(imageBase64) },
          ExternalImageId: userId,
          QualityFilter:   'HIGH' as QualityFilter,
          MaxFaces:        1,
        })
      );
      rekognitionFaceId = indexResult.FaceRecords?.[0]?.Face?.FaceId ?? null;
    } catch {
      // Non-fatal — we fall back to direct CompareFaces if FaceId unavailable
    }

    // 4. Encrypt and persist image
    const imageHash = encryptionService.hashImage(imageBase64);
    const { ciphertext, iv } = encryptionService.encryptImage(imageBase64);
    const deleteAt = new Date(Date.now() + config.gdpr.imageRetentionMs);
    const referenceId = randomUUID();

    await query(
      `INSERT INTO face_references
         (id, user_id, encrypted_image, iv, image_hash, rekognition_face_id, delete_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, image_hash) DO UPDATE
         SET delete_at = EXCLUDED.delete_at`,
      [referenceId, userId, ciphertext, iv, imageHash, rekognitionFaceId, deleteAt]
    );

    return { referenceId, faceDetected: true, faceQuality: quality };
  }

  // ─── Liveness detection ───────────────────────────────────────────────────

  async checkLiveness(
    sessionId: string,
    frames: string[]
  ): Promise<LivenessCheckResponse> {
    const session = await this.getValidSession(sessionId);

    if (frames.length < config.liveness.minFrames) {
      throw new AppError('LIVENESS_FAILED', {
        reason: `Minimum ${config.liveness.minFrames} frames required, got ${frames.length}`,
      });
    }

    // Analyse each frame
    const analyses = await this.analyseFrames(frames);
    const result = this.computeLivenessScore(analyses);

    // Persist liveness score to session
    await query(
      `UPDATE verification_sessions
       SET liveness_score = $1
       WHERE id = $2`,
      [result.score, sessionId]
    );

    return {
      livenessScore: result.score,
      passed: result.passed,
      detail: {
        blinkDetected:          result.blinkDetected,
        headMovementDetected:   result.headMovementDetected,
        antiSpoofPassed:        result.antiSpoofPassed,
        framesAnalyzed:         result.framesAnalyzed,
        ...(result.failReason ? { failReason: result.failReason } : {}),
      },
    };
  }

  // ─── Compare live capture to reference ───────────────────────────────────

  async compareFaces(
    sessionId: string,
    captureBase64: string
  ): Promise<CompareResponse> {
    const session = await this.getValidSession(sessionId);
    await this.incrementAttempts(sessionId, session.attempts);

    // Fetch latest reference for user
    const refs = await query<FaceReference>(
      `SELECT * FROM face_references
       WHERE  user_id = $1
       AND    delete_at > NOW()
       ORDER  BY created_at DESC
       LIMIT  1`,
      [session.user_id]
    );

    if (refs.length === 0) throw new AppError('NO_REFERENCE');

    const ref = refs[0];
    let similarityScore = 0;
    let captureBuffer: Buffer | null = null;

    try {
      // Decrypt reference image for comparison
      const referenceBase64 = encryptionService.decryptImage(ref.encrypted_image, ref.iv);
      captureBuffer = Buffer.from(captureBase64, 'base64');

      const compareResult = await rekognition.send(
        new CompareFacesCommand({
          SourceImage: { Bytes: new Uint8Array(captureBuffer) },
          TargetImage: { Bytes: base64ToBytes(referenceBase64) },
          SimilarityThreshold: 0,   // get all matches, we threshold ourselves
          QualityFilter: 'HIGH' as QualityFilter,
        })
      );

      const topMatch = compareResult.FaceMatches?.[0];

      if (!topMatch) {
        // No match found — check unmatched faces for quality errors
        const unmatched = compareResult.UnmatchedFaces ?? [];
        if (unmatched.length === 0) throw new AppError('FACE_NOT_DETECTED');
        similarityScore = 0;
      } else {
        similarityScore = topMatch.Similarity ?? 0;
      }
    } finally {
      // Zero captured image from memory immediately after use
      if (captureBuffer) EncryptionService.wipe(captureBuffer);
    }

    const livenessScore = session.liveness_score ?? 0;
    const verified =
      similarityScore >= config.similarity.threshold &&
      livenessScore >= config.liveness.passScore;

    const newStatus = verified ? 'passed' : 'failed';

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE verification_sessions
         SET status = $1, similarity_score = $2, completed_at = NOW()
         WHERE id = $3`,
        [newStatus, similarityScore, sessionId]
      );
    });

    return {
      verified,
      similarityScore: Math.round(similarityScore * 100) / 100,
      livenessScore,
      sessionStatus: newStatus,
    };
  }

  // ─── Private: frame analysis ──────────────────────────────────────────────

  private async analyseFrames(frames: string[]): Promise<FrameAnalysis[]> {
    // Process frames concurrently (max 5 at a time to respect AWS rate limits)
    const CONCURRENCY = 5;
    const results: FrameAnalysis[] = [];

    for (let i = 0; i < frames.length; i += CONCURRENCY) {
      const batch = frames.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((frame, idx) => this.analyseFrame(frame, i + idx))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async analyseFrame(frameBase64: string, index: number): Promise<FrameAnalysis> {
    try {
      const result = await rekognition.send(
        new DetectFacesCommand({
          Image:      { Bytes: base64ToBytes(frameBase64) },
          Attributes: ['ALL'],
        })
      );

      const faces = result.FaceDetails ?? [];

      if (faces.length === 0) {
        return this.emptyFrameAnalysis(index, false, false);
      }
      if (faces.length > 1) {
        return this.emptyFrameAnalysis(index, true, true);
      }

      const f = faces[0];
      const pose = f.Pose ?? {};
      const quality = f.Quality ?? {};
      const eyesOpen = f.EyesOpen ?? {};

      return {
        frameIndex:      index,
        faceDetected:    true,
        multipleFaces:   false,
        eyeOpenLeft:     f.Landmarks?.find(l => l.Type === 'leftEyeLeft') ? (eyesOpen.Value ? 0.9 : 0.1) : 0.5,
        eyeOpenRight:    eyesOpen.Value ? 0.9 : 0.1,
        yaw:             pose.Yaw ?? 0,
        pitch:           pose.Pitch ?? 0,
        roll:            pose.Roll ?? 0,
        smile:           f.Smile?.Value ? (f.Smile.Confidence ?? 50) / 100 : 0,
        brightness:      quality.Brightness ?? 50,
        sharpness:       quality.Sharpness ?? 50,
      };
    } catch {
      return this.emptyFrameAnalysis(index, false, false);
    }
  }

  private emptyFrameAnalysis(
    index: number,
    faceDetected: boolean,
    multipleFaces: boolean
  ): FrameAnalysis {
    return {
      frameIndex: index, faceDetected, multipleFaces,
      eyeOpenLeft: 0, eyeOpenRight: 0,
      yaw: 0, pitch: 0, roll: 0,
      smile: 0, brightness: 0, sharpness: 0,
    };
  }

  // ─── Private: liveness score computation ─────────────────────────────────

  private computeLivenessScore(frames: FrameAnalysis[]): LivenessResult {
    const detected = frames.filter(f => f.faceDetected && !f.multipleFaces);

    if (detected.length < config.liveness.minFrames) {
      return {
        score: 0, passed: false,
        blinkDetected: false, headMovementDetected: false,
        antiSpoofPassed: false, framesAnalyzed: frames.length,
        failReason: 'Face not consistently detected across frames',
      };
    }

    // ── Anti-spoof: face width/yaw variance (still images have zero variance) ──
    const yaws = detected.map(f => f.yaw);
    const yawStdDev = stdDev(yaws);
    const antiSpoofPassed = yawStdDev >= config.liveness.antiSpoofStdDev;

    if (!antiSpoofPassed) {
      return {
        score: 10, passed: false,
        blinkDetected: false, headMovementDetected: false,
        antiSpoofPassed: false, framesAnalyzed: frames.length,
        failReason: 'Possible photo or screen replay detected',
      };
    }

    // ── Blink detection: eye openness drops below threshold then recovers ──
    const eyeValues = detected.map(f => (f.eyeOpenLeft + f.eyeOpenRight) / 2);
    let blinkDetected = false;
    let inBlink = false;
    for (const val of eyeValues) {
      if (!inBlink && val < config.liveness.blinkThreshold) {
        inBlink = true;
      } else if (inBlink && val > 0.6) {
        blinkDetected = true;
        break;
      }
    }

    // ── Head movement: yaw range covers required degrees ──
    const maxYaw = Math.max(...yaws);
    const minYaw = Math.min(...yaws);
    const headMovementDetected = (maxYaw - minYaw) >= config.liveness.headTurnDegrees;

    // ── Quality gate ──
    const avgBrightness = detected.reduce((s, f) => s + f.brightness, 0) / detected.length;
    const avgSharpness  = detected.reduce((s, f) => s + f.sharpness, 0) / detected.length;

    // ── Score calculation ──
    let score = 0;
    score += antiSpoofPassed   ? 35 : 0;
    score += blinkDetected      ? 30 : 0;
    score += headMovementDetected ? 25 : 0;
    score += avgBrightness >= 40  ? 5  : 0;
    score += avgSharpness  >= 40  ? 5  : 0;

    const passed = score >= config.liveness.passScore;

    return {
      score,
      passed,
      blinkDetected,
      headMovementDetected,
      antiSpoofPassed,
      framesAnalyzed: frames.length,
      ...(!passed ? { failReason: this.buildFailReason(blinkDetected, headMovementDetected, avgBrightness) } : {}),
    };
  }

  private buildFailReason(blink: boolean, head: boolean, brightness: number): string {
    if (!blink && !head) return 'No blink or head movement detected';
    if (!blink) return 'No blink detected — please blink naturally';
    if (!head) return 'No head movement detected — please turn your head slowly';
    if (brightness < 40) return 'Insufficient lighting — please improve lighting conditions';
    return 'Liveness score below threshold';
  }

  // ─── Private: session helpers ─────────────────────────────────────────────

  private async getValidSession(sessionId: string): Promise<VerificationSession> {
    const rows = await query<VerificationSession>(
      `SELECT * FROM verification_sessions WHERE id = $1`,
      [sessionId]
    );

    if (rows.length === 0) throw new AppError('SESSION_NOT_FOUND');

    const session = rows[0];

    if (session.status === 'expired' || new Date(session.expires_at) < new Date()) {
      if (session.status !== 'expired') {
        await query(
          `UPDATE verification_sessions SET status = 'expired' WHERE id = $1`,
          [sessionId]
        );
      }
      throw new AppError('SESSION_EXPIRED');
    }

    if (session.status !== 'pending') {
      throw new AppError('SESSION_EXHAUSTED', { status: session.status });
    }

    return session;
  }

  private async incrementAttempts(sessionId: string, current: number): Promise<void> {
    const next = current + 1;
    await query(
      `UPDATE verification_sessions SET attempts = $1 WHERE id = $2`,
      [next, sessionId]
    );

    if (next > config.session.maxAttempts) {
      await query(
        `UPDATE verification_sessions SET status = 'failed', completed_at = NOW() WHERE id = $1`,
        [sessionId]
      );
      throw new AppError('SESSION_EXHAUSTED');
    }
  }

  // ─── Private: Rekognition collection ─────────────────────────────────────

  private async ensureCollection(): Promise<void> {
    try {
      await rekognition.send(
        new CreateCollectionCommand({ CollectionId: config.aws.collectionId })
      );
    } catch (err: unknown) {
      // ResourceAlreadyExistsException is expected on subsequent calls
      if ((err as { name?: string }).name !== 'ResourceAlreadyExistsException') {
        throw err;
      }
    }
  }

  // ─── Private: quality assessment ─────────────────────────────────────────

  private assessQuality(face: FaceDetail): 'high' | 'medium' | 'low' {
    const brightness = face.Quality?.Brightness ?? 0;
    const sharpness  = face.Quality?.Sharpness  ?? 0;
    const confidence = face.Confidence           ?? 0;

    if (brightness >= 50 && sharpness >= 50 && confidence >= 95) return 'high';
    if (brightness >= 30 && sharpness >= 30 && confidence >= 80) return 'medium';
    return 'low';
  }
}

export const faceVerificationService = new FaceVerificationService();
