'use client';

import { useState } from 'react';

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Floating Hearts Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-white/10 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                fontSize: `${Math.random() * 40 + 20}px`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            >
              💕
            </div>
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-16">
            <div className="text-white text-2xl font-bold">💕 Qalbi</div>
            <button
              onClick={onGetStarted}
              className="bg-white text-rose-500 px-6 py-2 rounded-full font-semibold hover:bg-rose-50 transition-colors"
            >
              Sign In
            </button>
          </nav>

          {/* Hero Content */}
          <div className="text-center text-white">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6 leading-tight">
              Find Your Perfect Match<br />
              <span className="text-rose-200">in the Gulf</span>
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
              The dating app made for GCC. Connect with singles in Dubai, Riyadh, Doha, Kuwait City, and beyond.
            </p>
            
            <button
              onClick={onGetStarted}
              className="bg-white text-rose-500 px-8 py-4 rounded-full text-lg font-bold hover:bg-rose-50 hover:scale-105 transition-all shadow-lg"
            >
              Start Matching Free →
            </button>

            <p className="mt-4 text-white/70 text-sm">
              No credit card required • 100% free to start
            </p>
          </div>

          {/* App Preview */}
          <div className="mt-16 flex justify-center">
            <div className="relative">
              {/* Phone Frame */}
              <div className="w-64 h-[500px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-rose-50 to-pink-100 rounded-[2.5rem] overflow-hidden">
                  {/* Mock Profile Card */}
                  <div className="h-full flex flex-col">
                    <div className="flex-1 bg-gradient-to-br from-rose-300 to-pink-400 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-6xl">
                        👩
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <div className="text-white">
                          <span className="text-xl font-bold">Sara</span>
                          <span className="text-lg ml-2">26</span>
                        </div>
                        <div className="text-white/80 text-sm">📍 Dubai</div>
                      </div>
                    </div>
                    <div className="p-4 flex justify-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-full shadow flex items-center justify-center text-xl">
                        ✕
                      </div>
                      <div className="w-14 h-14 bg-rose-500 rounded-full shadow flex items-center justify-center text-2xl">
                        ❤️
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative Elements */}
              <div className="absolute -right-8 top-20 bg-white rounded-2xl p-3 shadow-lg animate-bounce">
                💬 New Match!
              </div>
              <div className="absolute -left-8 bottom-32 bg-white rounded-2xl p-3 shadow-lg">
                ❤️ 12 Likes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Why Qalbi?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-5xl mb-4">🌍</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Made for GCC
              </h3>
              <p className="text-gray-600">
                Designed for the Gulf region. Find locals and expats in UAE, Saudi, Qatar, Kuwait, Bahrain & Oman.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Privacy First
              </h3>
              <p className="text-gray-600">
                Your data stays private. Control who sees your profile and photos. Discreet notifications.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Real Connections
              </h3>
              <p className="text-gray-600">
                Verified profiles, instant chat, and smart matching to help you find genuine connections.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-rose-500">10K+</div>
              <div className="text-gray-600 mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-rose-500">5K+</div>
              <div className="text-gray-600 mt-1">Matches Made</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-rose-500">6</div>
              <div className="text-gray-600 mt-1">GCC Countries</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cities Section */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-8">
            Find Singles Near You
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['Dubai', 'Abu Dhabi', 'Riyadh', 'Jeddah', 'Doha', 'Kuwait City', 'Manama', 'Muscat'].map((city) => (
              <span
                key={city}
                className="bg-rose-50 text-rose-600 px-4 py-2 rounded-full font-medium"
              >
                📍 {city}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Find Love?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of singles in the Gulf. Your perfect match is waiting.
          </p>
          <button
            onClick={onGetStarted}
            className="bg-white text-rose-500 px-8 py-4 rounded-full text-lg font-bold hover:bg-rose-50 hover:scale-105 transition-all shadow-lg"
          >
            Create Free Account
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-white text-xl font-bold mb-4 md:mb-0">
              💕 Qalbi
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
              <a href="#" className="hover:text-white">Contact</a>
            </div>
          </div>
          <div className="text-center mt-8 text-sm">
            © 2026 Qalbi. Made with ❤️ in the Gulf.
          </div>
        </div>
      </footer>
    </div>
  );
}
