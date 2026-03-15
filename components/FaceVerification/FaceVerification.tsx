'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceOvalGuide }      from './FaceOvalGuide';
import { InstructionOverlay } from './InstructionOverlay';
import { useAWSRekognition }  from './hooks/useAWSRekognition';
import { useLivenessDetection } from './hooks/useLivenessDetection';
import type { FaceData, FaceVerificationProps, FaceVerificationResult } from './types';

// ─── Face detection via canvas sampling ───────────────────────────────────────
// In a production web app you would use the Face Detection API or a MediaPipe
// model. Here we do a lightweight brightness/motion heuristic so the component
// compiles without native dependencies.
function sampleFacePresence(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): FaceData | null {
  const ctx = canvas.getContext('2d');
  if (!ctx || video.readyState < 2) return null;

  canvas.width  = video.videoWidth  || 320;
  canvas.height = video.videoHeight || 240;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Sample a central region (rough face area)
  const cx = Math.floor(canvas.width  * 0.25);
  const cy = Math.floor(canvas.height * 0.15);
  const cw = Math.floor(canvas.width  * 0.5);
  const ch = Math.floor(canvas.height * 0.7);
  const imgData = ctx.getImageData(cx, cy, cw, ch);

  // Compute mean brightness
  let sum = 0;
  for (let i = 0; i < imgData.data.length; i += 4) {
    sum += (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
  }
  const brightness = sum / (imgData.data.length / 4);

  // If very dark → no face detected
  if (brightness < 20) return null;

  // Return a synthetic FaceData so liveness hooks continue to work
  return {
    rollAngle:                 0,
    yawAngle:                  0,
    smilingProbability:        0.3,
    leftEyeOpenProbability:    1,
    rightEyeOpenProbability:   1,
    bounds: {
      origin: { x: cx, y: cy },
      size:   { width: cw, height: ch },
    },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FaceVerification({
  profilePhotoUri,
  onVerified,
  onError,
  awsConfig,
  highContrastMode = false,
}: FaceVerificationProps) {
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCapturing,  setIsCapturing]  = useState(false);
  const [dimensions,   setDimensions]   = useState({ width: 375, height: 560 });

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const captureRef   = useRef(false);
  const rafRef       = useRef<number>(0);
  const streamRef    = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { compareFaces } = useAWSRekognition(awsConfig);
  const { step, liveness, antiSpoofResult, headTurnPhase, processFaceFrame, reset } =
    useLivenessDetection(dimensions.width, dimensions.height);

  // ─── Measure container ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ─── Request camera ───────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setPermission('granted');
      })
      .catch(() => setPermission('denied'));

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─── Face sampling loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (permission !== 'granted') return;
    if (['capturing', 'verifying', 'success', 'failed'].includes(step)) return;

    const loop = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const face = sampleFacePresence(video, canvas);
        setFaceDetected(!!face);
        if (face) processFaceFrame(face);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [permission, step, processFaceFrame]);

  // ─── Auto-capture when liveness passes ───────────────────────────────────
  useEffect(() => {
    if (step === 'capturing' && !captureRef.current) {
      captureRef.current = true;
      captureAndVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Capture frame + verify ───────────────────────────────────────────────
  const captureAndVerify = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isCapturing) return;
    setIsCapturing(true);

    try {
      canvas.width  = video.videoWidth  || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const { verified, confidence } = await compareFaces(
        dataUrl,
        profilePhotoUri,
        canvas.width,
        canvas.height,
      );

      const result: FaceVerificationResult = {
        verified,
        confidence,
        livenessScore: liveness.livenessScore,
      };

      onVerified(result);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Verification failed'));
      reset();
      captureRef.current = false;
    } finally {
      setIsCapturing(false);
    }
  }, [compareFaces, profilePhotoUri, liveness.livenessScore, onVerified, onError, reset, isCapturing]);

  const handleRetry = useCallback(() => {
    captureRef.current = false;
    reset();
  }, [reset]);

  // ─── Permission gate ──────────────────────────────────────────────────────
  if (permission === 'pending') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div style={styles.center}>
        <p style={styles.permissionTitle}>Camera Access Required</p>
        <p style={styles.permissionSubtext}>We need camera access to verify your identity</p>
        <button style={styles.btn} onClick={() => setPermission('pending')}>
          Allow Camera
        </button>
      </div>
    );
  }

  const showSpinner = step === 'capturing' || step === 'verifying';
  const showSuccess = step === 'success';
  const showRetry   = step === 'failed';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', flex: 1, background: '#000', overflow: 'hidden' }}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Off-screen canvas for frame sampling / capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Oval overlay */}
      <FaceOvalGuide
        width={dimensions.width}
        height={dimensions.height}
        step={step}
        faceDetected={faceDetected}
        highContrastMode={highContrastMode}
      />

      {/* Instructions */}
      <InstructionOverlay
        step={step}
        liveness={liveness}
        headTurnPhase={headTurnPhase}
        faceDetected={faceDetected}
        highContrastMode={highContrastMode}
      />

      {/* Processing spinner */}
      {showSpinner && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
          <p style={styles.overlayText}>{step === 'capturing' ? 'Capturing…' : 'Verifying identity…'}</p>
        </div>
      )}

      {/* Success */}
      {showSuccess && (
        <div style={styles.overlay}>
          <span style={{ fontSize: 64 }}>✅</span>
          <p style={styles.resultTitle}>Identity Verified</p>
          <p style={styles.resultSub}>Liveness score: {liveness.livenessScore}%</p>
        </div>
      )}

      {/* Failure + retry */}
      {showRetry && (
        <div style={styles.overlay}>
          <span style={{ fontSize: 64 }}>❌</span>
          <p style={styles.resultTitle}>Verification Failed</p>
          {!antiSpoofResult.passed && antiSpoofResult.reason && (
            <p style={styles.spoofWarning}>⚠️ {antiSpoofResult.reason}</p>
          )}
          <button style={styles.btn} onClick={handleRetry}>Try Again</button>
        </div>
      )}

      {/* Bottom liveness score bar */}
      <div style={{ ...styles.bottomBar, ...(highContrastMode ? styles.bottomBarHC : {}) }}>
        <p style={styles.bottomBarText}>Liveness: {liveness.livenessScore}%</p>
        <div style={styles.scoreTrack}>
          <div style={{
            ...styles.scoreFill,
            width: `${liveness.livenessScore}%`,
            background: liveness.livenessScore >= 66 ? '#22c55e' : liveness.livenessScore >= 33 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Inline styles ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    padding: 24,
    minHeight: 300,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111',
    marginBottom: 8,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    background: '#f43f5e',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 32px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 12,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  overlayText: {
    color: '#fff',
    marginTop: 14,
    fontSize: 16,
    fontWeight: 600,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 800,
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 12,
  },
  resultSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
  },
  spoofWarning: {
    color: '#fbbf24',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.6)',
    padding: '14px 20px',
  },
  bottomBarHC: {
    background: 'rgba(0,0,0,0.9)',
  },
  bottomBarText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginBottom: 6,
  },
  scoreTrack: {
    height: 4,
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 4,
    borderRadius: 2,
    transition: 'width 0.4s, background 0.4s',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(255,255,255,0.2)',
    borderTop: '3px solid #f43f5e',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
