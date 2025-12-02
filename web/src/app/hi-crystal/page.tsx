"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiCrystalPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [coffeeCount, setCoffeeCount] = useState(0);
  const [caffeineLevel, setCaffeineLevel] = useState(0);
  const [hyperMode, setHyperMode] = useState(false);
  const [showNutritionFacts, setShowNutritionFacts] = useState(false);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prCount, setPrCount] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Coffee drip sound effect
  const playCoffeeSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Drip sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);

    // Bubble sound
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(400, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.05);
    }, 50);
  };

  // Energetic ding sound
  const playEnergySound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  };

  // PR Celebration fanfare - triumphant coffee-themed melody
  const playPRCelebration = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Triumphant fanfare melody (C major ascending with harmony)
    const melody = [
      { freq: 523, time: 0, duration: 0.15 },      // C5
      { freq: 659, time: 0.15, duration: 0.15 },   // E5
      { freq: 784, time: 0.3, duration: 0.15 },    // G5
      { freq: 1047, time: 0.45, duration: 0.3 },   // C6
      { freq: 784, time: 0.75, duration: 0.1 },    // G5
      { freq: 1047, time: 0.85, duration: 0.4 },   // C6
      { freq: 1319, time: 1.25, duration: 0.5 },   // E6 (final high note)
    ];

    melody.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + time);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + time + 0.02);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + time + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });

    // Add sparkly high notes
    [2093, 2349, 2637, 2793].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.5 + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7 + i * 0.1);
      osc.start(ctx.currentTime + 0.5 + i * 0.1);
      osc.stop(ctx.currentTime + 0.7 + i * 0.1);
    });
  };

  const triggerPRCelebration = () => {
    setShowPRCelebration(true);
    setPrCount(c => c + 1);
    playPRCelebration();
    setTimeout(() => setShowPRCelebration(false), 4000);
  };

  const drinkCoffee = () => {
    playCoffeeSound();
    setCoffeeCount(c => c + 1);
    const newLevel = Math.min(caffeineLevel + 20, 100);
    setCaffeineLevel(newLevel);
    if (newLevel >= 80) {
      setHyperMode(true);
      playEnergySound();
    }
    if (newLevel === 100 && caffeineLevel < 100) {
      triggerPRCelebration();
    }
  };

  useEffect(() => {
    if (caffeineLevel > 0) {
      const timer = setInterval(() => {
        setCaffeineLevel(l => Math.max(l - 1, 0));
        if (caffeineLevel < 50) setHyperMode(false);
      }, 500);
      return () => clearInterval(timer);
    }
  }, [caffeineLevel]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-amber-700">Brewing...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${hyperMode ? 'animate-hyper-bg' : 'bg-gradient-to-br from-amber-100 via-orange-50 to-green-50'}`}>
      <style jsx global>{`
        @keyframes float-coffee {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(5deg); }
          50% { transform: translateY(-10px) rotate(-5deg); }
          75% { transform: translateY(-25px) rotate(3deg); }
        }

        @keyframes steam {
          0% { transform: translateY(0) scaleX(1); opacity: 0.8; }
          50% { transform: translateY(-20px) scaleX(1.5); opacity: 0.4; }
          100% { transform: translateY(-40px) scaleX(2); opacity: 0; }
        }

        @keyframes bean-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @keyframes hyper-shake {
          0%, 100% { transform: translateX(0) translateY(0); }
          10% { transform: translateX(-2px) translateY(-2px); }
          20% { transform: translateX(2px) translateY(2px); }
          30% { transform: translateX(-2px) translateY(2px); }
          40% { transform: translateX(2px) translateY(-2px); }
          50% { transform: translateX(-2px) translateY(-2px); }
          60% { transform: translateX(2px) translateY(2px); }
          70% { transform: translateX(-2px) translateY(2px); }
          80% { transform: translateX(2px) translateY(-2px); }
          90% { transform: translateX(-2px) translateY(-2px); }
        }

        @keyframes hyper-bg {
          0% { background: linear-gradient(45deg, #fef3c7, #fed7aa, #d1fae5); }
          25% { background: linear-gradient(45deg, #fed7aa, #fef3c7, #a7f3d0); }
          50% { background: linear-gradient(45deg, #d1fae5, #fed7aa, #fef3c7); }
          75% { background: linear-gradient(45deg, #a7f3d0, #fef3c7, #fed7aa); }
          100% { background: linear-gradient(45deg, #fef3c7, #fed7aa, #d1fae5); }
        }

        @keyframes pulse-glow-coffee {
          0%, 100% { box-shadow: 0 0 20px rgba(180, 83, 9, 0.3); }
          50% { box-shadow: 0 0 40px rgba(180, 83, 9, 0.6), 0 0 60px rgba(34, 197, 94, 0.3); }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }

        @keyframes avocado-bounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }

        @keyframes smoothie-swirl {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes nutrition-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes pr-zoom {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes pr-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        @keyframes pr-glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.5), 0 0 60px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 60px rgba(251, 191, 36, 0.8), 0 0 120px rgba(34, 197, 94, 0.5), 0 0 180px rgba(251, 191, 36, 0.3); }
        }

        @keyframes pr-text-rainbow {
          0% { color: #fbbf24; }
          25% { color: #22c55e; }
          50% { color: #f97316; }
          75% { color: #84cc16; }
          100% { color: #fbbf24; }
        }

        @keyframes pr-trophy-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.2); }
        }

        .animate-float-coffee { animation: float-coffee 3s ease-in-out infinite; }
        .animate-steam { animation: steam 2s ease-out infinite; }
        .animate-bean-spin { animation: bean-spin 2s ease-in-out infinite; }
        .animate-hyper-shake { animation: hyper-shake 0.1s ease-in-out infinite; }
        .animate-hyper-bg { animation: hyper-bg 0.5s ease-in-out infinite; }
        .animate-pulse-glow-coffee { animation: pulse-glow-coffee 2s ease-in-out infinite; }
        .animate-sparkle { animation: sparkle 1s ease-in-out infinite; }
        .animate-avocado-bounce { animation: avocado-bounce 2s ease-in-out infinite; }
        .animate-smoothie-swirl { animation: smoothie-swirl 3s linear infinite; }
        .animate-nutrition-pop { animation: nutrition-pop 0.5s ease-out forwards; }
        .animate-pr-zoom { animation: pr-zoom 0.6s ease-out forwards; }
        .animate-pr-confetti { animation: pr-confetti 3s ease-out forwards; }
        .animate-pr-glow-pulse { animation: pr-glow-pulse 0.5s ease-in-out infinite; }
        .animate-pr-text-rainbow { animation: pr-text-rainbow 1s ease-in-out infinite; }
        .animate-pr-trophy-bounce { animation: pr-trophy-bounce 0.5s ease-in-out infinite; }
      `}</style>

      <Navigation />

      <main className={`max-w-4xl mx-auto px-4 py-8 relative overflow-hidden ${hyperMode ? 'animate-hyper-shake' : ''}`}>
        {/* Floating coffee cups and nutrition items */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['☕', '🥑', '🥗', '🍵', '🥤', '🍌', '🥜', '🫐', '🥦', '💚'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-float-coffee"
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

        {/* Coffee beans spinning */}
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-bean-spin"
              style={{
                left: `${10 + i * 12}%`,
                top: `${20 + (i % 3) * 30}%`,
                animationDelay: `${i * 0.2}s`,
              }}
            >
              🫘
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-10">
          {/* Giant animated title */}
          <h1 className="text-6xl md:text-8xl font-black mb-4">
            {'HI CRYSTAL!'.split('').map((letter, i) => (
              <span
                key={i}
                className={`inline-block ${hyperMode ? 'animate-hyper-shake' : 'animate-float-coffee'}`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  color: i % 2 === 0 ? '#92400e' : '#15803d',
                  textShadow: '2px 2px 0 #fef3c7, 4px 4px 0 rgba(0,0,0,0.1)',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          <p className="text-2xl text-amber-700 mb-8 font-medium">
            ✨ Fuel Your Fitness Journey! ✨
          </p>

          {/* Caffeine meter */}
          <div className="bg-white/80 backdrop-blur rounded-3xl p-6 mb-8 animate-pulse-glow-coffee">
            <h2 className="text-xl font-bold text-amber-800 mb-4">☕ CAFFEINE LEVEL ☕</h2>
            <div className="w-full bg-amber-200 rounded-full h-8 mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  caffeineLevel > 80 ? 'bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 animate-pulse' :
                  caffeineLevel > 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                  'bg-gradient-to-r from-amber-300 to-amber-500'
                }`}
                style={{ width: `${caffeineLevel}%` }}
              />
            </div>
            <p className="text-3xl font-black text-amber-700">{caffeineLevel}% {hyperMode && '⚡ HYPER MODE ⚡'}</p>
            <p className="text-amber-600 mt-2">Coffees consumed: {coffeeCount} ☕</p>
          </div>

          {/* Drink coffee button */}
          <button
            onClick={drinkCoffee}
            className={`px-12 py-6 text-2xl font-bold rounded-full transition-all transform hover:scale-110 mb-8 ${
              hyperMode
                ? 'bg-gradient-to-r from-green-400 via-yellow-400 to-orange-500 text-white animate-pulse shadow-2xl'
                : 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-xl hover:shadow-2xl'
            }`}
          >
            ☕ DRINK COFFEE ☕
          </button>

          {/* Nutrition section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { emoji: '🥑', label: 'Healthy Fats', value: '100%', color: 'from-green-400 to-green-600' },
              { emoji: '🥗', label: 'Greens', value: 'MAX', color: 'from-emerald-400 to-emerald-600' },
              { emoji: '💪', label: 'Protein', value: '∞', color: 'from-orange-400 to-orange-600' },
              { emoji: '✨', label: 'Vitality', value: 'EPIC', color: 'from-yellow-400 to-amber-500' },
            ].map((stat, i) => (
              <div
                key={i}
                className={`bg-gradient-to-br ${stat.color} rounded-2xl p-4 text-white animate-float-coffee shadow-lg`}
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-4xl mb-2 animate-avocado-bounce" style={{ animationDelay: `${i * 0.1}s` }}>{stat.emoji}</div>
                <div className="text-2xl font-black">{stat.value}</div>
                <div className="text-sm opacity-90">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Nutrition Facts popup */}
          <button
            onClick={() => {
              setShowNutritionFacts(!showNutritionFacts);
              playEnergySound();
            }}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:scale-110 transition-transform shadow-xl mb-8"
          >
            📊 View Nutrition Facts 📊
          </button>

          {showNutritionFacts && (
            <div className="bg-white rounded-3xl p-8 mb-8 animate-nutrition-pop shadow-2xl border-4 border-green-400">
              <h3 className="text-2xl font-black text-green-700 mb-4">🥗 CRYSTAL&apos;S DAILY NUTRITION 🥗</h3>
              <div className="grid grid-cols-2 gap-4 text-left">
                {[
                  { nutrient: 'Protein', amount: '150g', percent: '300%', emoji: '💪' },
                  { nutrient: 'Healthy Fats', amount: '80g', percent: '200%', emoji: '🥑' },
                  { nutrient: 'Complex Carbs', amount: '200g', percent: '150%', emoji: '🍠' },
                  { nutrient: 'Fiber', amount: '50g', percent: '250%', emoji: '🥦' },
                  { nutrient: 'Caffeine', amount: '∞ mg', percent: 'YES', emoji: '☕' },
                  { nutrient: 'Good Vibes', amount: 'MAX', percent: '1000%', emoji: '✨' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                      <div className="font-bold text-green-800">{item.nutrient}</div>
                      <div className="text-green-600">{item.amount} ({item.percent})</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smoothie section */}
          <div className="bg-gradient-to-r from-pink-200 via-purple-200 to-green-200 rounded-3xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-white rounded-full animate-sparkle"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
            <h3 className="text-3xl font-black text-purple-700 mb-4 relative z-10">🥤 SMOOTHIE OF THE DAY 🥤</h3>
            <div className="text-6xl mb-4 animate-smoothie-swirl">🫐🍌🥬🥛</div>
            <p className="text-xl text-purple-600 font-medium relative z-10">
              &quot;The Crystal Power Blend&quot;
            </p>
            <p className="text-purple-500 mt-2">Blueberries + Banana + Spinach + Almond Milk + MAGIC ✨</p>
          </div>

          {/* Motivational quote */}
          <div className="bg-amber-100 border-4 border-amber-400 rounded-3xl p-6">
            <p className="text-2xl text-amber-800 font-bold italic">
              &quot;Eat clean, train mean, drink caffeine!&quot; ☕💪
            </p>
            <p className="text-amber-600 mt-2">- Crystal&apos;s Fitness Philosophy</p>
          </div>

          {/* PR Counter */}
          {prCount > 0 && (
            <div className="mt-8 bg-gradient-to-r from-amber-400 via-green-400 to-amber-400 rounded-2xl p-4 text-center">
              <p className="text-xl font-black text-white drop-shadow-lg">
                🏆 CAFFEINE PRs: {prCount} 🏆
              </p>
            </div>
          )}
        </div>

        {/* PR Celebration Overlay */}
        {showPRCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-3xl animate-pr-confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-50px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  {['☕', '🥑', '💪', '✨', '🏆', '⭐', '🎉', '💚', '🥗', '🌟'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration card */}
            <div className="bg-gradient-to-br from-amber-400 via-green-400 to-emerald-500 rounded-3xl p-8 animate-pr-zoom animate-pr-glow-pulse text-center max-w-md mx-4">
              <div className="text-8xl mb-4 animate-pr-trophy-bounce">🏆</div>
              <h2 className="text-4xl font-black text-white mb-2 drop-shadow-lg animate-pr-text-rainbow">
                NEW PR!
              </h2>
              <p className="text-2xl font-bold text-white/90 mb-4">
                ☕ MAXIMUM CAFFEINE ACHIEVED! ☕
              </p>
              <div className="flex justify-center gap-2 text-4xl mb-4">
                {['💪', '⚡', '🔥', '✨', '💚'].map((emoji, i) => (
                  <span key={i} className="animate-pr-trophy-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-lg text-white/80 font-medium">
                You&apos;re officially UNSTOPPABLE!
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
