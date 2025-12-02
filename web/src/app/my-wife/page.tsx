"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function MyWifePage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [wifeCount, setWifeCount] = useState(0);
  const [veryNice, setVeryNice] = useState(false);
  const [greatSuccess, setGreatSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Synthesized "MY WIFE" sound (Borat-style accent approximation)
  const playMyWifeSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // "MY" - higher pitched, short
    const playMy = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(250, ctx.currentTime + 0.2);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);

      // Add formant
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(560, ctx.currentTime);
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.08, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.2);
    };

    // "WIFE" - drawn out, accent going up then down
    const playWife = () => {
      const startTime = ctx.currentTime + 0.3;

      // Main voice
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(200, startTime);
      osc.frequency.linearRampToValueAtTime(350, startTime + 0.2);
      osc.frequency.linearRampToValueAtTime(400, startTime + 0.4);
      osc.frequency.linearRampToValueAtTime(280, startTime + 0.6);
      osc.frequency.linearRampToValueAtTime(180, startTime + 0.8);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.3);
      gain.gain.setValueAtTime(0.25, startTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.85);
      osc.start(startTime);
      osc.stop(startTime + 0.85);

      // High formant for "i" sound
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(2200, startTime + 0.15);
      osc2.frequency.linearRampToValueAtTime(2400, startTime + 0.4);
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.05, startTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
      osc2.start(startTime + 0.15);
      osc2.stop(startTime + 0.6);

      // Add some noise for texture
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 5;
      noise.buffer = buffer;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.02, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      noise.start(startTime);
    };

    playMy();
    playWife();
  };

  // "Very Nice!" sound
  const playVeryNiceSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Ascending happy notes
    [300, 350, 400, 500].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.15);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.15);
    });
  };

  // "Great Success!" celebration sound
  const playGreatSuccessSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Triumphant fanfare
    const melody = [
      { freq: 262, time: 0, duration: 0.15 },
      { freq: 330, time: 0.15, duration: 0.15 },
      { freq: 392, time: 0.3, duration: 0.15 },
      { freq: 523, time: 0.45, duration: 0.3 },
      { freq: 659, time: 0.8, duration: 0.15 },
      { freq: 523, time: 0.95, duration: 0.15 },
      { freq: 659, time: 1.1, duration: 0.15 },
      { freq: 784, time: 1.25, duration: 0.5 },
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
  };

  const sayMyWife = () => {
    playMyWifeSound();
    setWifeCount(c => c + 1);

    if (wifeCount > 0 && wifeCount % 5 === 4) {
      setTimeout(() => {
        setVeryNice(true);
        playVeryNiceSound();
        setTimeout(() => setVeryNice(false), 2000);
      }, 1000);
    }

    if (wifeCount > 0 && wifeCount % 10 === 9) {
      setTimeout(() => {
        setGreatSuccess(true);
        setShowCelebration(true);
        playGreatSuccessSound();
        setTimeout(() => {
          setGreatSuccess(false);
          setShowCelebration(false);
        }, 4000);
      }, 1500);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-100">
        <p className="text-yellow-800">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-300 via-yellow-400 to-green-400">
      <style jsx global>{`
        @keyframes borat-bounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }

        @keyframes thumbs-up {
          0%, 100% { transform: rotate(-10deg) scale(1); }
          50% { transform: rotate(10deg) scale(1.3); }
        }

        @keyframes very-nice-pop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes great-success {
          0% { transform: scale(0); opacity: 0; }
          30% { transform: scale(1.5); opacity: 1; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes mustache-wiggle {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(1.1); }
        }

        @keyframes kazakh-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes confetti-fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
          50% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.9), 0 0 100px rgba(255, 215, 0, 0.5); }
        }

        @keyframes wife-glow {
          0%, 100% { text-shadow: 0 0 10px #fff, 0 0 20px #ffd700, 0 0 30px #ffd700; }
          50% { text-shadow: 0 0 20px #fff, 0 0 40px #ffd700, 0 0 60px #ffd700, 0 0 80px #ffd700; }
        }

        .animate-borat-bounce { animation: borat-bounce 0.8s ease-in-out infinite; }
        .animate-thumbs-up { animation: thumbs-up 0.5s ease-in-out infinite; }
        .animate-very-nice-pop { animation: very-nice-pop 0.5s ease-out forwards; }
        .animate-great-success { animation: great-success 0.8s ease-out forwards; }
        .animate-mustache-wiggle { animation: mustache-wiggle 0.3s ease-in-out infinite; }
        .animate-kazakh-spin { animation: kazakh-spin 2s linear infinite; }
        .animate-confetti-fall { animation: confetti-fall 3s ease-out forwards; }
        .animate-pulse-gold { animation: pulse-gold 2s ease-in-out infinite; }
        .animate-wife-glow { animation: wife-glow 1s ease-in-out infinite; }
      `}</style>

      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-8 relative overflow-hidden">
        {/* Floating emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['👍', '🇰🇿', '💛', '🎉', '⭐', '👰', '💍', '❤️', '🥇', '🎊'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-borat-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-10">
          {/* Title */}
          <h1 className="text-6xl md:text-8xl font-black mb-4 text-white animate-wife-glow">
            {'MY WIFE!'.split('').map((letter, i) => (
              <span
                key={i}
                className="inline-block animate-borat-bounce"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  color: i % 2 === 0 ? '#ffd700' : '#ffffff',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="text-2xl text-white/90 mb-8 font-bold">
            🇰🇿 Very Nice! High Five! 🇰🇿
          </p>

          {/* Big button */}
          <button
            onClick={sayMyWife}
            className="px-16 py-8 text-3xl font-black rounded-3xl bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-white border-4 border-white shadow-2xl hover:scale-110 transition-transform animate-pulse-gold mb-8"
          >
            👍 SAY &quot;MY WIFE!&quot; 👍
          </button>

          {/* Counter */}
          <div className="bg-white/30 backdrop-blur rounded-3xl p-6 mb-8 inline-block">
            <p className="text-4xl font-black text-white">
              Times said: <span className="text-yellow-300">{wifeCount}</span>
            </p>
          </div>

          {/* Very Nice popup */}
          {veryNice && (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-6xl font-black px-12 py-8 rounded-3xl animate-very-nice-pop shadow-2xl">
                👍 VERY NICE! 👍
              </div>
            </div>
          )}

          {/* Thumbs up row */}
          <div className="flex justify-center gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="text-6xl animate-thumbs-up"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                👍
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Wife Status', value: 'VERY NICE', emoji: '👰' },
              { label: 'Success Level', value: 'GREAT', emoji: '🏆' },
              { label: 'High Fives', value: '∞', emoji: '🙌' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/30 backdrop-blur rounded-2xl p-4 animate-borat-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-xl font-black text-white">{stat.value}</div>
                <div className="text-white/80 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="bg-white/40 backdrop-blur rounded-3xl p-6 border-4 border-yellow-400">
            <p className="text-2xl text-yellow-900 font-bold italic">
              &quot;She is my wife... VERY NICE!&quot;
            </p>
            <p className="text-yellow-800 mt-2">- A True Gentleman</p>
          </div>
        </div>

        {/* Great Success Celebration */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl animate-confetti-fall"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-50px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  {['👍', '🇰🇿', '💛', '⭐', '🏆', '🎉', '💍', '👰', '❤️', '🥇'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration */}
            <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-green-500 rounded-3xl p-8 animate-great-success text-center max-w-md mx-4 border-4 border-white shadow-2xl">
              <div className="text-8xl mb-4 animate-kazakh-spin">🏆</div>
              <h2 className="text-5xl font-black text-white mb-4 drop-shadow-lg">
                GREAT SUCCESS!
              </h2>
              <div className="flex justify-center gap-2 text-5xl mb-4">
                {['👍', '👍', '👍'].map((emoji, i) => (
                  <span key={i} className="animate-thumbs-up" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-2xl text-white/90 font-bold">
                VERY NICE!
              </p>
              <p className="text-white/80 text-lg mt-2">
                High Five! 🙌
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
