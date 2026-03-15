'use client';

import { CameraView, useCameraPermissions, FaceDetectionResult } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FaceOvalGuide } from './FaceOvalGuide';
import { InstructionOverlay } from './InstructionOverlay';
import { useAWSRekognition } from './hooks/useAWSRekognition';
import { useLivenessDetection } from './hooks/useLivenessDetection';
import { FaceData, FaceVerificationProps, FaceVerificationResult } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_HEIGHT = SCREEN_HEIGHT * 0.75;

// Minimum camera resolution
const CAMERA_PICTURE_SIZE = '1280x720';

export function FaceVerification({
  profilePhotoUri,
  onVerified,
  onError,
  awsConfig,
  highContrastMode = false,
}: FaceVerificationProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const captureTriggered = useRef(false);
  const cameraRef = useRef<CameraView>(null);

  const { compareFaces } = useAWSRekognition(awsConfig);
  const {
    step,
    liveness,
    antiSpoofResult,
    headTurnPhase,
    processFaceFrame,
    reset,
  } = useLivenessDetection(SCREEN_WIDTH, CAMERA_HEIGHT);

  // ─── Auto-capture when liveness checks pass ────────────────────────────────
  useEffect(() => {
    if (step === 'capturing' && !captureTriggered.current) {
      captureTriggered.current = true;
      captureAndVerify();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Face detection handler ────────────────────────────────────────────────
  const handleFacesDetected = useCallback(
    ({ faces }: FaceDetectionResult) => {
      if (
        step === 'capturing' ||
        step === 'verifying' ||
        step === 'success' ||
        step === 'failed'
      ) return;

      if (faces.length === 0) {
        setFaceDetected(false);
        return;
      }

      // Use the largest face if multiple detected
      const face = faces.reduce((biggest, f) =>
        f.bounds.size.width > biggest.bounds.size.width ? f : biggest
      );

      // Reject if more than one face visible (security)
      if (faces.length > 1) {
        setFaceDetected(false);
        return;
      }

      setFaceDetected(true);

      const faceData: FaceData = {
        rollAngle: face.rollAngle ?? 0,
        yawAngle: face.yawAngle ?? 0,
        smilingProbability: face.smilingProbability ?? 0,
        leftEyeOpenProbability: face.leftEyeOpenProbability ?? 1,
        rightEyeOpenProbability: face.rightEyeOpenProbability ?? 1,
        bounds: face.bounds,
      };

      processFaceFrame(faceData);
    },
    [step, processFaceFrame]
  );

  // ─── Capture + verify ──────────────────────────────────────────────────────
  const captureAndVerify = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: false,
        skipProcessing: false, // ensure proper EXIF orientation
      });

      if (!photo) throw new Error('Camera capture failed');

      const width = photo.width ?? SCREEN_WIDTH;
      const height = photo.height ?? CAMERA_HEIGHT;

      const { verified, confidence } = await compareFaces(
        photo.uri,
        profilePhotoUri,
        width,
        height
      );

      const result: FaceVerificationResult = {
        verified,
        confidence,
        livenessScore: liveness.livenessScore,
      };

      // Step update is handled by parent via callback
      onVerified(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Verification failed');
      onError?.(error);
      reset();
      captureTriggered.current = false;
    } finally {
      setIsCapturing(false);
    }
  }, [compareFaces, profilePhotoUri, liveness.livenessScore, onVerified, onError, reset, isCapturing]);

  // ─── Retry handler ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    captureTriggered.current = false;
    reset();
  }, [reset]);

  // ─── Permission gate ───────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f43f5e" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtext}>
          We need camera access to verify your identity
        </Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  const showSpinner = step === 'capturing' || step === 'verifying';
  const showRetry = step === 'failed';
  const showSuccess = step === 'success';

  return (
    <View style={styles.container}>
      {/* Camera preview */}
      <CameraView
        ref={cameraRef}
        style={[styles.camera, { height: CAMERA_HEIGHT }]}
        facing="front"
        pictureSize={Platform.OS !== 'web' ? CAMERA_PICTURE_SIZE : undefined}
        faceDetectorSettings={{
          mode: 'fast',
          detectLandmarks: 'all',
          runClassifications: 'all',
          minDetectionInterval: 80, // ~12 fps for face processing
          tracking: true,
        }}
        onFacesDetected={handleFacesDetected}
      />

      {/* Face oval cutout overlay */}
      <FaceOvalGuide
        width={SCREEN_WIDTH}
        height={CAMERA_HEIGHT}
        step={step}
        faceDetected={faceDetected}
        highContrastMode={highContrastMode}
      />

      {/* Instructions + progress */}
      <InstructionOverlay
        step={step}
        liveness={liveness}
        headTurnPhase={headTurnPhase}
        faceDetected={faceDetected}
        highContrastMode={highContrastMode}
      />

      {/* Processing spinner */}
      {showSpinner && (
        <View style={styles.spinnerOverlay}>
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text style={styles.spinnerText}>
            {step === 'capturing' ? 'Capturing…' : 'Verifying identity…'}
          </Text>
        </View>
      )}

      {/* Success result */}
      {showSuccess && (
        <View style={styles.resultOverlay}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.resultTitle}>Identity Verified</Text>
          <Text style={styles.resultSub}>Liveness score: {liveness.livenessScore}%</Text>
        </View>
      )}

      {/* Failure + retry */}
      {showRetry && (
        <View style={styles.resultOverlay}>
          <Text style={styles.failEmoji}>❌</Text>
          <Text style={styles.resultTitle}>Verification Failed</Text>
          {!antiSpoofResult.passed && antiSpoofResult.reason && (
            <Text style={styles.spoofWarning}>⚠️ {antiSpoofResult.reason}</Text>
          )}
          <Pressable style={styles.btn} onPress={handleRetry}>
            <Text style={styles.btnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom bar — liveness score indicator */}
      <View style={[styles.bottomBar, highContrastMode && styles.bottomBarHighContrast]}>
        <Text style={styles.bottomBarText} accessibilityLabel="liveness score">
          Liveness: {liveness.livenessScore}%
        </Text>
        <View style={styles.scoreBar}>
          <View
            style={[
              styles.scoreBarFill,
              {
                width: `${liveness.livenessScore}%`,
                backgroundColor:
                  liveness.livenessScore >= 66
                    ? '#22c55e'
                    : liveness.livenessScore >= 33
                    ? '#f59e0b'
                    : '#ef4444',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    width: SCREEN_WIDTH,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    backgroundColor: '#f43f5e',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  spinnerText: {
    color: '#fff',
    marginTop: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  failEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  bottomBarHighContrast: {
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  bottomBarText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginBottom: 6,
  },
  scoreBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 4,
    borderRadius: 2,
  },
});
