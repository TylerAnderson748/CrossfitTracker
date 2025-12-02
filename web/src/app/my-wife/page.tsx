"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function MyWifePage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [loveCount, setLoveCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [calicoMode, setCalicoMode] = useState(false);
  const [prCount, setPrCount] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Warm, cozy chime sound
  const playChimeSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Warm bell-like tones
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  };

  // Cat purr sound
  const playPurrSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Low rumbling purr
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.frequency.value = 25;
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.frequency.value = 50;
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

    lfo.start(ctx.currentTime);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    lfo.stop(ctx.currentTime + 0.8);
  };

  // Celebration lullaby melody
  const playCelebration = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Sweet lullaby-like melody
    const melody = [
      { freq: 392, time: 0, duration: 0.3 },      // G4
      { freq: 440, time: 0.3, duration: 0.3 },    // A4
      { freq: 523, time: 0.6, duration: 0.4 },    // C5
      { freq: 494, time: 1.0, duration: 0.3 },    // B4
      { freq: 523, time: 1.3, duration: 0.3 },    // C5
      { freq: 587, time: 1.6, duration: 0.5 },    // D5
      { freq: 523, time: 2.1, duration: 0.6 },    // C5
    ];

    melody.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
  };

  const triggerCelebration = () => {
    setShowCelebration(true);
    setPrCount(c => c + 1);
    playCelebration();
    setTimeout(() => setShowCelebration(false), 4000);
  };

  const sendLove = () => {
    playChimeSound();
    setLoveCount(c => c + 1);

    if (loveCount > 0 && loveCount % 5 === 4) {
      playPurrSound();
      setCalicoMode(true);
      setTimeout(() => setCalicoMode(false), 2000);
    }

    if (loveCount > 0 && loveCount % 10 === 9) {
      triggerCelebration();
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-amber-800">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-500 ${calicoMode ? 'animate-calico-bg' : 'bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50'}`}>
      <style jsx global>{`
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }

        @keyframes cat-stretch {
          0%, 100% { transform: scaleX(1) scaleY(1); }
          50% { transform: scaleX(1.1) scaleY(0.95); }
        }

        @keyframes starburst {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.1); }
          28% { transform: scale(1); }
          42% { transform: scale(1.1); }
          56% { transform: scale(1); }
        }

        @keyframes calico-bg {
          0% { background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 33%, #2dd4bf 66%, #fef3c7 100%); }
          33% { background: linear-gradient(135deg, #fed7aa 0%, #2dd4bf 33%, #fef3c7 66%, #fed7aa 100%); }
          66% { background: linear-gradient(135deg, #2dd4bf 0%, #fef3c7 33%, #fed7aa 66%, #2dd4bf 100%); }
          100% { background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 33%, #2dd4bf 66%, #fef3c7 100%); }
        }

        @keyframes mid-century-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(217, 119, 6, 0.2); }
          50% { box-shadow: 0 8px 40px rgba(217, 119, 6, 0.4), 0 0 60px rgba(20, 184, 166, 0.2); }
        }

        @keyframes baby-kick {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px) rotate(-2deg); }
          75% { transform: translateX(5px) rotate(2deg); }
        }

        @keyframes tortie-pattern {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @keyframes nursery-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.3), 0 0 60px rgba(20, 184, 166, 0.2); }
          50% { box-shadow: 0 0 50px rgba(251, 191, 36, 0.5), 0 0 100px rgba(20, 184, 166, 0.3), 0 0 150px rgba(249, 115, 22, 0.2); }
        }

        @keyframes confetti-fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        @keyframes celebration-pop {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .animate-gentle-float { animation: gentle-float 4s ease-in-out infinite; }
        .animate-cat-stretch { animation: cat-stretch 3s ease-in-out infinite; }
        .animate-starburst { animation: starburst 20s linear infinite; }
        .animate-heartbeat { animation: heartbeat 2s ease-in-out infinite; }
        .animate-calico-bg { animation: calico-bg 3s ease-in-out infinite; }
        .animate-mid-century-pulse { animation: mid-century-pulse 3s ease-in-out infinite; }
        .animate-baby-kick { animation: baby-kick 2s ease-in-out infinite; }
        .animate-tortie-pattern { animation: tortie-pattern 2s ease-in-out infinite; }
        .animate-nursery-glow { animation: nursery-glow 2s ease-in-out infinite; }
        .animate-confetti-fall { animation: confetti-fall 3s ease-out forwards; }
        .animate-celebration-pop { animation: celebration-pop 0.6s ease-out forwards; }

        .mid-century-card {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 3px solid #d97706;
          border-radius: 0 30px 0 30px;
        }

        .starburst-bg {
          background:
            linear-gradient(45deg, transparent 45%, #f59e0b 45%, #f59e0b 55%, transparent 55%),
            linear-gradient(-45deg, transparent 45%, #14b8a6 45%, #14b8a6 55%, transparent 55%);
        }

        .calico-text {
          background: linear-gradient(90deg, #f97316, #000000, #fbbf24, #14b8a6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-8 relative overflow-hidden">
        {/* Mid-century starburst decoration */}
        <div className="fixed top-20 right-10 w-32 h-32 opacity-20 animate-starburst pointer-events-none">
          <div className="absolute inset-0 starburst-bg" />
        </div>

        {/* Floating elements - cats, baby items, mid-century shapes */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🐱', '🧡', '🖤', '🤍', '👶', '🍼', '💛', '🐈', '✨', '🌿', '🪴', '💕'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-gentle-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${4 + Math.random() * 2}s`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-8">
          {/* Title with mid-century style */}
          <h1 className="text-5xl md:text-7xl font-black mb-2">
            {'MY WIFE'.split('').map((letter, i) => (
              <span
                key={i}
                className="inline-block animate-gentle-float"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  color: ['#f97316', '#000000', '#fbbf24', '#14b8a6', '#f97316', '#000000', '#fbbf24'][i],
                  textShadow: '2px 2px 0 rgba(0,0,0,0.1)',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          <p className="text-xl text-amber-700 mb-6 font-medium">
            ✨ Mama-to-be & Cat Mom Extraordinaire ✨
          </p>

          {/* Calico cat display */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="text-6xl animate-cat-stretch">🐱</div>
            <div className="text-6xl animate-heartbeat">🤰</div>
            <div className="text-6xl animate-cat-stretch" style={{ animationDelay: '0.5s' }}>🐈</div>
          </div>

          {/* Mid-century modern card */}
          <div className="mid-century-card p-8 mb-8 animate-mid-century-pulse">
            <h2 className="text-2xl font-bold text-amber-800 mb-4">🧡 Calico & Tortie Love 🖤</h2>
            <div className="flex justify-center gap-6 mb-4">
              {['🧡', '🖤', '🤍', '🧡', '🖤'].map((color, i) => (
                <span
                  key={i}
                  className="text-4xl animate-tortie-pattern"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  {color}
                </span>
              ))}
            </div>
            <p className="text-amber-700">The most beautiful fur patterns in the world!</p>
          </div>

          {/* Love button */}
          <button
            onClick={sendLove}
            className="px-12 py-6 text-2xl font-bold rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-teal-400 text-white border-4 border-amber-600 shadow-xl hover:scale-105 transition-transform animate-nursery-glow mb-8"
            style={{ borderRadius: '0 25px 0 25px' }}
          >
            💕 Send Love 💕
          </button>

          {/* Counter */}
          <div className="mid-century-card p-4 mb-8 inline-block">
            <p className="text-2xl font-bold text-amber-800">
              Love sent: <span className="calico-text">{loveCount}</span> times
            </p>
          </div>

          {/* Baby bump section */}
          <div className="bg-gradient-to-r from-pink-100 via-amber-50 to-teal-100 rounded-3xl p-8 mb-8 border-2 border-amber-300" style={{ borderRadius: '0 40px 0 40px' }}>
            <h3 className="text-2xl font-bold text-amber-800 mb-4">👶 Baby on Board 👶</h3>
            <div className="text-6xl mb-4 animate-baby-kick">🤰</div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { emoji: '🍼', label: 'Bottles Ready' },
                { emoji: '🧸', label: 'Nursery Goals' },
                { emoji: '💤', label: 'Sleep Pending' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl mb-2">{item.emoji}</div>
                  <p className="text-amber-700 text-sm">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Calico mode popup */}
          {calicoMode && (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="bg-gradient-to-r from-orange-400 via-black to-amber-400 text-white text-4xl font-black px-10 py-6 rounded-3xl animate-celebration-pop shadow-2xl" style={{ borderRadius: '0 30px 0 30px' }}>
                🐱 CALICO QUEEN! 🐱
              </div>
            </div>
          )}

          {/* Mid-century stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Cats', value: '2', emoji: '🐱' },
              { label: 'Love Level', value: '∞', emoji: '💕' },
              { label: 'Baby ETA', value: 'Soon!', emoji: '👶' },
              { label: 'Cozy Factor', value: 'MAX', emoji: '🛋️' },
            ].map((stat, i) => (
              <div
                key={i}
                className="mid-century-card p-4 animate-gentle-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-3xl mb-2">{stat.emoji}</div>
                <div className="text-xl font-bold text-amber-800">{stat.value}</div>
                <div className="text-amber-600 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Mid-century furniture vibes */}
          <div className="bg-teal-50 border-3 border-teal-400 rounded-xl p-6 mb-8" style={{ borderRadius: '0 30px 0 30px', border: '3px solid #14b8a6' }}>
            <h3 className="text-xl font-bold text-teal-800 mb-4">🪴 Mid-Century Nursery Vibes 🪴</h3>
            <div className="flex justify-center gap-6 text-4xl">
              <span>🛋️</span>
              <span>🪑</span>
              <span>🌿</span>
              <span>💡</span>
              <span>🖼️</span>
            </div>
            <p className="text-teal-700 mt-4 italic">&quot;Clean lines, warm tones, and lots of love&quot;</p>
          </div>

          {/* PR Counter */}
          {prCount > 0 && (
            <div className="mt-6 bg-gradient-to-r from-orange-400 via-amber-400 to-teal-400 rounded-2xl p-4 text-center" style={{ borderRadius: '0 20px 0 20px' }}>
              <p className="text-xl font-bold text-white drop-shadow-lg">
                💕 Love Celebrations: {prCount} 💕
              </p>
            </div>
          )}

          {/* Quote */}
          <div className="mt-8 mid-century-card p-6">
            <p className="text-xl text-amber-800 font-medium italic">
              &quot;Home is where the calico cats are&quot; 🐱💕
            </p>
          </div>
        </div>

        {/* Celebration Overlay */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-3xl animate-confetti-fall"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-50px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  {['🐱', '💕', '👶', '🧡', '🖤', '✨', '🌿', '🍼', '💛', '🐈'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration */}
            <div className="bg-gradient-to-br from-amber-100 via-orange-100 to-teal-100 p-8 animate-celebration-pop text-center max-w-md mx-4 border-4 border-amber-500 animate-nursery-glow" style={{ borderRadius: '0 40px 0 40px' }}>
              <div className="text-7xl mb-4 animate-heartbeat">💕</div>
              <h2 className="text-4xl font-black text-amber-800 mb-2">
                SO MUCH LOVE!
              </h2>
              <div className="flex justify-center gap-3 text-4xl mb-4">
                <span className="animate-cat-stretch">🐱</span>
                <span className="animate-baby-kick">🤰</span>
                <span className="animate-cat-stretch" style={{ animationDelay: '0.3s' }}>🐈</span>
              </div>
              <p className="text-xl text-amber-700">
                Best Wife Ever! 💕
              </p>
              <p className="text-teal-600 mt-2 italic">
                Cat mom + Baby mama = Perfect 🧡🖤
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
