import { Router } from 'express';
import {
  compareFaces,
  initiateVerification,
  livenessCheck,
  uploadReference,
} from '../controllers/verify.controller';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  compareSchema,
  initiateSchema,
  livenessCheckSchema,
  uploadReferenceSchema,
  validate,
} from '../middleware/sessionValidator';

const router = Router();

/**
 * POST /api/verify/initiate
 * Start a new verification session. Rate-limited to 3/hour per IP+user.
 */
router.post(
  '/initiate',
  rateLimiter,
  validate(initiateSchema),
  initiateVerification
);

/**
 * POST /api/verify/upload-reference
 * Upload a reference face photo. Rate-limited.
 */
router.post(
  '/upload-reference',
  rateLimiter,
  validate(uploadReferenceSchema),
  uploadReference
);

/**
 * POST /api/verify/liveness-check
 * Submit a sequence of frames for liveness analysis.
 */
router.post(
  '/liveness-check',
  validate(livenessCheckSchema),
  livenessCheck
);

/**
 * POST /api/verify/compare
 * Compare live capture against stored reference.
 */
router.post(
  '/compare',
  validate(compareSchema),
  compareFaces
);

export default router;
