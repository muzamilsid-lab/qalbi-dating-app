'use client';

import { useEffect, useRef } from 'react';
import { VerificationStep } from './types';

interface Props {
  width: number;
  height: number;
  step: VerificationStep;
  faceDetected: boolean;
  highContrastMode?: boolean;
}

export function FaceOvalGuide({ width, height, step, faceDetected, highContrastMode }: Props) {
  const cx = width / 2;
  const cy = height * 0.45;
  const rx = width * 0.38;
  const ry = height * 0.46;

  const pulseRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    if (!pulseRef.current) return;
    pulseRef.current.style.animation =
      !faceDetected && step === 'positioning'
        ? 'face-oval-pulse 1.8s ease-in-out infinite'
        : 'none';
  }, [faceDetected, step]);

  const strokeColor =
    step === 'success' ? '#22c55e' :
    step === 'failed'  ? '#ef4444' :
    faceDetected       ? '#ffffff' :
    highContrastMode   ? '#cccccc' : '#999999';

  const glowColor =
    step === 'success' ? 'rgba(34,197,94,0.3)' :
    step === 'failed'  ? 'rgba(239,68,68,0.3)' :
    'rgba(255,255,255,0.12)';

  return (
    <>
      <style>{`
        @keyframes face-oval-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.03); opacity: 1;   }
        }
      `}</style>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <mask id="face-oval-mask">
            <rect width={width} height={height} fill="white" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
          </mask>
        </defs>

        {/* Dark overlay with oval cutout */}
        <rect
          width={width}
          height={height}
          fill="rgba(0,0,0,0.45)"
          mask="url(#face-oval-mask)"
        />

        {/* Inner glow ring */}
        <ellipse
          cx={cx} cy={cy}
          rx={rx - 3} ry={ry - 3}
          fill="none"
          stroke={glowColor}
          strokeWidth={10}
        />

        {/* Main oval border (pulse-animated when no face) */}
        <ellipse
          ref={pulseRef}
          cx={cx} cy={cy}
          rx={rx + 2} ry={ry + 2}
          fill="none"
          stroke={strokeColor}
          strokeWidth={highContrastMode ? 4 : 2.5}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      </svg>
    </>
  );
}
