import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { json } from 'express';
import { config } from './config';
import verifyRoutes from './routes/verify.routes';
import { AppError } from './errors/AppError';
import { closePool, getPool } from './db/client';
import { runCleanupJobs } from './jobs/cleanup';

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1); // trust X-Forwarded-For from reverse proxy

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.env === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') ?? []
      : '*',
    methods: ['POST'],
    allowedHeaders: ['Content-Type', 'x-user-id', 'x-session-id'],
  })
);

// ─── Body parser — limit to 50 MB to accommodate base64 frame sequences ──────
app.use(json({ limit: '50mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/verify', verifyRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json(err.toJSON());
    return;
  }

  // Unexpected errors — log internally, never expose stack to client
  console.error('[Server] Unhandled error:', err);
  const internal = new AppError('INTERNAL_ERROR');
  res.status(500).json(internal.toJSON());
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  // Warm up DB pool
  try {
    await getPool().connect().then(c => c.release());
    console.info('[DB] Pool connected');
  } catch (err) {
    console.error('[DB] Failed to connect:', err);
    process.exit(1);
  }

  // Run initial cleanup, then schedule every 5 minutes
  await runCleanupJobs();
  const cleanupInterval = setInterval(runCleanupJobs, 5 * 60 * 1000);

  const server = app.listen(config.port, () => {
    console.info(`[Server] FaceVerificationService running on port ${config.port} (${config.env})`);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.info(`[Server] ${signal} received — shutting down gracefully`);
    clearInterval(cleanupInterval);
    server.close(async () => {
      await closePool();
      console.info('[Server] Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10s if connections hang
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

export default app;
