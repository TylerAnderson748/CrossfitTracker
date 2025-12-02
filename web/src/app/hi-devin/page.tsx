"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiDevinPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [rainbowMode, setRainbowMode] = useState(false);
  const [hypeLevel, setHypeLevel] = useState(0);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prCount, setPrCount] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // Hype level decay
  useEffect(() => {
    if (hypeLevel > 0) {
      const timer = setInterval(() => {
        setHypeLevel(l => Math.max(l - 1, 0));
        if (hypeLevel < 30) setComboCount(0);
      }, 400);
      return () => clearInterval(timer);
    }
  }, [hypeLevel]);

  // Gaming keyboard click sound
  const playKeyboardSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  };

  // Level up sound
  const playLevelUpSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  };

  // Epic PR Victory sound - gaming achievement fanfare
  const playPRCelebration = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Epic 8-bit victory melody
    const melody = [
      { freq: 523, time: 0, duration: 0.1 },
      { freq: 659, time: 0.1, duration: 0.1 },
      { freq: 784, time: 0.2, duration: 0.1 },
      { freq: 1047, time: 0.3, duration: 0.2 },
      { freq: 880, time: 0.5, duration: 0.1 },
      { freq: 1047, time: 0.6, duration: 0.3 },
      { freq: 1319, time: 0.9, duration: 0.4 },
    ];

    melody.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });

    // Add harmony
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq * 1.5;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.9 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.3 + i * 0.05);
      osc.start(ctx.currentTime + 0.9 + i * 0.05);
      osc.stop(ctx.currentTime + 1.3 + i * 0.05);
    });
  };

  const triggerPRCelebration = () => {
    setShowPRCelebration(true);
    setPrCount(c => c + 1);
    playPRCelebration();
    setTimeout(() => setShowPRCelebration(false), 4000);
  };

  const handleClick = () => {
    setClickCount((c) => c + 1);
    if (clickCount >= 4) {
      setRainbowMode(!rainbowMode);
      setClickCount(0);
    }
  };

  const addHype = () => {
    playKeyboardSound();
    setComboCount(c => c + 1);
    const newLevel = Math.min(hypeLevel + 10, 100);
    setHypeLevel(newLevel);
    if (newLevel >= 70) {
      playLevelUpSound();
    }
    if (newLevel === 100 && hypeLevel < 100) {
      triggerPRCelebration();
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-green-400 font-mono">Loading game...</p>
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

        @keyframes gaming-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 0, 0.8), 0 0 80px rgba(0, 255, 255, 0.5), 0 0 120px rgba(255, 0, 255, 0.3); }
        }

        @keyframes pixel-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes combo-flash {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        @keyframes pr-game-zoom {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          75% { transform: scale(0.9) rotate(-5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes pr-pixel-rain {
          0% { transform: translateY(-50px); opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }

        @keyframes pr-game-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 255, 0, 0.5), 0 0 60px rgba(255, 0, 255, 0.3); }
          50% { box-shadow: 0 0 60px rgba(0, 255, 0, 0.8), 0 0 120px rgba(255, 0, 255, 0.5), 0 0 180px rgba(0, 255, 255, 0.3); }
        }

        @keyframes pr-achievement-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(-10deg); }
          75% { transform: translateY(-20px) rotate(10deg); }
        }

        .animate-bounce-crazy { animation: bounce-crazy 1s ease-in-out infinite; }
        .animate-spin-wobble { animation: spin-wobble 0.5s ease-in-out infinite; }
        .animate-rainbow { animation: rainbow 2s linear infinite; }
        .animate-rainbow-bg { animation: rainbow-bg 3s linear infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-gaming-glow { animation: gaming-glow 2s ease-in-out infinite; }
        .animate-pixel-pulse { animation: pixel-pulse 0.5s ease-in-out infinite; }
        .animate-combo-flash { animation: combo-flash 0.3s ease-in-out infinite; }
        .animate-pr-game-zoom { animation: pr-game-zoom 0.8s ease-out forwards; }
        .animate-pr-pixel-rain { animation: pr-pixel-rain 2s ease-out forwards; }
        .animate-pr-game-glow { animation: pr-game-glow 0.4s ease-in-out infinite; }
        .animate-pr-achievement-bounce { animation: pr-achievement-bounce 0.6s ease-in-out infinite; }

        .letter-animation {
          display: inline-block;
          animation: letter-wave 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-8 relative overflow-hidden">
        {/* Floating emojis background - now with gaming items */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🎮', '🕹️', '💻', '⌨️', '🖱️', '🎯', '🏆', '⚡', '💎', '🚀', '👾', '🎲'].map((emoji, i) => (
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
                  background: `radial-gradient(circle, ${['#00ff00', '#ff00ff', '#00ffff', '#ffff00', '#ff0080'][i]} 0%, transparent 70%)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 text-center pt-10">
          {/* Giant animated title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-4 cursor-pointer select-none"
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

          <p className="text-xl text-white/80 mb-6 font-mono">
            🎮 PLAYER 1 READY 🎮
          </p>

          {/* HYPE METER */}
          <div className="bg-gray-900/80 backdrop-blur rounded-3xl p-6 mb-6 animate-gaming-glow border-2 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-green-400 font-mono">⚡ HYPE METER ⚡</h2>
              {comboCount > 3 && (
                <span className="text-yellow-400 font-black animate-combo-flash">
                  {comboCount}x COMBO!
                </span>
              )}
            </div>
            <div className="w-full bg-gray-800 rounded-full h-8 mb-4 overflow-hidden border-2 border-green-600">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  hypeLevel >= 70 ? 'bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 animate-pulse' :
                  hypeLevel >= 40 ? 'bg-gradient-to-r from-green-500 to-cyan-500' :
                  'bg-gradient-to-r from-green-600 to-green-400'
                }`}
                style={{ width: `${hypeLevel}%` }}
              />
            </div>
            <p className="text-2xl font-black text-green-400 font-mono">
              {hypeLevel}% {hypeLevel >= 70 && '🔥 ON FIRE!'} {hypeLevel === 100 && '💥 MAX LEVEL!'}
            </p>
          </div>

          {/* Gaming action button */}
          <button
            onClick={addHype}
            className={`px-12 py-6 text-2xl font-black rounded-xl mb-6 transition-all transform hover:scale-110 border-4 ${
              hypeLevel >= 70
                ? 'bg-gradient-to-r from-green-500 via-cyan-500 to-purple-500 border-white text-black animate-pixel-pulse'
                : 'bg-gradient-to-r from-green-600 to-cyan-600 border-green-400 text-white'
            }`}
          >
            🎮 PRESS TO HYPE 🎮
          </button>

          {/* Bouncing emoji row */}
          <div className="flex justify-center gap-4 mb-8">
            {['🏋️', '💪', '🎮', '⚡', '🎯', '🚀'].map((emoji, i) => (
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

          {/* Gaming Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Level', value: '99', emoji: '⭐' },
              { label: 'XP', value: '∞', emoji: '💎' },
              { label: 'Kills', value: '9999', emoji: '💀' },
              { label: 'Score', value: 'MAX', emoji: '🏆' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-gray-900/60 backdrop-blur rounded-2xl p-4 border-2 border-cyan-500 animate-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-3xl mb-1">{stat.emoji}</div>
                <div className="text-2xl font-black text-cyan-400 font-mono">{stat.value}</div>
                <div className="text-white/70 text-sm font-mono">{stat.label}</div>
              </div>
            ))}
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

          {/* PR Counter */}
          {prCount > 0 && (
            <div className="mt-8 bg-gradient-to-r from-green-500 via-cyan-500 to-purple-500 rounded-2xl p-4 text-center border-4 border-white">
              <p className="text-xl font-black text-white drop-shadow-lg font-mono">
                🏆 ACHIEVEMENTS UNLOCKED: {prCount} 🏆
              </p>
            </div>
          )}

          {/* Scrolling marquee */}
          <div className="mt-12 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee">
              <span className="text-2xl text-white/80 mx-8">🎮 GG EZ! 🎮</span>
              <span className="text-2xl text-white/80 mx-8">🏋️ CRUSH THOSE WODS! 🏋️</span>
              <span className="text-2xl text-white/80 mx-8">💪 BEAST MODE! 💪</span>
              <span className="text-2xl text-white/80 mx-8">🎯 HEADSHOT! 🎯</span>
              <span className="text-2xl text-white/80 mx-8">🎮 GG EZ! 🎮</span>
            </div>
          </div>
        </div>

        {/* PR Celebration Overlay */}
        {showPRCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Pixel/gaming confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(60)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl animate-pr-pixel-rain"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-50px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  {['🎮', '💎', '⭐', '🏆', '🚀', '⚡', '👾', '🎯', '💻', '🕹️'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration card */}
            <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-3xl p-8 animate-pr-game-zoom animate-pr-game-glow text-center max-w-md mx-4 border-4 border-green-400">
              <div className="text-8xl mb-4 animate-pr-achievement-bounce">🏆</div>
              <h2 className="text-4xl font-black text-green-400 mb-2 drop-shadow-lg font-mono">
                ACHIEVEMENT UNLOCKED!
              </h2>
              <p className="text-2xl font-bold text-cyan-400 mb-4 font-mono">
                🎮 MAX HYPE REACHED! 🎮
              </p>
              <div className="flex justify-center gap-2 text-4xl mb-4">
                {['💎', '⭐', '🏆', '⚡', '🚀'].map((emoji, i) => (
                  <span key={i} className="animate-bounce-crazy" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-lg text-white/80 font-mono">
                +9999 XP EARNED!
              </p>
              <p className="text-green-400 text-sm mt-2 font-bold font-mono">
                &quot;GG EZ NO RE&quot;
              </p>
            </div>
          </div>
        )}
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
