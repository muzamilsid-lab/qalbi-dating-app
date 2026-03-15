'use client';

import { useEffect, useRef, useState } from 'react';
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
  faceDetected: boolean,
): StepInfo {
  if (!faceDetected && step !== 'success' && step !== 'failed') {
    return { instruction: 'Position your face in the oval', subText: 'Make sure your face is well lit', emoji: '👤' };
  }
  switch (step) {
    case 'idle':
    case 'positioning':
      return { instruction: 'Position your face in the oval', subText: 'Hold still and look straight ahead', emoji: '👤' };
    case 'blink':
      return { instruction: 'Please blink', subText: 'Blink both eyes naturally', emoji: '👁' };
    case 'headturn':
      if (headTurnPhase === 'left')  return { instruction: 'Turn your head slowly left', subText: 'Then turn right', emoji: '←' };
      if (headTurnPhase === 'right') return { instruction: 'Now turn your head right', subText: 'Almost done!', emoji: '→' };
      return { instruction: 'Turn your head left, then right', subText: 'Move slowly and steadily', emoji: '↔' };
    case 'smile':
      return { instruction: 'Now smile!', subText: 'Show your best smile', emoji: '😊' };
    case 'capturing':
      return { instruction: 'Hold still…', subText: 'Taking your photo', emoji: '📸' };
    case 'verifying':
      return { instruction: 'Verifying…', subText: 'Comparing with your profile photo', emoji: '🔍' };
    case 'success':
      return { instruction: 'Verified!', subText: 'Identity confirmed', emoji: '✅' };
    case 'failed':
      return { instruction: 'Verification failed', subText: 'Please try again in good lighting', emoji: '❌' };
  }
}

function CheckDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span
      aria-label={done ? 'check complete' : active ? 'in progress' : 'pending'}
      style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        border: `1.5px solid ${done ? '#16a34a' : active ? '#fbbf24' : 'rgba(255,255,255,0.6)'}`,
        background: done ? '#22c55e' : active ? '#f59e0b' : 'rgba(255,255,255,0.25)',
        transition: 'all 0.3s',
      }}
    />
  );
}

export function InstructionOverlay({ step, liveness, headTurnPhase, faceDetected, highContrastMode }: Props) {
  const [visible, setVisible] = useState(true);
  const lastSpokenStep = useRef<string>('');
  const info = getStepInfo(step, headTurnPhase, faceDetected);
  const isLivenessStep = ['blink', 'headturn', 'smile'].includes(step);

  // Fade in on step change
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [step]);

  // Web Speech API voice guidance
  useEffect(() => {
    const key = `${step}-${headTurnPhase}`;
    if (key === lastSpokenStep.current) return;
    lastSpokenStep.current = key;

    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const t = setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(info.instruction);
      utt.lang = 'en';
      utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    }, 300);
    return () => clearTimeout(t);
  }, [step, headTurnPhase, info.instruction]);

  const bgColor = highContrastMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)';
  const textColor = highContrastMode ? '#ffffff' : 'rgba(255,255,255,0.95)';

  return (
    <>
      {/* Top instruction banner */}
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          top: 40,
          left: 20,
          right: 20,
          borderRadius: 14,
          padding: '14px 18px',
          background: bgColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 20,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.35s',
          boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
        }}
      >
        <span style={{ fontSize: 28, marginBottom: 4 }}>{info.emoji}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: textColor, textAlign: 'center', letterSpacing: 0.2 }}>
          {info.instruction}
        </span>
        {info.subText && (
          <span style={{ fontSize: 13, marginTop: 4, color: highContrastMode ? '#dddddd' : 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
            {info.subText}
          </span>
        )}
      </div>

      {/* Liveness progress dots */}
      {isLivenessStep && (
        <div
          aria-label={`${liveness.passedChecks} of 3 checks completed`}
          style={{
            position: 'absolute',
            bottom: 180,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            zIndex: 20,
          }}
        >
          <CheckDot done={liveness.blinkDetected}    active={step === 'blink'}    />
          <CheckDot done={liveness.headTurnDetected} active={step === 'headturn'} />
          <CheckDot done={liveness.smileDetected}    active={step === 'smile'}    />
        </div>
      )}

      {/* Low-light warning */}
      {step === 'positioning' && !faceDetected && (
        <div style={{
          position: 'absolute',
          bottom: 220,
          left: 30,
          right: 30,
          borderRadius: 10,
          padding: '8px 14px',
          background: bgColor,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 20,
        }}>
          <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            💡 Ensure good lighting on your face
          </span>
        </div>
      )}
    </>
  );
}
