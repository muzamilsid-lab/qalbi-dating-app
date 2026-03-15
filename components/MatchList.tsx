'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Match {
  id: string;
  matched_at: string;
  other_user: {
    id: string;
    display_name: string;
    photo_url: string;
  };
  last_message?: {
    content: string;
    sent_at: string;
  };
}

interface MatchListProps {
  userId: string;
  onSelectMatch: (matchId: string) => void;
}

export function MatchList({ userId, onSelectMatch }: MatchListProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    fetchMatches();
    
    // Subscribe to new matches
    const channel = supabase
      .channel('matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user_a_id=eq.${userId}`,
        },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user_b_id=eq.${userId}`,
        },
        () => fetchMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchMatches = async () => {
    // Get all matches where user is either user_a or user_b
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('matched_at', { ascending: false });

    if (!matchesData) {
      setLoading(false);
      return;
    }

    // Get other user profiles
    const otherUserIds = matchesData.map(m => 
      m.user_a_id === userId ? m.user_b_id : m.user_a_id
    );

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, photo_url')
      .in('id', otherUserIds);

    // Get last messages for each match
    const { data: messages } = await supabase
      .from('messages')
      .select('match_id, content, sent_at')
      .in('match_id', matchesData.map(m => m.id))
      .order('sent_at', { ascending: false });

    // Combine data
    const enrichedMatches = matchesData.map(match => {
      const otherUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
      const otherUser = profiles?.find(p => p.id === otherUserId);
      const lastMessage = messages?.find(m => m.match_id === match.id);

      return {
        id: match.id,
        matched_at: match.matched_at,
        other_user: otherUser || { id: otherUserId, display_name: 'Unknown', photo_url: '' },
        last_message: lastMessage,
      };
    });

    setMatches(enrichedMatches);
    setLoading(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-pulse text-rose-500">Loading matches...</div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center">
        <div className="text-6xl mb-4">💬</div>
        <h2 className="text-xl font-semibold text-gray-800">No matches yet</h2>
        <p className="text-gray-500 mt-2">
          Keep swiping to find your perfect match!
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Your Matches ({matches.length})
      </h2>
      
      <div className="space-y-3">
        {matches.map((match) => (
          <button
            key={match.id}
            onClick={() => onSelectMatch(match.id)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 text-left"
          >
            <img
              src={match.other_user.photo_url || '/placeholder.jpg'}
              alt={match.other_user.display_name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 truncate">
                  {match.other_user.display_name}
                </h3>
                <span className="text-xs text-gray-400">
                  {match.last_message 
                    ? formatTime(match.last_message.sent_at)
                    : formatTime(match.matched_at)
                  }
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate mt-1">
                {match.last_message 
                  ? match.last_message.content
                  : '💕 New match! Say hi...'
                }
              </p>
            </div>
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
