'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Prompt, ProfilePrompt, PromptDraft, MAX_PROMPTS } from '../types';

interface UsePromptsReturn {
  catalogue:    Prompt[];
  userPrompts:  ProfilePrompt[];
  drafts:       PromptDraft[];
  loading:      boolean;
  saving:       boolean;
  error:        string | null;
  setDraft:     (index: 0 | 1 | 2, promptId: number | null, answer: string) => void;
  reorder:      (from: 0 | 1 | 2, to: 0 | 1 | 2) => void;
  saveAll:      () => Promise<void>;
  deletePrompt: (index: 0 | 1 | 2) => void;
  isDirty:      boolean;
}

function emptyDrafts(): PromptDraft[] {
  return [
    { promptId: null, answer: '', orderIndex: 0 },
    { promptId: null, answer: '', orderIndex: 1 },
    { promptId: null, answer: '', orderIndex: 2 },
  ];
}

export function usePrompts(userId: string): UsePromptsReturn {
  const supabase = createClient();

  const [catalogue,   setCatalogue]   = useState<Prompt[]>([]);
  const [userPrompts, setUserPrompts] = useState<ProfilePrompt[]>([]);
  const [drafts,      setDrafts]      = useState<PromptDraft[]>(emptyDrafts());
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [isDirty,     setIsDirty]     = useState(false);

  // ── Load catalogue + user answers on mount ──────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [catRes, userRes] = await Promise.all([
        supabase.from('prompts').select('*').eq('is_active', true).order('category'),
        supabase
          .from('profile_prompts')
          .select('*, prompt:prompts(*)')
          .eq('user_id', userId)
          .order('order_index'),
      ]);

      if (cancelled) return;

      if (catRes.error)  { setError(catRes.error.message);  setLoading(false); return; }
      if (userRes.error) { setError(userRes.error.message); setLoading(false); return; }

      const cat: Prompt[] = (catRes.data ?? []).map(mapPrompt);
      setCatalogue(cat);

      const up: ProfilePrompt[] = (userRes.data ?? []).map(mapProfilePrompt);
      setUserPrompts(up);

      // Initialise drafts from saved answers
      const d = emptyDrafts();
      for (const p of up) {
        d[p.orderIndex] = {
          promptId:   p.promptId,
          answer:     p.answer,
          orderIndex: p.orderIndex,
        };
      }
      setDrafts(d);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Draft mutations ──────────────────────────────────────────────────────

  const setDraft = useCallback(
    (index: 0 | 1 | 2, promptId: number | null, answer: string) => {
      setDrafts(prev => {
        const next = [...prev] as PromptDraft[];
        next[index] = { promptId, answer, orderIndex: index };
        return next;
      });
      setIsDirty(true);
    },
    [],
  );

  const deletePrompt = useCallback((index: 0 | 1 | 2) => {
    setDrafts(prev => {
      const next = [...prev] as PromptDraft[];
      next[index] = { promptId: null, answer: '', orderIndex: index };
      return next;
    });
    setIsDirty(true);
  }, []);

  const reorder = useCallback((from: 0 | 1 | 2, to: 0 | 1 | 2) => {
    if (from === to) return;
    setDrafts(prev => {
      const next = [...prev] as PromptDraft[];
      const moved = next[from];
      next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((d, i) => ({ ...d, orderIndex: i as 0 | 1 | 2 }));
    });
    setIsDirty(true);
  }, []);

  // ── Persist drafts → Supabase ───────────────────────────────────────────

  const saveAll = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const filled = drafts.filter(d => d.promptId !== null && d.answer.trim().length > 0);

      if (filled.length === 0) {
        // Delete all
        await supabase.from('profile_prompts').delete().eq('user_id', userId);
        setUserPrompts([]);
        setIsDirty(false);
        return;
      }

      // Upsert filled slots, delete removed ones
      const upsertRows = filled.map(d => ({
        user_id:     userId,
        prompt_id:   d.promptId,
        answer:      d.answer.trim().slice(0, 250),
        order_index: d.orderIndex,
      }));

      const { error: upsertErr } = await supabase
        .from('profile_prompts')
        .upsert(upsertRows, { onConflict: 'user_id,order_index' });

      if (upsertErr) throw upsertErr;

      // Delete slots that are now empty
      const usedOrders = filled.map(d => d.orderIndex);
      const emptyOrders = ([0, 1, 2] as const).filter(i => !usedOrders.includes(i));
      if (emptyOrders.length > 0) {
        await supabase
          .from('profile_prompts')
          .delete()
          .eq('user_id', userId)
          .in('order_index', emptyOrders);
      }

      // Reload
      const { data } = await supabase
        .from('profile_prompts')
        .select('*, prompt:prompts(*)')
        .eq('user_id', userId)
        .order('order_index');

      setUserPrompts((data ?? []).map(mapProfilePrompt));
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [drafts, userId]);

  return {
    catalogue, userPrompts, drafts, loading, saving, error,
    setDraft, reorder, saveAll, deletePrompt, isDirty,
  };
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapPrompt(row: any): Prompt {
  return {
    id:        row.id,
    category:  row.category,
    text:      row.text,
    abVariant: row.ab_variant,
  };
}

function mapProfilePrompt(row: any): ProfilePrompt {
  return {
    id:         row.id,
    userId:     row.user_id,
    promptId:   row.prompt_id,
    prompt:     mapPrompt(row.prompt),
    answer:     row.answer,
    orderIndex: row.order_index as 0 | 1 | 2,
  };
}
