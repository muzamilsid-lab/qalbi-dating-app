// ─── Prompt catalogue entry ───────────────────────────────────────────────────

export type PromptCategory =
  | 'about_me'
  | 'lifestyle'
  | 'dating'
  | 'humor'
  | 'culture'
  | 'values';

export const CATEGORY_META: Record<PromptCategory, { label: string; icon: string; color: string }> = {
  about_me:  { label: 'About Me',  icon: '✨', color: 'from-violet-500  to-purple-500'  },
  lifestyle: { label: 'Lifestyle', icon: '🌿', color: 'from-emerald-500 to-teal-500'    },
  dating:    { label: 'Dating',    icon: '💕', color: 'from-rose-500    to-pink-500'    },
  humor:     { label: 'Humor',     icon: '😄', color: 'from-amber-500   to-orange-500'  },
  culture:   { label: 'Culture',   icon: '🌙', color: 'from-sky-500     to-blue-500'    },
  values:    { label: 'Values',    icon: '🌟', color: 'from-indigo-500  to-violet-500'  },
};

export interface Prompt {
  id: number;
  category: PromptCategory;
  text: string;
  abVariant?: 'a' | 'b' | null;
}

// ─── User's saved prompt answer ───────────────────────────────────────────────

export interface ProfilePrompt {
  id: string;
  userId: string;
  promptId: number;
  prompt: Prompt;
  answer: string;
  orderIndex: 0 | 1 | 2;
}

// ─── Draft state used during editing ──────────────────────────────────────────

export interface PromptDraft {
  /** null = empty slot */
  promptId: number | null;
  answer: string;
  orderIndex: 0 | 1 | 2;
}

// ─── Profile strength ─────────────────────────────────────────────────────────

export interface ProfileStrength {
  score: number;         // 0–100
  level: 'starter' | 'growing' | 'strong' | 'complete';
  factors: StrengthFactor[];
  nextSuggestion: string | null;
}

export interface StrengthFactor {
  key: string;
  label: string;
  done: boolean;
  points: number;
}

// ─── Engagement event (A/B tracking) ─────────────────────────────────────────

export type EngagementAction = 'view' | 'like' | 'reply' | 'swipe_right_after';

export const MAX_ANSWER_LENGTH = 250;
export const MAX_PROMPTS       = 3;
