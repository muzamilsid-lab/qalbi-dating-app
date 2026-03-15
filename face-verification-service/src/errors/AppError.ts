import { FaceErrorCode } from '../types';

const ERROR_MESSAGES: Record<FaceErrorCode, string> = {
  FACE_NOT_DETECTED:   'Please ensure your face is clearly visible',
  MULTIPLE_FACES:      'Only one face should be in frame',
  LOW_QUALITY:         'Please improve lighting conditions',
  LIVENESS_FAILED:     'Please follow the on-screen instructions',
  MISMATCH:            'Photo verification failed. Please try again or contact support',
  SESSION_NOT_FOUND:   'Verification session not found',
  SESSION_EXPIRED:     'Verification session has expired. Please start again',
  SESSION_EXHAUSTED:   'Maximum verification attempts reached',
  RATE_LIMITED:        'Too many attempts. Please wait before trying again',
  NO_REFERENCE:        'No reference photo found. Please upload your profile photo first',
  INTERNAL_ERROR:      'An internal error occurred. Please try again',
};

const HTTP_STATUS: Record<FaceErrorCode, number> = {
  FACE_NOT_DETECTED:   422,
  MULTIPLE_FACES:      422,
  LOW_QUALITY:         422,
  LIVENESS_FAILED:     422,
  MISMATCH:            401,
  SESSION_NOT_FOUND:   404,
  SESSION_EXPIRED:     410,
  SESSION_EXHAUSTED:   429,
  RATE_LIMITED:        429,
  NO_REFERENCE:        404,
  INTERNAL_ERROR:      500,
};

export class AppError extends Error {
  public readonly code: FaceErrorCode;
  public readonly httpStatus: number;
  public readonly detail?: Record<string, unknown>;

  constructor(code: FaceErrorCode, detail?: Record<string, unknown>) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.detail = detail;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.detail ? { detail: this.detail } : {}),
      },
    };
  }
}
