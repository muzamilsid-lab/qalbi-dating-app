'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EngagementAction } from '../types';

/**
 * Tracks prompt engagement for A/B effectiveness analysis.
 * Fires-and-forgets — never blocks the UI.
 */
export function usePromptAB(viewerId: string) {
  const supabase = createClient();

  const track = useCallback(
    async (promptId: number, authorId: string, action: EngagementAction) => {
      if (!viewerId || viewerId === authorId) return; // don't track self-views

      try {
        await supabase.from('prompt_engagements').insert({
          prompt_id:  promptId,
          viewer_id:  viewerId,
          author_id:  authorId,
          action,
        });
      } catch {
        // silent — analytics must never crash the UI
      }
    },
    [viewerId],
  );

  return { track };
}
