import { NextFunction, Request, Response } from 'express';
import { auditService } from '../services/AuditService';
import { faceVerificationService } from '../services/FaceVerificationService';
import { AppError } from '../errors/AppError';

function ipOf(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
    req.socket.remoteAddress ??
    '0.0.0.0'
  );
}

// ─── POST /api/verify/initiate ────────────────────────────────────────────────

export async function initiateVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = req.body;
  const ip = ipOf(req);

  try {
    const result = await faceVerificationService.initiateSession(userId);

    await auditService.log({
      sessionId: result.sessionId,
      userId,
      action: 'session.initiate',
      result: 'success',
      detail: { expiresAt: result.expiresAt },
      ipAddress: ip,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    await auditService.log({
      userId,
      action: 'session.initiate',
      result: 'error',
      detail: { error: (err as Error).message },
      ipAddress: ip,
    });
    next(err);
  }
}

// ─── POST /api/verify/upload-reference ────────────────────────────────────────

export async function uploadReference(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId, imageBase64 } = req.body;
  const ip = ipOf(req);

  try {
    const result = await faceVerificationService.uploadReference(userId, imageBase64);

    await auditService.log({
      userId,
      action: 'reference.upload',
      result: 'success',
      detail: { referenceId: result.referenceId, quality: result.faceQuality },
      ipAddress: ip,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    await auditService.log({
      userId,
      action: 'reference.upload',
      result: err instanceof AppError ? 'failure' : 'error',
      detail: { error: (err as Error).message },
      ipAddress: ip,
    });
    next(err);
  }
}

// ─── POST /api/verify/liveness-check ─────────────────────────────────────────

export async function livenessCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { sessionId, frames } = req.body;
  const ip = ipOf(req);

  try {
    const result = await faceVerificationService.checkLiveness(sessionId, frames);

    await auditService.log({
      sessionId,
      action: 'liveness.check',
      result: result.passed ? 'success' : 'failure',
      detail: {
        livenessScore: result.livenessScore,
        framesAnalyzed: result.detail.framesAnalyzed,
        failReason: result.detail.failReason ?? null,
      },
      ipAddress: ip,
    });

    const statusCode = result.passed ? 200 : 422;
    res.status(statusCode).json({ data: result });
  } catch (err) {
    await auditService.log({
      sessionId,
      action: 'liveness.check',
      result: 'error',
      detail: { error: (err as Error).message },
      ipAddress: ip,
    });
    next(err);
  }
}

// ─── POST /api/verify/compare ─────────────────────────────────────────────────

export async function compareFaces(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { sessionId, captureBase64 } = req.body;
  const ip = ipOf(req);

  try {
    const result = await faceVerificationService.compareFaces(sessionId, captureBase64);

    await auditService.log({
      sessionId,
      action: 'face.compare',
      result: result.verified ? 'success' : 'failure',
      detail: {
        verified:        result.verified,
        similarityScore: result.similarityScore,
        livenessScore:   result.livenessScore,
        sessionStatus:   result.sessionStatus,
      },
      ipAddress: ip,
    });

    if (!result.verified) {
      res.status(401).json({
        data: result,
        ...(new AppError('MISMATCH')).toJSON(),
      });
      return;
    }

    res.status(200).json({ data: result });
  } catch (err) {
    await auditService.log({
      sessionId,
      action: 'face.compare',
      result: 'error',
      detail: { error: (err as Error).message },
      ipAddress: ip,
    });
    next(err);
  }
}
