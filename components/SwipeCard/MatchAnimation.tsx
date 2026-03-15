'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/design-system/components/Button';

// ─── Heart particle ───────────────────────────────────────────────────────────

const HEART_COUNT = 18;
const HEART_EMOJIS = ['❤️', '💕', '💖', '💗', '💝', '✨'];

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  emoji: string;
  angle: number;
  distance: number;
  delay: number;
}

function makeParticles(): HeartParticle[] {
  return Array.from({ length: HEART_COUNT }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 50 + (Math.random() - 0.5) * 20,
    size: 16 + Math.random() * 24,
    emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
    angle: (i / HEART_COUNT) * 360 + (Math.random() - 0.5) * 30,
    distance: 120 + Math.random() * 100,
    delay: Math.random() * 0.2,
  }));
}

interface MatchAnimationProps {
  visible: boolean;
  profileName: string;
  profilePhoto?: string;
  currentUserPhoto?: string;
  onKeepSwiping: () => void;
  onMessage: () => void;
}

export function MatchAnimation({
  visible,
  profileName,
  profilePhoto,
  currentUserPhoto,
  onKeepSwiping,
  onMessage,
}: MatchAnimationProps) {
  const [particles] = useState<HeartParticle[]>(makeParticles);
  const [phase, setPhase] = useState<'cards' | 'burst' | 'reveal'>('cards');

  useEffect(() => {
    if (!visible) {
      setPhase('cards');
      return;
    }
    // Cards fly → burst after 600ms → reveal text after 900ms
    const t1 = setTimeout(() => setPhase('burst'), 600);
    const t2 = setTimeout(() => setPhase('reveal'), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
          aria-label={`It's a match with ${profileName}!`}
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600 via-pink-600 to-violet-700" />

          {/* Particle burst */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map(p => (
              <motion.span
                key={p.id}
                className="absolute text-2xl"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  fontSize: p.size,
                  originX: '50%',
                  originY: '50%',
                }}
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={
                  phase === 'burst' || phase === 'reveal'
                    ? {
                        opacity: [0, 1, 1, 0],
                        scale: [0, 1.2, 0.9, 0.5],
                        x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                        y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
                        transition: {
                          duration: 1.2,
                          delay: p.delay,
                          ease: [0, 0.8, 0.6, 1],
                        },
                      }
                    : { opacity: 0 }
                }
                aria-hidden="true"
              >
                {p.emoji}
              </motion.span>
            ))}
          </div>

          {/* Photo pair → merge animation */}
          <div className="relative z-10 flex items-center justify-center mb-8">
            {/* Current user photo */}
            <motion.div
              className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-rose-300"
              initial={{ x: -80, opacity: 0, scale: 0.7 }}
              animate={
                phase === 'cards'
                  ? { x: -80, opacity: 1, scale: 1 }
                  : { x: -16, opacity: 1, scale: 1.05 }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
            >
              {currentUserPhoto ? (
                <img src={currentUserPhoto} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">😊</div>
              )}
            </motion.div>

            {/* Heart merge icon */}
            <motion.div
              className="absolute z-10"
              initial={{ scale: 0 }}
              animate={phase === 'burst' || phase === 'reveal' ? { scale: 1 } : { scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.05 }}
            >
              <span className="text-5xl filter drop-shadow-lg">❤️</span>
            </motion.div>

            {/* Match photo */}
            <motion.div
              className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-pink-300"
              initial={{ x: 80, opacity: 0, scale: 0.7 }}
              animate={
                phase === 'cards'
                  ? { x: 80, opacity: 1, scale: 1 }
                  : { x: 16, opacity: 1, scale: 1.05 }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt={profileName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">😊</div>
              )}
            </motion.div>
          </div>

          {/* Text + CTA */}
          <AnimatePresence>
            {phase === 'reveal' && (
              <motion.div
                className="relative z-10 text-center px-8"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <p className="text-white/80 text-base font-medium mb-1 tracking-wide uppercase">
                  It's a Match!
                </p>
                <h2 className="text-white text-4xl font-black mb-2">
                  You & {profileName}
                </h2>
                <p className="text-white/70 text-sm mb-8">
                  You both liked each other 💕
                </p>

                <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                  <Button
                    variant="gradient"
                    size="lg"
                    fullWidth
                    onClick={onMessage}
                    hapticFeedback="success"
                  >
                    💬 Send a Message
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    onClick={onKeepSwiping}
                    className="text-white/80 hover:text-white hover:bg-white/10"
                    hapticFeedback={false}
                  >
                    Keep Swiping
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
