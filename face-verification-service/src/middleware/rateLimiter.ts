import { NextFunction, Request, Response } from 'express';
import { query } from '../db/client';
import { config } from '../config';
import { AppError } from '../errors/AppError';

/**
 * Database-backed rate limiter.
 * Tracks attempts per (IP + userId) within a sliding window.
 * Using the DB (rather than in-memory) means limits survive restarts
 * and work correctly behind multiple server instances.
 */
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.body?.userId ?? req.headers['x-user-id'] ?? 'anonymous';
  const ip = req.ip ?? '0.0.0.0';
  const key = `${ip}:${userId}`;
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;
  const windowStart = new Date(Date.now() - windowMs);

  try {
    const rows = await query<{ count: string; window_start: Date }>(
      `INSERT INTO rate_limit_store (key, count, window_start, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE
         SET count = CASE
               WHEN rate_limit_store.window_start < $2 THEN 1
               ELSE rate_limit_store.count + 1
             END,
             window_start = CASE
               WHEN rate_limit_store.window_start < $2 THEN NOW()
               ELSE rate_limit_store.window_start
             END,
             updated_at = NOW()
       RETURNING count, window_start`,
      [key, windowStart]
    );

    const count = parseInt(rows[0]?.count ?? '1', 10);

    // Attach headers for transparency
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(Number(rows[0]?.window_start) + windowMs).toISOString()
    );

    if (count > maxRequests) {
      throw new AppError('RATE_LIMITED', { attemptsInWindow: count });
    }

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
    } else {
      // Rate limiter failure must not block legitimate requests
      console.error('[RateLimit] Store error — allowing request:', err);
      next();
    }
  }
}
