'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LandingPage } from '@/components/LandingPage';
import { AuthModal } from '@/components/AuthModal';
import { ProfileSetup } from '@/components/ProfileSetup';
import { DiscoveryFeed } from '@/components/DiscoveryFeed';
import { MatchList } from '@/components/MatchList';
import { ChatView } from '@/components/ChatView';
import { User } from '@supabase/supabase-js';

type View = 'discover' | 'matches' | 'chat';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('discover');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          setShowAuth(false);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    setProfile(data);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCurrentView('discover');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center">
        <div className="animate-pulse text-rose-500 text-xl">Loading...</div>
      </div>
    );
  }

  // Not logged in - show landing or auth
  if (!user) {
    if (showAuth) {
      return <AuthModal />;
    }
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  // Logged in but no profile
  if (!profile) {
    return <ProfileSetup userId={user.id} onComplete={fetchProfile} />;
  }

  // Main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            💕 Qalbi
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{profile.display_name}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-rose-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto">
        {currentView === 'discover' && (
          <DiscoveryFeed userId={user.id} userProfile={profile} />
        )}
        {currentView === 'matches' && !selectedMatch && (
          <MatchList 
            userId={user.id} 
            onSelectMatch={(matchId) => {
              setSelectedMatch(matchId);
              setCurrentView('chat');
            }} 
          />
        )}
        {currentView === 'chat' && selectedMatch && (
          <ChatView 
            userId={user.id}
            matchId={selectedMatch}
            onBack={() => {
              setSelectedMatch(null);
              setCurrentView('matches');
            }}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => { setCurrentView('discover'); setSelectedMatch(null); }}
            className={`flex-1 py-4 text-center ${
              currentView === 'discover' 
                ? 'text-rose-500 font-semibold' 
                : 'text-gray-500'
            }`}
          >
            <span className="text-2xl">🔥</span>
            <span className="block text-xs mt-1">Discover</span>
          </button>
          <button
            onClick={() => { setCurrentView('matches'); setSelectedMatch(null); }}
            className={`flex-1 py-4 text-center ${
              currentView === 'matches' || currentView === 'chat'
                ? 'text-rose-500 font-semibold' 
                : 'text-gray-500'
            }`}
          >
            <span className="text-2xl">💬</span>
            <span className="block text-xs mt-1">Matches</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
