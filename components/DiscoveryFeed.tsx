'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  display_name: string;
  birth_date: string;
  gender: string;
  nationality: string;
  city: string;
  bio: string;
  photo_url: string;
  looking_for?: string;
}

interface DiscoveryFeedProps {
  userId: string;
  userProfile: Profile;
}

export function DiscoveryFeed({ userId, userProfile }: DiscoveryFeedProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchAnimation, setMatchAnimation] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    // Get profiles we haven't swiped on yet
    const { data: swipedIds } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', userId);

    const excludeIds = [userId, ...(swipedIds?.map(s => s.swiped_id) || [])];

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('gender', userProfile.looking_for === 'men' ? 'man' : 'woman')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(20);

    setProfiles(data || []);
    setLoading(false);
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSwipe = async (direction: 'like' | 'pass') => {
    const profile = profiles[currentIndex];
    if (!profile) return;

    // Animate
    setSwipeDirection(direction === 'like' ? 'right' : 'left');

    // Record swipe
    await supabase.from('swipes').insert({
      swiper_id: userId,
      swiped_id: profile.id,
      direction,
    });

    // Check for match if liked
    if (direction === 'like') {
      const { data: mutualLike } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', profile.id)
        .eq('swiped_id', userId)
        .eq('direction', 'like')
        .single();

      if (mutualLike) {
        // Create match!
        await supabase.from('matches').insert({
          user_a_id: userId < profile.id ? userId : profile.id,
          user_b_id: userId < profile.id ? profile.id : userId,
        });
        setMatchAnimation(profile.display_name);
        setTimeout(() => setMatchAnimation(null), 2500);
      }
    }

    // Move to next card
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-pulse text-rose-500">Finding people near you...</div>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-800">No more profiles</h2>
        <p className="text-gray-500 mt-2">
          Check back later for new people in your area!
        </p>
        <button
          onClick={() => {
            setCurrentIndex(0);
            setLoading(true);
            fetchProfiles();
          }}
          className="mt-6 bg-rose-500 text-white px-6 py-3 rounded-xl font-medium"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Match Animation Overlay */}
      {matchAnimation && (
        <div className="fixed inset-0 bg-gradient-to-br from-rose-500 to-pink-500 z-50 flex items-center justify-center">
          <div className="text-center text-white animate-bounce">
            <div className="text-6xl mb-4">💕</div>
            <h2 className="text-3xl font-bold">It's a Match!</h2>
            <p className="mt-2 text-lg opacity-90">
              You and {matchAnimation} liked each other
            </p>
          </div>
        </div>
      )}

      {/* Card */}
      <div 
        className={`relative bg-white rounded-3xl shadow-xl overflow-hidden transition-transform duration-300 ${
          swipeDirection === 'left' ? '-translate-x-full rotate-[-20deg] opacity-0' :
          swipeDirection === 'right' ? 'translate-x-full rotate-[20deg] opacity-0' : ''
        }`}
      >
        {/* Photo */}
        <div className="relative aspect-[3/4]">
          <img
            src={currentProfile.photo_url || '/placeholder.jpg'}
            alt={currentProfile.display_name}
            className="w-full h-full object-cover"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-end gap-2">
              <h2 className="text-3xl font-bold">{currentProfile.display_name}</h2>
              <span className="text-2xl opacity-90">
                {calculateAge(currentProfile.birth_date)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm opacity-90">
              <span>📍 {currentProfile.city}</span>
              <span>•</span>
              <span>🌍 {currentProfile.nationality}</span>
            </div>
            {currentProfile.bio && (
              <p className="mt-3 text-sm opacity-80 line-clamp-3">
                {currentProfile.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mt-6">
        <button
          onClick={() => handleSwipe('pass')}
          className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform active:scale-95 border-2 border-gray-100"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe('like')}
          className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center text-3xl hover:scale-110 transition-transform active:scale-95"
        >
          ❤️
        </button>
      </div>

      {/* Cards remaining */}
      <p className="text-center text-sm text-gray-400 mt-4">
        {profiles.length - currentIndex - 1} more profiles to discover
      </p>
    </div>
  );
}
