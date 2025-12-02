"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiBlakePage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [glitchMode, setGlitchMode] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [chaosMode, setChaosMode] = useState(false);
  const [lightningFlash, setLightningFlash] = useState(false);
  const [muddyLevel, setMuddyLevel] = useState(0);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prCount, setPrCount] = useState(0);
  const [truckRumble, setTruckRumble] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    // Random lightning flashes
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setLightningFlash(true);
        setTimeout(() => setLightningFlash(false), 100);
        setTimeout(() => {
          setLightningFlash(true);
          setTimeout(() => setLightningFlash(false), 50);
        }, 150);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Random glitch effect
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        setGlitchMode(true);
        setTimeout(() => setGlitchMode(false), 150);
      }
    }, 2000);
    return () => clearInterval(glitchInterval);
  }, []);

  // Muddy level decay
  useEffect(() => {
    if (muddyLevel > 0) {
      const timer = setInterval(() => {
        setMuddyLevel(l => Math.max(l - 1, 0));
      }, 500);
      return () => clearInterval(timer);
    }
  }, [muddyLevel]);

  // Engine revving sound
  const playEngineRevSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Low rumble base
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    // Add some noise for texture
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    noise.start(ctx.currentTime);
  };

  // Mud splash sound
  const playMudSplashSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Splashy sound
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    noise.start(ctx.currentTime);
  };

  // Epic truck horn + engine PR celebration
  const playPRCelebration = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // BIG truck horn
    [180, 220, 280].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
    });

    // Epic engine rev sequence
    setTimeout(() => {
      if (!audioContextRef.current) return;
      const ctx2 = audioContextRef.current;

      // Rising engine
      [60, 80, 100, 140, 180, 220].forEach((freq, i) => {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.connect(gain);
        gain.connect(ctx2.destination);
        osc.frequency.value = freq;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.15, ctx2.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + i * 0.15 + 0.2);
        osc.start(ctx2.currentTime + i * 0.15);
        osc.stop(ctx2.currentTime + i * 0.15 + 0.3);
      });

      // Add engine noise
      const bufferSize = ctx2.sampleRate * 1.0;
      const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx2.createBufferSource();
      const noiseGain = ctx2.createGain();
      const filter = ctx2.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      noise.buffer = buffer;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx2.destination);
      noiseGain.gain.setValueAtTime(0.1, ctx2.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.8);
      noise.start(ctx2.currentTime);
    }, 300);
  };

  const triggerPRCelebration = () => {
    setShowPRCelebration(true);
    setPrCount(c => c + 1);
    setTruckRumble(true);
    playPRCelebration();
    setTimeout(() => {
      setShowPRCelebration(false);
      setTruckRumble(false);
    }, 4000);
  };

  const handleClick = () => {
    setClickCount((c) => c + 1);
    if (clickCount >= 4) {
      setChaosMode(!chaosMode);
      setClickCount(0);
    }
  };

  const hitTheMud = () => {
    playEngineRevSound();
    setTimeout(() => playMudSplashSound(), 200);
    const newLevel = Math.min(muddyLevel + 15, 100);
    setMuddyLevel(newLevel);
    if (newLevel === 100 && muddyLevel < 100) {
      triggerPRCelebration();
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-red-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black ${lightningFlash ? 'bg-white' : ''} transition-colors duration-75 ${truckRumble ? 'animate-truck-rumble' : ''}`}>
      <style jsx global>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          41% { opacity: 1; }
          42% { opacity: 0.8; }
          43% { opacity: 1; }
          45% { opacity: 0.3; }
          46% { opacity: 1; }
        }

        @keyframes blood-drip {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        @keyframes float-ghost {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0.3; }
          25% { transform: translateY(-30px) translateX(20px) rotate(5deg); opacity: 0.5; }
          50% { transform: translateY(-10px) translateX(-20px) rotate(-5deg); opacity: 0.2; }
          75% { transform: translateY(-40px) translateX(10px) rotate(3deg); opacity: 0.4; }
        }

        @keyframes pulse-red {
          0%, 100% { text-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000; }
          50% { text-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff0000, 0 0 80px #ff0000; }
        }

        @keyframes glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-3px, 3px); }
          40% { transform: translate(-3px, -3px); }
          60% { transform: translate(3px, 3px); }
          80% { transform: translate(3px, -3px); }
          100% { transform: translate(0); }
        }

        @keyframes shake-violent {
          0%, 100% { transform: translateX(0) rotate(0); }
          10% { transform: translateX(-10px) rotate(-5deg); }
          20% { transform: translateX(10px) rotate(5deg); }
          30% { transform: translateX(-10px) rotate(-5deg); }
          40% { transform: translateX(10px) rotate(5deg); }
          50% { transform: translateX(-10px) rotate(-5deg); }
          60% { transform: translateX(10px) rotate(5deg); }
          70% { transform: translateX(-10px) rotate(-5deg); }
          80% { transform: translateX(10px) rotate(5deg); }
          90% { transform: translateX(-10px) rotate(-5deg); }
        }

        @keyframes rise-from-below {
          0% { transform: translateY(100px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes creepy-hover {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.05) rotate(1deg); }
          50% { transform: scale(0.95) rotate(-1deg); }
          75% { transform: scale(1.02) rotate(0.5deg); }
        }

        @keyframes scan-line {
          0% { top: 0%; }
          100% { top: 100%; }
        }

        @keyframes truck-bounce {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          25% { transform: translateY(-15px) rotate(2deg); }
          50% { transform: translateY(-5px) rotate(-1deg); }
          75% { transform: translateY(-10px) rotate(1deg); }
        }

        @keyframes mud-splatter {
          0% { transform: scale(0) translateY(0); opacity: 1; }
          50% { transform: scale(1.5) translateY(-30px); opacity: 0.8; }
          100% { transform: scale(2) translateY(20px); opacity: 0; }
        }

        @keyframes tire-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes dust-cloud {
          0% { transform: scale(0.5) translateX(0); opacity: 0.8; }
          100% { transform: scale(2) translateX(50px); opacity: 0; }
        }

        @keyframes truck-rumble {
          0%, 100% { transform: translateX(0) translateY(0); }
          10% { transform: translateX(-3px) translateY(-2px); }
          20% { transform: translateX(3px) translateY(2px); }
          30% { transform: translateX(-2px) translateY(-1px); }
          40% { transform: translateX(2px) translateY(1px); }
          50% { transform: translateX(-3px) translateY(-2px); }
          60% { transform: translateX(3px) translateY(2px); }
          70% { transform: translateX(-2px) translateY(-1px); }
          80% { transform: translateX(2px) translateY(1px); }
          90% { transform: translateX(-1px) translateY(-1px); }
        }

        @keyframes pr-truck-zoom {
          0% { transform: scale(0) rotate(-20deg) translateX(-100px); opacity: 0; }
          50% { transform: scale(1.2) rotate(10deg) translateX(20px); opacity: 1; }
          75% { transform: scale(0.95) rotate(-5deg) translateX(-10px); opacity: 1; }
          100% { transform: scale(1) rotate(0deg) translateX(0); opacity: 1; }
        }

        @keyframes pr-mud-rain {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(180deg); opacity: 0; }
        }

        @keyframes pr-engine-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(139, 69, 19, 0.5), 0 0 60px rgba(255, 165, 0, 0.3); }
          50% { box-shadow: 0 0 60px rgba(139, 69, 19, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 0, 0, 0.3); }
        }

        .animate-flicker { animation: flicker 3s infinite; }
        .animate-blood-drip { animation: blood-drip 4s linear infinite; }
        .animate-float-ghost { animation: float-ghost 6s ease-in-out infinite; }
        .animate-pulse-red { animation: pulse-red 2s ease-in-out infinite; }
        .animate-glitch { animation: glitch 0.3s infinite; }
        .animate-shake-violent { animation: shake-violent 0.5s infinite; }
        .animate-rise { animation: rise-from-below 1s ease-out forwards; }
        .animate-creepy-hover { animation: creepy-hover 4s ease-in-out infinite; }
        .animate-truck-bounce { animation: truck-bounce 0.8s ease-in-out infinite; }
        .animate-mud-splatter { animation: mud-splatter 0.6s ease-out forwards; }
        .animate-tire-spin { animation: tire-spin 0.3s linear infinite; }
        .animate-dust-cloud { animation: dust-cloud 1s ease-out forwards; }
        .animate-truck-rumble { animation: truck-rumble 0.15s ease-in-out infinite; }
        .animate-pr-truck-zoom { animation: pr-truck-zoom 0.8s ease-out forwards; }
        .animate-pr-mud-rain { animation: pr-mud-rain 2s ease-out forwards; }
        .animate-pr-engine-glow { animation: pr-engine-glow 0.4s ease-in-out infinite; }

        .scan-line::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(255, 0, 0, 0.3);
          animation: scan-line 3s linear infinite;
        }

        .letter-sinister {
          display: inline-block;
          animation: creepy-hover 2s ease-in-out infinite;
        }

        .vignette {
          box-shadow: inset 0 0 150px rgba(0,0,0,0.9);
        }

        .blood-text {
          background: linear-gradient(180deg, #8B0000 0%, #FF0000 50%, #8B0000 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .mud-gradient {
          background: linear-gradient(180deg, #3d2914 0%, #5c4033 30%, #8B4513 50%, #654321 100%);
        }
      `}</style>

      <Navigation />

      <main className={`max-w-4xl mx-auto px-4 py-8 relative overflow-hidden vignette min-h-screen ${glitchMode ? 'animate-glitch' : ''} ${chaosMode ? 'animate-shake-violent' : ''}`}>
        {/* Scan line effect */}
        <div className="fixed inset-0 pointer-events-none scan-line" />

        {/* Floating skulls/trucks/ghosts background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['💀', '🛻', '🦇', '🏔️', '⚰️', '🔥', '😈', '🖤', '☠️', '🌑', '🚙', '⛰️'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-float-ghost opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${5 + Math.random() * 3}s`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Blood/mud drips */}
        <div className="fixed top-0 left-0 right-0 pointer-events-none overflow-hidden h-full">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 animate-blood-drip rounded-b-full"
              style={{
                left: `${10 + i * 12}%`,
                height: '100px',
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
                background: i % 2 === 0
                  ? 'linear-gradient(to bottom, #8B4513, #654321, transparent)'
                  : 'linear-gradient(to bottom, #8B0000, #ff0000, transparent)',
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-10">
          {/* Giant sinister title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-4 cursor-pointer select-none animate-pulse-red"
            onClick={handleClick}
          >
            {'HI BLAKE...'.split('').map((letter, i) => (
              <span
                key={i}
                className="letter-sinister inline-block text-red-600"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  textShadow: '0 0 20px #ff0000, 0 0 40px #8B0000, 2px 2px 0 #000',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          {/* Creepy subtitle */}
          <p className="text-xl text-amber-700 mb-6 font-mono animate-flicker">
            🛻 OFF-ROAD MONSTER 🛻
          </p>

          {/* MUDDY METER */}
          <div className="bg-gradient-to-b from-amber-950 to-stone-900 rounded-3xl p-6 mb-6 border-4 border-amber-800 shadow-2xl">
            <h2 className="text-xl font-black text-amber-500 mb-4">🛻 MUDDY METER 🛻</h2>
            <div className="w-full bg-stone-800 rounded-full h-8 mb-4 overflow-hidden border-2 border-amber-700">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  muddyLevel >= 70 ? 'bg-gradient-to-r from-amber-700 via-orange-600 to-red-700 animate-pulse' :
                  muddyLevel >= 40 ? 'bg-gradient-to-r from-amber-800 to-amber-600' :
                  'bg-gradient-to-r from-amber-900 to-amber-700'
                }`}
                style={{ width: `${muddyLevel}%` }}
              />
            </div>
            <p className="text-2xl font-black text-amber-500">
              {muddyLevel}% {muddyLevel >= 70 && '🔥 FULL SEND!'} {muddyLevel === 100 && '💥 BEAST MODE!'}
            </p>
          </div>

          {/* 4x4 action button */}
          <button
            onClick={hitTheMud}
            className={`px-12 py-6 text-2xl font-black rounded-xl mb-6 transition-all transform hover:scale-110 border-4 ${
              muddyLevel >= 70
                ? 'bg-gradient-to-r from-amber-700 via-orange-600 to-red-700 border-yellow-500 text-black animate-truck-bounce'
                : 'bg-gradient-to-r from-amber-900 to-stone-800 border-amber-700 text-amber-400'
            }`}
          >
            🛻 HIT THE MUD 🛻
          </button>

          {/* Sinister emoji row with trucks */}
          <div className="flex justify-center gap-4 mb-8">
            {['💀', '🛻', '⚡', '🔥', '🏔️', '☠️'].map((emoji, i) => (
              <span
                key={i}
                className={`text-5xl ${i === 1 ? 'animate-truck-bounce' : 'animate-creepy-hover'}`}
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {emoji}
              </span>
            ))}
          </div>

          {/* 4x4 Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Horsepower', value: '666', emoji: '🐴' },
              { label: 'Torque', value: 'MAX', emoji: '⚙️' },
              { label: 'Mud Cleared', value: '∞', emoji: '🌊' },
              { label: 'Trails', value: '999', emoji: '🏔️' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-stone-900/80 backdrop-blur rounded-2xl p-4 border-2 border-amber-800 animate-rise"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-3xl mb-1">{stat.emoji}</div>
                <div className="text-2xl font-black text-amber-500">{stat.value}</div>
                <div className="text-stone-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Dark card */}
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-red-900 shadow-2xl shadow-red-900/50 animate-rise">
            <p className="text-2xl md:text-3xl font-bold text-red-500 mb-4 animate-flicker">
              Welcome to the dark side... 😈
            </p>
            <p className="text-lg text-gray-400">
              Click the title 5 times if you dare...
            </p>
            {clickCount > 0 && (
              <p className="text-red-400 mt-2 font-mono">
                {5 - clickCount} clicks until chaos...
              </p>
            )}
          </div>

          {/* Sinister buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setChaosMode(!chaosMode)}
              className="px-8 py-4 bg-gradient-to-r from-red-900 to-black text-red-500 font-bold text-xl rounded-full hover:scale-110 transition-transform shadow-2xl shadow-red-900/50 border border-red-800 animate-creepy-hover"
            >
              {chaosMode ? '🌀 CHAOS ACTIVE' : '💀 Unleash Chaos'}
            </button>

            <button
              onClick={() => {
                setLightningFlash(true);
                setTimeout(() => setLightningFlash(false), 100);
              }}
              className="px-8 py-4 bg-gradient-to-r from-purple-900 to-black text-purple-400 font-bold text-xl rounded-full hover:scale-110 transition-transform shadow-2xl shadow-purple-900/50 border border-purple-800 animate-creepy-hover"
              style={{ animationDelay: '0.5s' }}
            >
              ⚡ Summon Lightning
            </button>
          </div>

          {/* PR Counter */}
          {prCount > 0 && (
            <div className="mt-8 bg-gradient-to-r from-amber-800 via-orange-700 to-red-800 rounded-2xl p-4 text-center border-4 border-amber-600">
              <p className="text-xl font-black text-white drop-shadow-lg">
                🛻 TRAILS CONQUERED: {prCount} 🛻
              </p>
            </div>
          )}

          {/* Ominous message */}
          <div className="mt-8 p-6 bg-black/80 border border-red-900 rounded-xl">
            <p className="text-amber-500 font-mono text-lg animate-flicker">
              &quot;When the road ends, the adventure begins...&quot;
            </p>
            <p className="text-gray-600 text-sm mt-2">- Off-Road Proverb</p>
          </div>

          {/* Creepy scrolling text */}
          <div className="mt-8 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee-slow">
              <span className="text-2xl text-amber-900/60 mx-8">🛻 FULL SEND 🛻</span>
              <span className="text-2xl text-red-900/60 mx-8">💀 EMBRACE THE DARKNESS 💀</span>
              <span className="text-2xl text-amber-900/60 mx-8">🔥 GET MUDDY 🔥</span>
              <span className="text-2xl text-red-900/60 mx-8">⚡ BLAKE MODE ⚡</span>
              <span className="text-2xl text-amber-900/60 mx-8">🛻 FULL SEND 🛻</span>
            </div>
          </div>
        </div>

        {/* PR Celebration Overlay */}
        {showPRCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Mud and truck emoji rain */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(60)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl animate-pr-mud-rain"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-50px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  {['🛻', '🏔️', '💀', '🔥', '⚡', '🚙', '⛰️', '💨', '🌊', '☠️'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration card */}
            <div className="bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 rounded-3xl p-8 animate-pr-truck-zoom animate-pr-engine-glow text-center max-w-md mx-4 border-4 border-amber-600">
              <div className="text-8xl mb-4 animate-truck-bounce">🛻</div>
              <h2 className="text-4xl font-black text-amber-500 mb-2 drop-shadow-lg">
                TRAIL CONQUERED!
              </h2>
              <p className="text-2xl font-black text-orange-400 mb-4">
                🔥 MAXIMUM MUD ACHIEVED! 🔥
              </p>
              <div className="flex justify-center gap-2 text-4xl mb-4">
                {['🏔️', '💪', '🛻', '⚡', '🔥'].map((emoji, i) => (
                  <span key={i} className="animate-truck-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-lg text-stone-400">
                BEAST MODE UNLOCKED!
              </p>
              <p className="text-amber-600 text-sm mt-2 font-bold">
                &quot;SEND IT!&quot;
              </p>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes marquee-slow {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee-slow {
          animation: marquee-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
