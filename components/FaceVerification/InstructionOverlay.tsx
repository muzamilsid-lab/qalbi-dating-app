import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { HeadTurnPhase, LivenessState, VerificationStep } from './types';

interface Props {
  step: VerificationStep;
  liveness: LivenessState;
  headTurnPhase: HeadTurnPhase;
  faceDetected: boolean;
  highContrastMode?: boolean;
}

interface StepInfo {
  instruction: string;
  subText?: string;
  emoji: string;
}

function getStepInfo(
  step: VerificationStep,
  headTurnPhase: HeadTurnPhase,
  faceDetected: boolean
): StepInfo {
  if (!faceDetected && step !== 'success' && step !== 'failed') {
    return {
      instruction: 'Position your face in the oval',
      subText: 'Make sure your face is well lit',
      emoji: '👤',
    };
  }

  switch (step) {
    case 'idle':
    case 'positioning':
      return {
        instruction: 'Position your face in the oval',
        subText: 'Hold still and look straight ahead',
        emoji: '👤',
      };

    case 'blink':
      return {
        instruction: 'Please blink',
        subText: 'Blink both eyes naturally',
        emoji: '👁',
      };

    case 'headturn':
      if (headTurnPhase === 'left') {
        return {
          instruction: 'Turn your head slowly left',
          subText: 'Then turn right',
          emoji: '←',
        };
      }
      if (headTurnPhase === 'right') {
        return {
          instruction: 'Now turn your head right',
          subText: 'Almost done!',
          emoji: '→',
        };
      }
      return {
        instruction: 'Turn your head left, then right',
        subText: 'Move slowly and steadily',
        emoji: '↔',
      };

    case 'smile':
      return {
        instruction: 'Now smile!',
        subText: 'Show your best smile',
        emoji: '😊',
      };

    case 'capturing':
      return {
        instruction: 'Hold still…',
        subText: 'Taking your photo',
        emoji: '📸',
      };

    case 'verifying':
      return {
        instruction: 'Verifying…',
        subText: 'Comparing with your profile photo',
        emoji: '🔍',
      };

    case 'success':
      return {
        instruction: 'Verified!',
        subText: 'Identity confirmed',
        emoji: '✅',
      };

    case 'failed':
      return {
        instruction: 'Verification failed',
        subText: 'Please try again in good lighting',
        emoji: '❌',
      };
  }
}

function CheckDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        done && styles.dotDone,
        active && styles.dotActive,
      ]}
      accessibilityLabel={done ? 'check complete' : active ? 'in progress' : 'pending'}
    />
  );
}

export function InstructionOverlay({
  step,
  liveness,
  headTurnPhase,
  faceDetected,
  highContrastMode,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastSpokenStep = useRef<string>('');
  const info = getStepInfo(step, headTurnPhase, faceDetected);

  // Fade in instruction on step change
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [step, fadeAnim]);

  // Voice guidance — speak instruction once per unique step change
  useEffect(() => {
    const key = `${step}-${headTurnPhase}`;
    if (key === lastSpokenStep.current) return;
    lastSpokenStep.current = key;

    // Cancel any ongoing speech first
    Speech.stop();

    const delay = setTimeout(() => {
      Speech.speak(info.instruction, {
        language: 'en',
        rate: 0.9,
        pitch: 1.0,
      });
    }, 300);

    return () => clearTimeout(delay);
  }, [step, headTurnPhase, info.instruction]);

  // Also post to accessibility announcements for screen readers
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(info.instruction);
  }, [info.instruction]);

  const isLivenessStep = ['blink', 'headturn', 'smile'].includes(step);
  const textColor = highContrastMode ? '#ffffff' : 'rgba(255,255,255,0.95)';
  const bgColor = highContrastMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)';

  return (
    <>
      {/* Top instruction banner */}
      <Animated.View
        style={[styles.instructionBanner, { backgroundColor: bgColor, opacity: fadeAnim }]}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.emoji]}>{info.emoji}</Text>
        <Text style={[styles.instructionText, { color: textColor }]}>{info.instruction}</Text>
        {info.subText ? (
          <Text style={[styles.subText, { color: highContrastMode ? '#dddddd' : 'rgba(255,255,255,0.7)' }]}>
            {info.subText}
          </Text>
        ) : null}
      </Animated.View>

      {/* Liveness progress dots */}
      {isLivenessStep && (
        <View style={styles.progressRow} accessibilityLabel={`${liveness.passedChecks} of 2 checks completed`}>
          <CheckDot done={liveness.blinkDetected} active={step === 'blink'} />
          <CheckDot done={liveness.headTurnDetected} active={step === 'headturn'} />
          <CheckDot done={liveness.smileDetected} active={step === 'smile'} />
        </View>
      )}

      {/* Low-light warning — shown during positioning */}
      {step === 'positioning' && !faceDetected && (
        <View style={[styles.warningBanner, { backgroundColor: bgColor }]}>
          <Text style={styles.warningText}>💡 Ensure good lighting on your face</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  instructionBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subText: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  progressRow: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    zIndex: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#fbbf24',
  },
  dotDone: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  warningBanner: {
    position: 'absolute',
    bottom: 220,
    left: 30,
    right: 30,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    zIndex: 20,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
