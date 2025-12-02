"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiDevinPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [rainbowMode, setRainbowMode] = useState(false);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    // Trigger fireworks periodically
    const interval = setInterval(() => {
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    setClickCount((c) => c + 1);
    if (clickCount >= 4) {
      setRainbowMode(!rainbowMode);
      setClickCount(0);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${rainbowMode ? 'animate-rainbow-bg' : 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400'}`}>
      <style jsx global>{`
        @keyframes bounce-crazy {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-30px) rotate(-10deg) scale(1.1); }
          50% { transform: translateY(0) rotate(10deg) scale(0.9); }
          75% { transform: translateY(-15px) rotate(-5deg) scale(1.05); }
        }

        @keyframes spin-wobble {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          50% { transform: rotate(-10deg); }
          75% { transform: rotate(5deg); }
          100% { transform: rotate(0deg); }
        }

        @keyframes rainbow {
          0% { color: #ff0000; }
          16% { color: #ff8000; }
          33% { color: #ffff00; }
          50% { color: #00ff00; }
          66% { color: #0080ff; }
          83% { color: #8000ff; }
          100% { color: #ff0000; }
        }

        @keyframes rainbow-bg {
          0% { background: linear-gradient(45deg, #ff0000, #ff8000); }
          16% { background: linear-gradient(45deg, #ff8000, #ffff00); }
          33% { background: linear-gradient(45deg, #ffff00, #00ff00); }
          50% { background: linear-gradient(45deg, #00ff00, #0080ff); }
          66% { background: linear-gradient(45deg, #0080ff, #8000ff); }
          83% { background: linear-gradient(45deg, #8000ff, #ff0080); }
          100% { background: linear-gradient(45deg, #ff0080, #ff0000); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(0) translateX(-10px); }
          75% { transform: translateY(-10px) translateX(5px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 60px rgba(255,255,255,0.9), 0 0 100px rgba(255,0,255,0.5); }
        }

        @keyframes letter-wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }

        @keyframes disco {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-bounce-crazy {
          animation: bounce-crazy 1s ease-in-out infinite;
        }

        .animate-spin-wobble {
          animation: spin-wobble 0.5s ease-in-out infinite;
        }

        .animate-rainbow {
          animation: rainbow 2s linear infinite;
        }

        .animate-rainbow-bg {
          animation: rainbow-bg 3s linear infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-firework {
          animation: firework 1s ease-out forwards;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .letter-animation {
          display: inline-block;
          animation: letter-wave 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-8 relative overflow-hidden">
        {/* Floating emojis background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🎉', '🚀', '⭐', '💥', '🔥', '✨', '🎊', '💫', '🌟', '🎯'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Fireworks */}
        {showFireworks && (
          <div className="fixed inset-0 pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-32 rounded-full animate-firework"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 40}%`,
                  background: `radial-gradient(circle, ${['#ff0080', '#00ff80', '#8000ff', '#ffff00', '#00ffff'][i]} 0%, transparent 70%)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 text-center pt-20">
          {/* Giant animated title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-8 cursor-pointer select-none"
            onClick={handleClick}
          >
            {'HI DEVIN!'.split('').map((letter, i) => (
              <span
                key={i}
                className="letter-animation inline-block animate-rainbow"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,0,255,0.5)',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          {/* Bouncing emoji row */}
          <div className="flex justify-center gap-4 mb-12">
            {['🏋️', '💪', '🔥', '⚡', '🎯', '🚀'].map((emoji, i) => (
              <span
                key={i}
                className="text-5xl animate-bounce-crazy"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {emoji}
              </span>
            ))}
          </div>

          {/* Glowing card */}
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 mb-8 animate-pulse-glow">
            <p className="text-2xl md:text-3xl font-bold text-white mb-4 animate-spin-wobble">
              Welcome to the party! 🎉
            </p>
            <p className="text-lg text-white/90">
              You found the secret page! Click the title 5 times for a surprise...
            </p>
            {clickCount > 0 && (
              <p className="text-white/70 mt-2">
                Clicks: {clickCount}/5
              </p>
            )}
          </div>

          {/* Dancing buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setRainbowMode(!rainbowMode)}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xl rounded-full hover:scale-110 transition-transform animate-float shadow-2xl"
            >
              {rainbowMode ? '🌈 Rainbow ON!' : '✨ Activate Rainbow'}
            </button>

            <button
              onClick={() => setShowFireworks(true)}
              className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-xl rounded-full hover:scale-110 transition-transform animate-float shadow-2xl"
              style={{ animationDelay: '0.5s' }}
            >
              🎆 Fireworks!
            </button>
          </div>

          {/* Stats for fun */}
          <div className="grid grid-cols-3 gap-4 mt-12">
            {[
              { label: 'Awesome Level', value: '∞', emoji: '🔥' },
              { label: 'Fun Factor', value: '9001', emoji: '🚀' },
              { label: 'Devin Score', value: '100%', emoji: '⭐' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur rounded-2xl p-6 animate-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-3xl font-black text-white animate-rainbow">{stat.value}</div>
                <div className="text-white/70 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Scrolling marquee */}
          <div className="mt-12 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee">
              <span className="text-2xl text-white/80 mx-8">🎉 HI DEVIN! 🎉</span>
              <span className="text-2xl text-white/80 mx-8">🏋️ CRUSH THOSE WODS! 🏋️</span>
              <span className="text-2xl text-white/80 mx-8">💪 BEAST MODE! 💪</span>
              <span className="text-2xl text-white/80 mx-8">🔥 LETS GOOO! 🔥</span>
              <span className="text-2xl text-white/80 mx-8">🎉 HI DEVIN! 🎉</span>
              <span className="text-2xl text-white/80 mx-8">🏋️ CRUSH THOSE WODS! 🏋️</span>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 15s linear infinite;
        }
      `}</style>
    </div>
  );
}
