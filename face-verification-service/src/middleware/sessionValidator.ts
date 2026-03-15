import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';

// ─── Request body schemas ────────────────────────────────────────────────────

export const initiateSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const uploadReferenceSchema = z.object({
  userId:      z.string().uuid(),
  imageBase64: z
    .string()
    .min(100, 'Image data too small')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'imageBase64 must be valid base64'),
});

export const livenessCheckSchema = z.object({
  sessionId: z.string().uuid(),
  frames: z
    .array(
      z.string().regex(/^[A-Za-z0-9+/]+=*$/, 'Each frame must be valid base64')
    )
    .min(1, 'At least 1 frame required')
    .max(120, 'Maximum 120 frames per request'),
});

export const compareSchema = z.object({
  sessionId:     z.string().uuid(),
  captureBase64: z
    .string()
    .min(100, 'Capture image too small')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'captureBase64 must be valid base64'),
});

// ─── Validation middleware factory ────────────────────────────────────────────

export function validate<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const detail = result.error.flatten().fieldErrors;
      next(new AppError('INTERNAL_ERROR', { validationErrors: detail }));
      return;
    }
    // Attach validated + typed body
    req.body = result.data;
    next();
  };
}

// ─── Session ID header/body extractor ────────────────────────────────────────

export function extractSessionId(req: Request): string {
  const id =
    req.body?.sessionId ??
    req.headers['x-session-id'] ??
    req.params?.sessionId;

  if (!id || typeof id !== 'string') {
    throw new AppError('SESSION_NOT_FOUND', { reason: 'sessionId not provided' });
  }
  return id;
}
