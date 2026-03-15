'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState }                from 'react';
import { clsx }                    from 'clsx';
import { usePrompts }              from './hooks/usePrompts';
import { useProfileStrength }      from './hooks/useProfileStrength';
import { PromptReorder }           from './PromptReorder';
import { PromptSelector }          from './PromptSelector';
import { PromptEditor }            from './PromptEditor';
import { ProfileStrengthMeter }    from './ProfileStrengthMeter';
import { Prompt, MAX_PROMPTS }     from './types';

interface ProfileSnapshot {
  photoCount:    number;
  hasBio:        boolean;
  hasOccupation: boolean;
  hasLifestyle:  boolean;
}

interface Props {
  userId:          string;
  profileSnapshot: ProfileSnapshot;
  onDone?:         () => void;
}

type Screen =
  | { view: 'list' }
  | { view: 'selector'; slot: 0 | 1 | 2 }
  | { view: 'editor';   slot: 0 | 1 | 2; prompt: Prompt };

export function PromptManager({ userId, profileSnapshot, onDone }: Props) {
  const {
    catalogue, drafts, loading, saving, error,
    setDraft, reorder, saveAll, deletePrompt, isDirty,
  } = usePrompts(userId);

  const [screen, setScreen] = useState<Screen>({ view: 'list' });
  const [localAnswer, setLocalAnswer] = useState('');

  const strength = useProfileStrength({
    ...profileSnapshot,
    drafts,
  });

  const usedIds = new Set(
    drafts.filter(d => d.promptId !== null).map(d => d.promptId as number)
  );

  // ── Navigation helpers ──────────────────────────────────────────────────

  function openSelector(slot: 0 | 1 | 2) {
    setScreen({ view: 'selector', slot });
  }

  function openEditor(slot: 0 | 1 | 2) {
    const draft = drafts[slot];
    const prompt = draft.promptId != null
      ? catalogue.find(p => p.id === draft.promptId)
      : undefined;
    if (!prompt) { openSelector(slot); return; }
    setLocalAnswer(draft.answer);
    setScreen({ view: 'editor', slot, prompt });
  }

  function handleSelectPrompt(prompt: Prompt) {
    if (screen.view !== 'selector') return;
    const slot = screen.slot;
    setLocalAnswer(drafts[slot].answer); // keep previous answer if same prompt
    setScreen({ view: 'editor', slot, prompt });
  }

  function handleSaveEditor() {
    if (screen.view !== 'editor') return;
    setDraft(screen.slot, screen.prompt.id, localAnswer);
    setScreen({ view: 'list' });
  }

  async function handleSaveAll() {
    await saveAll();
    onDone?.();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const filledCount = drafts.filter(d => d.promptId !== null && d.answer.trim().length > 0).length;

  return (
    <div className="flex flex-col gap-4 pb-safe-bottom">
      {/* Strength meter */}
      <ProfileStrengthMeter strength={strength} />

      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[var(--color-text-primary)] font-bold text-base">
            Your Prompts
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            {filledCount}/{MAX_PROMPTS} answered · drag to reorder
          </p>
        </div>

        {isDirty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleSaveAll}
            disabled={saving}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-bold text-white',
              'bg-gradient-to-r from-rose-500 to-pink-500',
              'disabled:opacity-50',
            )}
            whileTap={{ scale: 0.96 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </motion.button>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reorder list */}
      <PromptReorder
        drafts={drafts}
        catalogue={catalogue}
        onReorder={reorder}
        onEdit={openEditor}
        onDelete={deletePrompt}
        onAdd={openSelector}
      />

      {/* Overlays */}
      <AnimatePresence>
        {screen.view === 'selector' && (
          <PromptSelector
            key="selector"
            catalogue={catalogue}
            usedIds={usedIds}
            onSelect={handleSelectPrompt}
            onClose={() => setScreen({ view: 'list' })}
          />
        )}

        {screen.view === 'editor' && (
          <PromptEditor
            key="editor"
            prompt={screen.prompt}
            answer={localAnswer}
            onChange={setLocalAnswer}
            onClose={() => setScreen({ view: 'list' })}
            onSave={handleSaveEditor}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
