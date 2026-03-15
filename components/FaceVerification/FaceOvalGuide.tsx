import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { VerificationStep } from './types';

interface Props {
  width: number;
  height: number;
  step: VerificationStep;
  faceDetected: boolean;
  highContrastMode?: boolean;
}

// Oval covers roughly the upper 70% of the frame (portrait face framing)
const OVAL_RX_FRACTION = 0.38;
const OVAL_RY_FRACTION = 0.46;

export function FaceOvalGuide({ width, height, step, faceDetected, highContrastMode }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  const cx = width / 2;
  const cy = height * 0.45; // slightly above center for portrait framing
  const rx = width * OVAL_RX_FRACTION;
  const ry = height * OVAL_RY_FRACTION;

  // Pulse when no face detected
  useEffect(() => {
    if (!faceDetected && step === 'positioning') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [faceDetected, step, pulseAnim]);

  // Color shifts: grey → white (face in oval) → green (success) → red (failed)
  useEffect(() => {
    const target =
      step === 'success' ? 2 :
      step === 'failed' ? 3 :
      faceDetected ? 1 : 0;

    Animated.timing(colorAnim, {
      toValue: target,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step, faceDetected, colorAnim]);

  const ovalColor = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      'rgba(180,180,180,0.7)',
      highContrastMode ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)',
      'rgba(34,197,94,0.95)',
      'rgba(239,68,68,0.95)',
    ],
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Svg width={width} height={height}>
          <Defs>
            <Mask id="oval-mask">
              {/* White = visible, Black = masked out */}
              <Rect width={width} height={height} fill="white" />
              <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
            </Mask>
          </Defs>

          {/* Dark overlay outside the oval */}
          <Rect
            width={width}
            height={height}
            fill="rgba(0,0,0,0.45)"
            mask="url(#oval-mask)"
          />
        </Svg>
      </Animated.View>

      {/* Oval border as a separate animated element */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.ovalBorderContainer,
        ]}
        pointerEvents="none"
      >
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Animated.View>
            {/* react-native-svg doesn't support Animated.Value on stroke directly,
                so we render multiple ellipses at fixed opacity for the glow effect */}
            <Ellipse
              cx={cx}
              cy={cy}
              rx={rx + 2}
              ry={ry + 2}
              fill="none"
              stroke={step === 'success' ? '#22c55e' : step === 'failed' ? '#ef4444' : faceDetected ? '#ffffff' : '#999999'}
              strokeWidth={highContrastMode ? 4 : 2.5}
            />
            {/* Inner glow ring */}
            <Ellipse
              cx={cx}
              cy={cy}
              rx={rx - 3}
              ry={ry - 3}
              fill="none"
              stroke={step === 'success' ? 'rgba(34,197,94,0.3)' : step === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)'}
              strokeWidth={8}
            />
          </Animated.View>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  ovalBorderContainer: {
    zIndex: 11,
  },
});
