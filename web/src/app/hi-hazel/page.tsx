"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiHazelPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(true);
  const [partyMode, setPartyMode] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Birthday counters
  const [candlesBlown, setCandlesBlown] = useState(0);
  const [wishesMAde, setWishesMade] = useState(0);
  const [presentsOpened, setPresentsOpened] = useState(0);

  // Quesadilla Game
  const [quesadillasMade, setQuesadillasMade] = useState(0);
  const [currentToppings, setCurrentToppings] = useState<string[]>([]);
  const [meatballCount, setMeatballCount] = useState(0);

  // Balloon Pop Game
  const [balloons, setBalloons] = useState<boolean[]>([true, true, true, true, true, true, true, true, true]);
  const [popScore, setPopScore] = useState(0);

  // Birthday Countdown
  const [birthdayMessage, setBirthdayMessage] = useState<string | null>(null);

  const birthdayMessages = [
    "🎂 HAPPY BIRTHDAY HAZEL! 🎂",
    "🌟 You're a STAR! 🌟",
    "🎈 Party time! 🎈",
    "🎁 Make a wish! 🎁",
    "✨ You're amazing! ✨",
    "🎉 Best birthday ever! 🎉",
    "💖 So special! 💖",
    "🦄 Magical day! 🦄",
  ];

  const toppingOptions = ['🧀', '🍖', '🌶️', '🧅', '🍅', '🥬'];

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Auto fireworks for birthday!
  useEffect(() => {
    const interval = setInterval(() => {
      if (partyMode) {
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 1500);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [partyMode]);

  // Sound effects
  const playPopSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  };

  const playWhooshSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.5);
  };

  const playCelebrationSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Happy birthday melody snippet
    [262, 262, 294, 262, 349, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.14);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.14);
    });
  };

  const playSizzleSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
  };

  const blowCandle = () => {
    playWhooshSound();
    setCandlesBlown(c => c + 1);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 1000);
  };

  const makeWish = () => {
    playCelebrationSound();
    setWishesMade(w => w + 1);
    const msg = birthdayMessages[Math.floor(Math.random() * birthdayMessages.length)];
    setBirthdayMessage(msg);
    setShowFireworks(true);
    setTimeout(() => {
      setShowFireworks(false);
      setBirthdayMessage(null);
    }, 3000);
  };

  const openPresent = () => {
    playPopSound();
    setPresentsOpened(p => p + 1);
    setShowFireworks(true);
    playCelebrationSound();
    setTimeout(() => setShowFireworks(false), 2000);
  };

  const addTopping = (topping: string) => {
    playSizzleSound();
    setCurrentToppings([...currentToppings, topping]);
  };

  const addMeatball = () => {
    playSizzleSound();
    setMeatballCount(m => m + 1);
    setCurrentToppings([...currentToppings, '🧆']);
  };

  const makeQuesadilla = () => {
    if (currentToppings.length === 0 && meatballCount === 0) return;

    playCelebrationSound();
    setQuesadillasMade(q => q + 1);
    setCurrentToppings([]);
    setMeatballCount(0);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 2000);
  };

  const popBalloon = (index: number) => {
    if (!balloons[index]) return;

    playPopSound();
    const newBalloons = [...balloons];
    newBalloons[index] = false;
    setBalloons(newBalloons);
    setPopScore(s => s + 10);

    if (newBalloons.every(b => !b)) {
      playCelebrationSound();
      setShowFireworks(true);
      setTimeout(() => {
        setBalloons([true, true, true, true, true, true, true, true, true]);
        setShowFireworks(false);
      }, 3000);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-500">
        <p className="text-white font-mono text-2xl">🎂 Getting the party ready... 🎂</p>
      </div>
    );
  }

  const balloonColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-cyan-500', 'bg-rose-500'];

  return (
    <div className={`min-h-screen ${partyMode ? 'animate-party-bg' : 'bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500'}`}>
      <style jsx global>{`
        @keyframes party-bg {
          0% { background: linear-gradient(135deg, #ec4899, #8b5cf6); }
          25% { background: linear-gradient(135deg, #f59e0b, #ef4444); }
          50% { background: linear-gradient(135deg, #10b981, #3b82f6); }
          75% { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
          100% { background: linear-gradient(135deg, #ec4899, #8b5cf6); }
        }
        @keyframes bounce-party {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-25px) scale(1.2); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes confetti {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.5), 0 0 40px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.8), 0 0 80px rgba(139, 92, 246, 0.5); }
        }
        @keyframes sizzle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-party-bg { animation: party-bg 8s linear infinite; }
        .animate-bounce-party { animation: bounce-party 0.8s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
        .animate-sparkle { animation: sparkle 1s ease-in-out infinite; }
        .animate-confetti { animation: confetti 3s ease-out forwards; }
        .animate-float { animation: float 2s ease-in-out infinite; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-sizzle { animation: sizzle 0.3s ease-in-out infinite; }
        .letter-animation {
          display: inline-block;
          animation: bounce-party 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* Floating party emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🎂', '🎈', '🎁', '🎉', '✨', '🌟', '🧆', '🌮', '💖', '🦄', '🎀', '🍰'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-float"
              style={{
                left: `${(i * 8) % 100}%`,
                top: `${(i * 11) % 85}%`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.7,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Confetti */}
        {showFireworks && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute text-2xl animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              >
                {['🎊', '🎉', '✨', '⭐', '🎈', '💖', '🌟'][i % 7]}
              </div>
            ))}
          </div>
        )}

        {/* Birthday Message Overlay */}
        {birthdayMessage && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-3xl p-8 animate-bounce-party shadow-2xl border-4 border-white">
              <p className="text-4xl font-black text-white text-center">{birthdayMessage}</p>
            </div>
          </div>
        )}

        <div className="relative z-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-7xl font-black mb-2">
              {'HAPPY BIRTHDAY'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="letter-animation inline-block"
                  style={{
                    animationDelay: `${i * 0.08}s`,
                    color: ['#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'][i % 6],
                    textShadow: '0 0 20px rgba(255,255,255,0.8)',
                  }}
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </span>
              ))}
            </h1>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4" style={{ textShadow: '0 0 30px rgba(236, 72, 153, 0.8)' }}>
              HAZEL! 🎂
            </h2>
            <div className="flex justify-center gap-3 mt-3">
              {['🎂', '🎈', '🎁', '🧆', '🎉'].map((e, i) => (
                <span key={i} className="text-5xl animate-bounce-party" style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Birthday Candles */}
          <div className="bg-pink-600/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-pink-300 shadow-2xl animate-pulse-glow">
            <h2 className="text-2xl font-black text-pink-100 mb-4 text-center">🕯️ BLOW OUT THE CANDLES! 🕯️</h2>

            <div className="flex justify-center gap-2 mb-4">
              {[...Array(Math.min(candlesBlown + 5, 10))].map((_, i) => (
                <div key={i} className="text-4xl animate-wiggle" style={{ animationDelay: `${i * 0.1}s` }}>
                  {i < candlesBlown ? '💨' : '🕯️'}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={blowCandle}
                className="py-4 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
              >
                💨 BLOW! ({candlesBlown})
              </button>
              <button
                onClick={makeWish}
                className="py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
              >
                ⭐ MAKE A WISH! ⭐
              </button>
            </div>
          </div>

          {/* Meatball Quesadilla Maker */}
          <div className="bg-orange-600/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-orange-300 shadow-2xl">
            <h2 className="text-2xl font-black text-orange-100 mb-4 text-center">🧆 MEATBALL QUESADILLA MAKER 🧆</h2>
            <p className="text-center text-orange-200 mb-4">Hazel's favorite! Add toppings and EXTRA MEATBALLS!</p>

            {/* Current quesadilla */}
            <div className="bg-yellow-400 rounded-full h-32 mb-4 flex items-center justify-center relative overflow-hidden border-4 border-yellow-600">
              <span className="text-6xl">🌮</span>
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-4">
                {currentToppings.map((t, i) => (
                  <span key={i} className="text-2xl animate-sizzle" style={{ animationDelay: `${i * 0.1}s` }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {toppingOptions.map((topping, i) => (
                <button
                  key={i}
                  onClick={() => addTopping(topping)}
                  className="py-3 bg-yellow-500 hover:bg-yellow-400 rounded-xl text-2xl transition-all transform hover:scale-110"
                >
                  {topping}
                </button>
              ))}
              <button
                onClick={addMeatball}
                className="py-3 bg-red-500 hover:bg-red-400 rounded-xl text-2xl transition-all transform hover:scale-110 col-span-2 animate-pulse"
              >
                🧆 MEATBALL! 🧆
              </button>
            </div>

            <button
              onClick={makeQuesadilla}
              disabled={currentToppings.length === 0}
              className={`w-full py-4 text-xl font-black rounded-2xl transition-all ${
                currentToppings.length > 0
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transform hover:scale-105'
                  : 'bg-gray-400 text-gray-200'
              }`}
            >
              🔥 COOK IT! ({quesadillasMade} made) 🔥
            </button>
          </div>

          {/* Balloon Pop */}
          <div className="bg-blue-600/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-blue-300 shadow-2xl">
            <h2 className="text-2xl font-black text-blue-100 mb-4 text-center">🎈 POP THE BALLOONS! 🎈</h2>
            <p className="text-center text-white mb-2">Score: {popScore}</p>

            <div className="grid grid-cols-3 gap-3">
              {balloons.map((balloon, i) => (
                <button
                  key={i}
                  onClick={() => popBalloon(i)}
                  className={`h-20 rounded-full text-4xl transition-all transform ${
                    balloon
                      ? `${balloonColors[i]} hover:scale-110 animate-float`
                      : 'bg-gray-700'
                  }`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {balloon ? '🎈' : '💥'}
                </button>
              ))}
            </div>
          </div>

          {/* Open Presents */}
          <div className="bg-purple-600/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-purple-300 shadow-2xl">
            <h2 className="text-2xl font-black text-purple-100 mb-4 text-center">🎁 OPEN PRESENTS! 🎁</h2>

            <div className="flex justify-center gap-4 mb-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`text-5xl ${i < presentsOpened ? '' : 'animate-wiggle'}`}>
                  {i < presentsOpened ? '✨' : '🎁'}
                </div>
              ))}
            </div>

            <button
              onClick={openPresent}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
            >
              🎁 UNWRAP A PRESENT! ({presentsOpened}) 🎁
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Candles', value: candlesBlown, emoji: '🕯️' },
              { label: 'Wishes', value: wishesMAde, emoji: '⭐' },
              { label: 'Quesadillas', value: quesadillasMade, emoji: '🧆' },
              { label: 'Presents', value: presentsOpened, emoji: '🎁' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/20 backdrop-blur rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <div className="text-xl font-black text-white">{stat.value}</div>
                <div className="text-white/70 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Party Mode Toggle */}
          <button
            onClick={() => setPartyMode(!partyMode)}
            className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white text-xl font-black rounded-2xl mb-6 transform hover:scale-105 transition-all"
          >
            {partyMode ? '🎉 PARTY MODE: ON! 🎉' : '✨ ACTIVATE PARTY MODE! ✨'}
          </button>

          {/* Footer */}
          <div className="text-center bg-white/20 backdrop-blur rounded-2xl p-6">
            <p className="text-3xl font-black text-white mb-2">
              🎂 HAPPY BIRTHDAY HAZEL! 🎂
            </p>
            <p className="text-white/90 text-xl">
              Hope you get ALL the meatball quesadillas! 🧆💖
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {['🎂', '🎈', '🧆', '🎁', '✨', '💖', '🌟'].map((e, i) => (
                <span key={i} className="text-3xl animate-bounce-party" style={{ animationDelay: `${i * 0.1}s` }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
