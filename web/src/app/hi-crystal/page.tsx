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

  const drinkCoffee = () => {
    playCoffeeSound();
    setCoffeeCount(c => c + 1);
    setCaffeineLevel(l => Math.min(l + 20, 100));
    if (caffeineLevel >= 80) {
      setHyperMode(true);
      playEnergySound();
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
        </div>
      </main>
    </div>
  );
}
