import { useCallback, useRef, useState } from 'react';
import {
  AntiSpoofResult,
  FaceData,
  HeadTurnPhase,
  LivenessCheckType,
  LivenessState,
  VerificationStep,
} from '../types';

// Thresholds
const EYE_CLOSED_THRESHOLD = 0.3;
const EYE_OPEN_THRESHOLD = 0.7;
const SMILE_THRESHOLD = 0.75;
const HEAD_TURN_ANGLE = 22; // degrees
const FACE_CENTER_TOLERANCE = 0.25; // 25% deviation from center allowed
const BLINK_WINDOW_MS = 3000;
const ANTI_SPOOF_FRAME_BUFFER = 20;
const MIN_FACE_SIZE_FRACTION = 0.25; // face must cover 25% of frame width
const SPOOF_STILLNESS_THRESHOLD = 1.5; // px std dev — below this = suspiciously still

interface BlinkTracker {
  phase: 'open' | 'closing' | 'closed' | 'opening';
  startedAt: number;
}

interface FaceFrame {
  yaw: number;
  faceWidth: number;
  timestamp: number;
}

export function useLivenessDetection(frameWidth: number, frameHeight: number) {
  const [step, setStep] = useState<VerificationStep>('idle');
  const [liveness, setLiveness] = useState<LivenessState>({
    blinkDetected: false,
    headTurnDetected: false,
    smileDetected: false,
    passedChecks: 0,
    livenessScore: 0,
  });
  const [antiSpoofResult, setAntiSpoofResult] = useState<AntiSpoofResult>({ passed: false });

  const blinkTracker = useRef<BlinkTracker>({ phase: 'open', startedAt: 0 });
  const headTurnPhase = useRef<HeadTurnPhase>('idle');
  const frameBuffer = useRef<FaceFrame[]>([]);
  const checksOrder = useRef<LivenessCheckType[]>(['blink', 'headturn', 'smile']);
  const currentCheckIndex = useRef(0);

  // ─── Anti-spoof analysis ────────────────────────────────────────────────────
  const analyzeAntiSpoof = useCallback((frames: FaceFrame[]): AntiSpoofResult => {
    if (frames.length < ANTI_SPOOF_FRAME_BUFFER) {
      return { passed: false, reason: 'Insufficient frames for analysis' };
    }

    // Check 1: Face size variance — printed photos are dead still
    const widths = frames.map(f => f.faceWidth);
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / widths.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < SPOOF_STILLNESS_THRESHOLD) {
      return { passed: false, reason: 'Face too still — possible printed photo or replay attack' };
    }

    // Check 2: Yaw variance — real users have micro head movements
    const yaws = frames.map(f => f.yaw);
    const yawMean = yaws.reduce((a, b) => a + b, 0) / yaws.length;
    const yawStdDev = Math.sqrt(
      yaws.reduce((sum, y) => sum + Math.pow(y - yawMean, 2), 0) / yaws.length
    );

    if (yawStdDev < 0.3) {
      return { passed: false, reason: 'Unnatural stillness detected' };
    }

    // Check 3: Frame timing — screen replay attacks often have dropped frames
    const intervals: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      intervals.push(frames[i].timestamp - frames[i - 1].timestamp);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, t) => sum + Math.pow(t - avgInterval, 2), 0) / intervals.length;

    // Real-time camera has consistent frame intervals; replays have jitter
    if (Math.sqrt(intervalVariance) > avgInterval * 1.5) {
      return { passed: false, reason: 'Irregular frame timing — possible screen replay' };
    }

    return { passed: true };
  }, []);

  // ─── Face-in-oval check ─────────────────────────────────────────────────────
  const isFaceInOval = useCallback(
    (face: FaceData): boolean => {
      const faceCenterX = face.bounds.origin.x + face.bounds.size.width / 2;
      const faceCenterY = face.bounds.origin.y + face.bounds.size.height / 2;
      const frameCenterX = frameWidth / 2;
      const frameCenterY = frameHeight / 2;

      const deviationX = Math.abs(faceCenterX - frameCenterX) / frameWidth;
      const deviationY = Math.abs(faceCenterY - frameCenterY) / frameHeight;
      const faceSizeFraction = face.bounds.size.width / frameWidth;

      return (
        deviationX < FACE_CENTER_TOLERANCE &&
        deviationY < FACE_CENTER_TOLERANCE &&
        faceSizeFraction >= MIN_FACE_SIZE_FRACTION
      );
    },
    [frameWidth, frameHeight]
  );

  // ─── Blink detection ────────────────────────────────────────────────────────
  const detectBlink = useCallback(
    (face: FaceData): boolean => {
      const avgEyeOpen = (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
      const tracker = blinkTracker.current;
      const now = Date.now();

      // Reset if window expired
      if (tracker.startedAt && now - tracker.startedAt > BLINK_WINDOW_MS) {
        blinkTracker.current = { phase: 'open', startedAt: now };
        return false;
      }

      switch (tracker.phase) {
        case 'open':
          if (avgEyeOpen > EYE_OPEN_THRESHOLD) {
            if (!tracker.startedAt) blinkTracker.current.startedAt = now;
          } else if (avgEyeOpen < EYE_CLOSED_THRESHOLD) {
            blinkTracker.current.phase = 'closed';
          }
          break;

        case 'closed':
          if (avgEyeOpen > EYE_OPEN_THRESHOLD) {
            // Completed open -> closed -> open cycle = blink
            blinkTracker.current.phase = 'open';
            return true;
          }
          break;
      }

      return false;
    },
    []
  );

  // ─── Head turn detection ────────────────────────────────────────────────────
  const detectHeadTurn = useCallback((face: FaceData): boolean => {
    const yaw = face.yawAngle;

    switch (headTurnPhase.current) {
      case 'idle':
        // Wait for face to be roughly centered first
        if (Math.abs(yaw) < 10) {
          headTurnPhase.current = 'left';
        }
        break;

      case 'left':
        if (yaw < -HEAD_TURN_ANGLE) {
          headTurnPhase.current = 'right';
        }
        break;

      case 'right':
        if (yaw > HEAD_TURN_ANGLE) {
          headTurnPhase.current = 'done';
          return true;
        }
        break;
    }

    return false;
  }, []);

  // ─── Smile detection ────────────────────────────────────────────────────────
  const detectSmile = useCallback((face: FaceData): boolean => {
    return face.smilingProbability > SMILE_THRESHOLD;
  }, []);

  // ─── Score calculation ──────────────────────────────────────────────────────
  const calculateLivenessScore = useCallback((state: LivenessState): number => {
    let score = 0;
    if (state.blinkDetected) score += 34;
    if (state.headTurnDetected) score += 33;
    if (state.smileDetected) score += 33;
    return score;
  }, []);

  // ─── Main face frame processor ──────────────────────────────────────────────
  const processFaceFrame = useCallback(
    (face: FaceData): VerificationStep => {
      const now = Date.now();

      // Buffer frames for anti-spoof analysis
      frameBuffer.current.push({
        yaw: face.yawAngle,
        faceWidth: face.bounds.size.width,
        timestamp: now,
      });
      if (frameBuffer.current.length > ANTI_SPOOF_FRAME_BUFFER * 2) {
        frameBuffer.current = frameBuffer.current.slice(-ANTI_SPOOF_FRAME_BUFFER);
      }

      // Run anti-spoof check once we have enough frames
      if (
        frameBuffer.current.length >= ANTI_SPOOF_FRAME_BUFFER &&
        !antiSpoofResult.passed
      ) {
        const result = analyzeAntiSpoof(frameBuffer.current);
        setAntiSpoofResult(result);
        if (!result.passed) {
          setStep('failed');
          return 'failed';
        }
      }

      if (step === 'idle') {
        setStep('positioning');
        return 'positioning';
      }

      if (step === 'positioning') {
        if (isFaceInOval(face)) {
          const firstCheck = checksOrder.current[0];
          setStep(firstCheck);
          return firstCheck;
        }
        return 'positioning';
      }

      // Process current liveness check
      const currentCheck = checksOrder.current[currentCheckIndex.current] as LivenessCheckType;
      let checkPassed = false;

      if (currentCheck === 'blink') checkPassed = detectBlink(face);
      else if (currentCheck === 'headturn') checkPassed = detectHeadTurn(face);
      else if (currentCheck === 'smile') checkPassed = detectSmile(face);

      if (checkPassed) {
        setLiveness(prev => {
          const updated: LivenessState = {
            ...prev,
            blinkDetected: prev.blinkDetected || currentCheck === 'blink',
            headTurnDetected: prev.headTurnDetected || currentCheck === 'headturn',
            smileDetected: prev.smileDetected || currentCheck === 'smile',
            passedChecks: prev.passedChecks + 1,
          };
          updated.livenessScore = calculateLivenessScore(updated);

          // 2 of 3 checks passed — proceed to capture
          if (updated.passedChecks >= 2) {
            setStep('capturing');
          } else {
            // Move to next check
            currentCheckIndex.current += 1;
            const nextCheck = checksOrder.current[currentCheckIndex.current] as LivenessCheckType;
            if (nextCheck) setStep(nextCheck);
          }

          return updated;
        });
      }

      return step;
    },
    [
      step,
      antiSpoofResult.passed,
      analyzeAntiSpoof,
      isFaceInOval,
      detectBlink,
      detectHeadTurn,
      detectSmile,
      calculateLivenessScore,
    ]
  );

  const reset = useCallback(() => {
    setStep('idle');
    setLiveness({
      blinkDetected: false,
      headTurnDetected: false,
      smileDetected: false,
      passedChecks: 0,
      livenessScore: 0,
    });
    setAntiSpoofResult({ passed: false });
    blinkTracker.current = { phase: 'open', startedAt: 0 };
    headTurnPhase.current = 'idle';
    frameBuffer.current = [];
    currentCheckIndex.current = 0;
  }, []);

  return {
    step,
    liveness,
    antiSpoofResult,
    headTurnPhase: headTurnPhase.current,
    processFaceFrame,
    reset,
  };
}
