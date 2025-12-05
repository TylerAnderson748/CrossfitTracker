"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiDanPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [raceMode, setRaceMode] = useState(false);
  const [hypeLevel, setHypeLevel] = useState(0);
  const [showSubmissionCelebration, setShowSubmissionCelebration] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [riderStats, setRiderStats] = useState({ roczen: 0, tomac: 0, anderson: 0 });
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
    }, 4000);
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

  // Dirt bike engine rev sound
  const playRevSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Create engine-like sound with oscillators
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.frequency.setValueAtTime(80, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    osc1.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);
    osc1.type = 'sawtooth';

    osc2.frequency.setValueAtTime(160, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.3);
    osc2.type = 'square';

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
  };

  // Submission tap sound
  const playTapSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [200, 300, 400].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.1);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.1);
    });
  };

  // Victory celebration sound - supercross podium
  const playVictorySound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Epic victory melody
    const melody = [
      { freq: 523, time: 0, duration: 0.15 },
      { freq: 659, time: 0.15, duration: 0.15 },
      { freq: 784, time: 0.3, duration: 0.15 },
      { freq: 1047, time: 0.45, duration: 0.25 },
      { freq: 880, time: 0.7, duration: 0.15 },
      { freq: 1047, time: 0.85, duration: 0.35 },
    ];

    melody.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
  };

  const triggerSubmissionCelebration = () => {
    setShowSubmissionCelebration(true);
    setTapCount(c => c + 1);
    playVictorySound();
    setTimeout(() => setShowSubmissionCelebration(false), 4000);
  };

  const handleClick = () => {
    setClickCount((c) => c + 1);
    if (clickCount >= 4) {
      setRaceMode(!raceMode);
      setClickCount(0);
    }
  };

  const addHype = () => {
    playRevSound();
    setComboCount(c => c + 1);
    const newLevel = Math.min(hypeLevel + 12, 100);
    setHypeLevel(newLevel);
    if (newLevel >= 70) {
      playTapSound();
    }
    if (newLevel === 100 && hypeLevel < 100) {
      triggerSubmissionCelebration();
    }
  };

  const voteForRider = (rider: 'roczen' | 'tomac' | 'anderson') => {
    setSelectedRider(rider);
    setRiderStats(prev => ({ ...prev, [rider]: prev[rider] + 1 }));
    playRevSound();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-orange-400 font-mono">Loading the track...</p>
      </div>
    );
  }

  const riders = [
    { id: 'roczen', name: 'Ken Roczen', number: '94', flag: '🇩🇪', color: 'from-red-500 to-yellow-500', bgColor: 'bg-red-600' },
    { id: 'tomac', name: 'Eli Tomac', number: '1', flag: '🇺🇸', color: 'from-green-500 to-blue-500', bgColor: 'bg-green-600' },
    { id: 'anderson', name: 'Jason Anderson', number: '21', flag: '🇺🇸', color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-600' },
  ];

  return (
    <div className={`min-h-screen ${raceMode ? 'animate-race-bg' : 'bg-gradient-to-br from-orange-600 via-red-600 to-black'}`}>
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

        @keyframes race-colors {
          0% { color: #ff6600; }
          25% { color: #ff0000; }
          50% { color: #ffcc00; }
          75% { color: #ff3300; }
          100% { color: #ff6600; }
        }

        @keyframes race-bg {
          0% { background: linear-gradient(45deg, #ff6600, #cc0000); }
          25% { background: linear-gradient(45deg, #cc0000, #000000); }
          50% { background: linear-gradient(45deg, #000000, #ff6600); }
          75% { background: linear-gradient(45deg, #ff6600, #ffcc00); }
          100% { background: linear-gradient(45deg, #ffcc00, #ff6600); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(0) translateX(-10px); }
          75% { transform: translateY(-10px) translateX(5px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,102,0,0.5); }
          50% { box-shadow: 0 0 60px rgba(255,102,0,0.9), 0 0 100px rgba(255,0,0,0.5); }
        }

        @keyframes letter-wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }

        @keyframes bike-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-2deg); }
          20%, 40%, 60%, 80% { transform: translateX(5px) rotate(2deg); }
        }

        @keyframes dirt-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 102, 0, 0.5), 0 0 40px rgba(139, 69, 19, 0.3); }
          50% { box-shadow: 0 0 40px rgba(255, 102, 0, 0.8), 0 0 80px rgba(139, 69, 19, 0.5), 0 0 120px rgba(255, 165, 0, 0.3); }
        }

        @keyframes bjj-roll {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(90deg); }
          50% { transform: rotate(180deg); }
          75% { transform: rotate(270deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes submission-zoom {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          75% { transform: scale(0.9) rotate(-5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes confetti-fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        @keyframes victory-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 102, 0, 0.3); }
          50% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 102, 0, 0.5), 0 0 180px rgba(255, 0, 0, 0.3); }
        }

        @keyframes whip-it {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          25% { transform: rotate(-30deg) translateX(-20px); }
          75% { transform: rotate(30deg) translateX(20px); }
        }

        .animate-bounce-crazy { animation: bounce-crazy 1s ease-in-out infinite; }
        .animate-spin-wobble { animation: spin-wobble 0.5s ease-in-out infinite; }
        .animate-race-colors { animation: race-colors 2s linear infinite; }
        .animate-race-bg { animation: race-bg 3s linear infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-bike-shake { animation: bike-shake 0.5s ease-in-out infinite; }
        .animate-dirt-glow { animation: dirt-glow 2s ease-in-out infinite; }
        .animate-bjj-roll { animation: bjj-roll 3s linear infinite; }
        .animate-submission-zoom { animation: submission-zoom 0.8s ease-out forwards; }
        .animate-confetti-fall { animation: confetti-fall 2s ease-out forwards; }
        .animate-victory-glow { animation: victory-glow 0.4s ease-in-out infinite; }
        .animate-whip-it { animation: whip-it 0.6s ease-in-out infinite; }

        .letter-animation {
          display: inline-block;
          animation: letter-wave 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-8 relative overflow-hidden">
        {/* Floating background elements - MX and BJJ themed */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🏍️', '🥋', '🏆', '🔥', '💪', '🏁', '🥇', '⚡', '🤼', '🏅', '🦅', '💨'].map((emoji, i) => (
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
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-32 rounded-full animate-firework"
                style={{
                  left: `${15 + Math.random() * 70}%`,
                  top: `${15 + Math.random() * 50}%`,
                  background: `radial-gradient(circle, ${['#ff6600', '#ff0000', '#ffcc00', '#ff3300', '#ffa500', '#cc0000'][i]} 0%, transparent 70%)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 text-center pt-6">
          {/* Giant animated title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-4 cursor-pointer select-none"
            onClick={handleClick}
          >
            {'HI DAN!'.split('').map((letter, i) => (
              <span
                key={i}
                className="letter-animation inline-block animate-race-colors"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  textShadow: '0 0 20px rgba(255,102,0,0.8), 0 0 40px rgba(255,0,0,0.5)',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          <p className="text-xl text-white/80 mb-4 font-bold tracking-wider">
            🏍️ SUPERCROSS LEGEND & BJJ WARRIOR 🥋
          </p>

          {/* Dual Theme Banner */}
          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3 rounded-full text-white font-black text-lg animate-pulse-glow">
              🏁 SUPERCROSS 🏁
            </div>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 rounded-full text-white font-black text-lg animate-pulse-glow">
              🥋 JIU-JITSU 🥋
            </div>
          </div>

          {/* HYPE METER */}
          <div className="bg-gray-900/80 backdrop-blur rounded-3xl p-6 mb-6 animate-dirt-glow border-2 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-orange-400 font-mono">🔥 SEND IT METER 🔥</h2>
              {comboCount > 3 && (
                <span className="text-yellow-400 font-black animate-pulse">
                  {comboCount}x WHIP COMBO!
                </span>
              )}
            </div>
            <div className="w-full bg-gray-800 rounded-full h-8 mb-4 overflow-hidden border-2 border-orange-600">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  hypeLevel >= 70 ? 'bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 animate-pulse' :
                  hypeLevel >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                  'bg-gradient-to-r from-orange-600 to-orange-400'
                }`}
                style={{ width: `${hypeLevel}%` }}
              />
            </div>
            <p className="text-2xl font-black text-orange-400 font-mono">
              {hypeLevel}% {hypeLevel >= 70 && '🔥 FULL THROTTLE!'} {hypeLevel === 100 && '💥 HOLESHOT!'}
            </p>
          </div>

          {/* Rev button with bike animation */}
          <button
            onClick={addHype}
            className={`px-12 py-6 text-2xl font-black rounded-xl mb-6 transition-all transform hover:scale-110 border-4 ${
              hypeLevel >= 70
                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 border-white text-black animate-bike-shake'
                : 'bg-gradient-to-r from-orange-600 to-red-600 border-orange-400 text-white'
            }`}
          >
            🏍️ REV IT UP! 🏍️
          </button>

          {/* Rider Voting Section */}
          <div className="bg-black/60 backdrop-blur rounded-3xl p-6 mb-6 border-2 border-yellow-500">
            <h2 className="text-2xl font-black text-yellow-400 mb-4">🏆 GOAT VOTE 🏆</h2>
            <p className="text-white/70 mb-4">Who&apos;s taking the checkered flag?</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {riders.map((rider) => (
                <button
                  key={rider.id}
                  onClick={() => voteForRider(rider.id as 'roczen' | 'tomac' | 'anderson')}
                  className={`p-4 rounded-xl border-3 transition-all transform hover:scale-105 ${
                    selectedRider === rider.id
                      ? `bg-gradient-to-r ${rider.color} border-white animate-pulse`
                      : `${rider.bgColor} border-gray-600 hover:border-white`
                  }`}
                >
                  <div className="text-4xl mb-2">{rider.flag}</div>
                  <div className="text-3xl font-black text-white">#{rider.number}</div>
                  <div className="text-lg font-bold text-white">{rider.name}</div>
                  <div className="text-yellow-300 text-sm mt-2">
                    Votes: {riderStats[rider.id as keyof typeof riderStats]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* BJJ Section */}
          <div className="bg-gradient-to-r from-blue-900/80 to-purple-900/80 backdrop-blur rounded-3xl p-6 mb-6 border-2 border-blue-400">
            <h2 className="text-2xl font-black text-blue-300 mb-4">🥋 OSS! BJJ ZONE 🥋</h2>
            <div className="flex justify-center gap-4 mb-4">
              {['🤼', '🥋', '💪', '🏆', '🔥'].map((emoji, i) => (
                <span
                  key={i}
                  className="text-5xl animate-bounce-crazy"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  {emoji}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { move: 'Armbar', emoji: '💪' },
                { move: 'Triangle', emoji: '🔺' },
                { move: 'Rear Naked', emoji: '🐍' },
                { move: 'Guillotine', emoji: '⚔️' },
              ].map((sub, i) => (
                <div
                  key={i}
                  className="bg-blue-800/60 rounded-xl p-4 border border-blue-400 animate-float cursor-pointer hover:bg-blue-700/60 transition-all"
                  style={{ animationDelay: `${i * 0.2}s` }}
                  onClick={triggerSubmissionCelebration}
                >
                  <div className="text-3xl mb-2">{sub.emoji}</div>
                  <div className="text-white font-bold">{sub.move}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bouncing emoji row */}
          <div className="flex justify-center gap-4 mb-8">
            {['🏍️', '🥋', '🏆', '🔥', '💪', '🏁'].map((emoji, i) => (
              <span
                key={i}
                className={`text-5xl ${i % 2 === 0 ? 'animate-bounce-crazy' : 'animate-whip-it'}`}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {emoji}
              </span>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Moto Wins', value: '∞', emoji: '🏆' },
              { label: 'Submissions', value: tapCount.toString(), emoji: '🥋' },
              { label: 'Whips', value: '999', emoji: '🏍️' },
              { label: 'OSS Level', value: 'MAX', emoji: '🔥' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-gray-900/60 backdrop-blur rounded-2xl p-4 border-2 border-orange-500 animate-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-3xl mb-1">{stat.emoji}</div>
                <div className="text-2xl font-black text-orange-400 font-mono">{stat.value}</div>
                <div className="text-white/70 text-sm font-mono">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Mode toggle buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setRaceMode(!raceMode)}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-xl rounded-full hover:scale-110 transition-transform animate-float shadow-2xl"
            >
              {raceMode ? '🏁 RACE MODE ON!' : '🏍️ Activate Race Mode'}
            </button>

            <button
              onClick={() => setShowFireworks(true)}
              className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-xl rounded-full hover:scale-110 transition-transform animate-float shadow-2xl"
              style={{ animationDelay: '0.5s' }}
            >
              🎆 Podium Celebration!
            </button>
          </div>

          {/* Counter */}
          {tapCount > 0 && (
            <div className="mt-8 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-2xl p-4 text-center border-4 border-white">
              <p className="text-xl font-black text-white drop-shadow-lg font-mono">
                🏆 SUBMISSIONS: {tapCount} | TAPS COLLECTED 🥋
              </p>
            </div>
          )}

          {/* Scrolling marquee */}
          <div className="mt-12 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee">
              <span className="text-2xl text-white/80 mx-8">🏍️ BRAAAP! 🏍️</span>
              <span className="text-2xl text-white/80 mx-8">🥋 OSS! 🥋</span>
              <span className="text-2xl text-white/80 mx-8">🏆 ROCZEN 94! 🏆</span>
              <span className="text-2xl text-white/80 mx-8">💪 TOMAC 1! 💪</span>
              <span className="text-2xl text-white/80 mx-8">🔥 ANDERSON 21! 🔥</span>
              <span className="text-2xl text-white/80 mx-8">🏁 SEND IT! 🏁</span>
            </div>
          </div>

          {clickCount > 0 && (
            <p className="text-white/70 mt-4">
              Clicks: {clickCount}/5 to Race Mode!
            </p>
          )}
        </div>

        {/* Submission Celebration Overlay */}
        {showSubmissionCelebration && (
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
                  {['🏍️', '🥋', '🏆', '🔥', '💪', '🏁', '🥇', '⭐', '🦅', '💨'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration card */}
            <div className="bg-gradient-to-br from-gray-900 via-orange-900 to-gray-900 rounded-3xl p-8 animate-submission-zoom animate-victory-glow text-center max-w-md mx-4 border-4 border-yellow-400">
              <div className="text-8xl mb-4 animate-bounce-crazy">🏆</div>
              <h2 className="text-4xl font-black text-yellow-400 mb-2 drop-shadow-lg">
                TAP! TAP! TAP!
              </h2>
              <p className="text-2xl font-bold text-orange-300 mb-4">
                🥋 SUBMISSION VICTORY! 🥋
              </p>
              <div className="flex justify-center gap-2 text-4xl mb-4">
                {['🏍️', '🥋', '🏆', '🔥', '💪'].map((emoji, i) => (
                  <span key={i} className="animate-bounce-crazy" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-lg text-white/80">
                LIKE A HOLESHOT INTO AN ARMBAR!
              </p>
              <p className="text-orange-400 text-sm mt-2 font-bold">
                &quot;BRAAAP! OSS!&quot;
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
          animation: marquee 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
