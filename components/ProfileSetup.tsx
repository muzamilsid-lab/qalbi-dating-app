'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ProfileSetupProps {
  userId: string;
  onComplete: (userId: string) => void;
}

const NATIONALITIES = [
  'Emirati', 'Saudi', 'Qatari', 'Kuwaiti', 'Bahraini', 'Omani',
  'Egyptian', 'Lebanese', 'Jordanian', 'Syrian', 'Palestinian',
  'Indian', 'Pakistani', 'Filipino', 'British', 'American', 'Other'
];

const CITIES = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Jeddah', 'Doha',
  'Kuwait City', 'Manama', 'Muscat', 'Other'
];

export function ProfileSetup({ userId, onComplete }: ProfileSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    display_name: '',
    birth_date: '',
    gender: '',
    looking_for: '',
    nationality: '',
    city: '',
    bio: '',
    photo_url: '',
  });

  const supabase = createClient();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file);

    if (!uploadError) {
      const { data } = supabase.storage.from('photos').getPublicUrl(fileName);
      setProfile({ ...profile, photo_url: data.publicUrl });
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      ...profile,
      birth_date: profile.birth_date || null,
    });

    if (!error) {
      onComplete(userId);
    }
    setLoading(false);
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                s <= step ? 'bg-rose-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">Welcome! 👋</h2>
                <p className="text-gray-500 mt-2">Let's set up your profile</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="How should we call you?"
                  className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birthday
                </label>
                <input
                  type="date"
                  value={profile.birth_date}
                  onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-rose-400"
                />
                {profile.birth_date && (
                  <p className="text-sm text-gray-500 mt-1">
                    You're {calculateAge(profile.birth_date)} years old
                  </p>
                )}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!profile.display_name || !profile.birth_date}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Gender & Preferences */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">About You</h2>
                <p className="text-gray-500 mt-2">Tell us a bit more</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  I am a...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['Man', 'Woman'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setProfile({ ...profile, gender: g.toLowerCase() })}
                      className={`py-4 rounded-xl font-medium transition-all ${
                        profile.gender === g.toLowerCase()
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {g === 'Man' ? '👨' : '👩'} {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Looking for...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['Men', 'Women'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setProfile({ ...profile, looking_for: g.toLowerCase() })}
                      className={`py-4 rounded-xl font-medium transition-all ${
                        profile.looking_for === g.toLowerCase()
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border-2 border-gray-200 rounded-xl py-3 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!profile.gender || !profile.looking_for}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Location & Nationality */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">Where are you? 🌍</h2>
                <p className="text-gray-500 mt-2">Help us find matches near you</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <select
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-rose-400"
                >
                  <option value="">Select your city</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nationality
                </label>
                <select
                  value={profile.nationality}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-rose-400"
                >
                  <option value="">Select nationality</option>
                  {NATIONALITIES.map((nat) => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border-2 border-gray-200 rounded-xl py-3 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!profile.city || !profile.nationality}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Photo & Bio */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">Final touches ✨</h2>
                <p className="text-gray-500 mt-2">Add a photo and bio</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative">
                  {profile.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-rose-200"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center text-4xl">
                      📷
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-rose-500 text-white p-2 rounded-full cursor-pointer hover:bg-rose-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {loading ? 'Uploading...' : 'Tap to add photo'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  About me
                </label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Write a few words about yourself..."
                  rows={4}
                  maxLength={300}
                  className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-rose-400 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">{profile.bio.length}/300</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 border-2 border-gray-200 rounded-xl py-3 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !profile.photo_url}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Start Matching! 🚀'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
