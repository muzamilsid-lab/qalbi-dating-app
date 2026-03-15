'use client';

import { useCallback, useState } from 'react';

interface UseBlockReturn {
  blocking:   boolean;
  unmatching: boolean;
  block:      (userId: string) => Promise<void>;
  unblock:    (userId: string) => Promise<void>;
  unmatch:    (conversationId: string) => Promise<void>;
}

export function useBlock(): UseBlockReturn {
  const [blocking,   setBlocking]   = useState(false);
  const [unmatching, setUnmatching] = useState(false);

  const block = useCallback(async (userId: string) => {
    setBlocking(true);
    await fetch('/api/block', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blockedUserId: userId }),
    });
    setBlocking(false);
  }, []);

  const unblock = useCallback(async (userId: string) => {
    setBlocking(true);
    await fetch('/api/block', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blockedUserId: userId }),
    });
    setBlocking(false);
  }, []);

  const unmatch = useCallback(async (conversationId: string) => {
    setUnmatching(true);
    await fetch('/api/unmatch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conversationId }),
    });
    setUnmatching(false);
  }, []);

  return { blocking, unmatching, block, unblock, unmatch };
}
