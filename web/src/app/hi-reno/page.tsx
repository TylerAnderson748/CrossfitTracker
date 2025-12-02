"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiRenoPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [metalLevel, setMetalLevel] = useState(0);
  const [brutalMode, setBrutalMode] = useState(false);
  const [flameIntensity, setFlameIntensity] = useState(1);
  const [headbangCount, setHeadbangCount] = useState(0);
  const [earthquakeMode, setEarthquakeMode] = useState(false);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prCount, setPrCount] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Heavy distorted guitar sound
  const playMetalRiff = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Create distortion
    const distortion = ctx.createWaveShaper();
    const makeDistortionCurve = (amount: number) => {
      const k = typeof amount === 'number' ? amount : 50;
      const samples = 44100;
      const curve = new Float32Array(samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < samples; ++i) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    };
    distortion.curve = makeDistortionCurve(400);
    distortion.oversample = '4x';

    // Power chord (root + fifth)
    const frequencies = [82.41, 123.47, 164.81]; // E2 power chord
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(distortion);
      distortion.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.setValueAtTime(freq * 0.99, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime + i * 0.02);
      osc.stop(ctx.currentTime + 0.5);
    });
  }, []);

  // Brutal growl/bass drop sound
  const playBrutalDrop = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    // Add some noise
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.1, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    noise.start(ctx.currentTime);
  }, []);

  // Double bass drum sound
  const playDoubleBass = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [0, 0.1, 0.2, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(150, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + delay + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.1);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.1);
    });
  }, []);

  // BRUTAL PR CELEBRATION - Epic metal breakdown
  const playPRCelebration = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Create heavy distortion
    const distortion = ctx.createWaveShaper();
    const makeDistortionCurve = (amount: number) => {
      const k = amount;
      const samples = 44100;
      const curve = new Float32Array(samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < samples; ++i) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    };
    distortion.curve = makeDistortionCurve(800);
    distortion.oversample = '4x';

    // EPIC breakdown riff - descending power chords
    const breakdown = [
      { freqs: [82.41, 123.47], time: 0, duration: 0.3 },     // E2
      { freqs: [77.78, 116.54], time: 0.35, duration: 0.3 },  // Eb2
      { freqs: [73.42, 110.00], time: 0.7, duration: 0.3 },   // D2
      { freqs: [65.41, 98.00], time: 1.05, duration: 0.5 },   // C2 - CHUG
      { freqs: [65.41, 98.00], time: 1.6, duration: 0.15 },   // C2
      { freqs: [65.41, 98.00], time: 1.8, duration: 0.15 },   // C2
      { freqs: [65.41, 98.00], time: 2.0, duration: 0.8 },    // C2 - HOLD
    ];

    breakdown.forEach(({ freqs, time, duration }) => {
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + duration + 0.1);
      });
    });

    // Add brutal double bass drums
    [...Array(12)].forEach((_, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const time = i * 0.15;
      osc.frequency.setValueAtTime(120, ctx.currentTime + time);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + time + 0.08);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.1);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.1);
    });

    // Add noise burst for extra brutality
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    noise.buffer = buffer;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    noise.start(ctx.currentTime);
  }, []);

  const triggerPRCelebration = useCallback(() => {
    setShowPRCelebration(true);
    setPrCount(c => c + 1);
    setEarthquakeMode(true);
    setFlameIntensity(5);
    playPRCelebration();
    setTimeout(() => {
      setShowPRCelebration(false);
      setEarthquakeMode(false);
    }, 4000);
  }, [playPRCelebration]);

  const headbang = () => {
    playMetalRiff();
    setHeadbangCount(c => c + 1);
    const newLevel = Math.min(metalLevel + 15, 100);
    setMetalLevel(newLevel);
    if (newLevel >= 70) {
      setBrutalMode(true);
      playBrutalDrop();
    }
    if (newLevel === 100 && metalLevel < 100) {
      triggerPRCelebration();
    }
  };

  const unleashBrutality = () => {
    setBrutalMode(true);
    setEarthquakeMode(true);
    playBrutalDrop();
    playDoubleBass();
    setFlameIntensity(3);
    setTimeout(() => setEarthquakeMode(false), 2000);
  };

  useEffect(() => {
    if (metalLevel > 0) {
      const timer = setInterval(() => {
        setMetalLevel(l => Math.max(l - 2, 0));
        if (metalLevel < 40) setBrutalMode(false);
      }, 800);
      return () => clearInterval(timer);
    }
  }, [metalLevel]);

  // Random flame flickers
  useEffect(() => {
    const interval = setInterval(() => {
      setFlameIntensity(1 + Math.random() * (brutalMode ? 2 : 0.5));
    }, 200);
    return () => clearInterval(interval);
  }, [brutalMode]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-red-600 font-black text-2xl animate-pulse">SUMMONING THE DARKNESS...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black ${earthquakeMode ? 'animate-earthquake' : ''}`}>
      <style jsx global>{`
        @keyframes flame-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.8; }
          25% { transform: scaleY(1.1) scaleX(0.9); opacity: 1; }
          50% { transform: scaleY(0.9) scaleX(1.1); opacity: 0.7; }
          75% { transform: scaleY(1.05) scaleX(0.95); opacity: 0.9; }
        }

        @keyframes headbang {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-30deg); }
          75% { transform: rotate(30deg); }
        }

        @keyframes metal-pulse {
          0%, 100% {
            text-shadow: 0 0 10px #ff0000, 0 0 20px #ff4400, 0 0 30px #ff0000, 0 0 40px #880000;
            transform: scale(1);
          }
          50% {
            text-shadow: 0 0 20px #ff0000, 0 0 40px #ff4400, 0 0 60px #ff0000, 0 0 80px #880000, 0 0 100px #ff0000;
            transform: scale(1.02);
          }
        }

        @keyframes blood-drip-reno {
          0% { height: 0; opacity: 1; }
          80% { height: 150px; opacity: 1; }
          100% { height: 200px; opacity: 0; }
        }

        @keyframes pentagram-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes earthquake {
          0%, 100% { transform: translateX(0) translateY(0); }
          10% { transform: translateX(-10px) translateY(-5px); }
          20% { transform: translateX(10px) translateY(5px); }
          30% { transform: translateX(-8px) translateY(-3px); }
          40% { transform: translateX(8px) translateY(3px); }
          50% { transform: translateX(-6px) translateY(-4px); }
          60% { transform: translateX(6px) translateY(4px); }
          70% { transform: translateX(-4px) translateY(-2px); }
          80% { transform: translateX(4px) translateY(2px); }
          90% { transform: translateX(-2px) translateY(-1px); }
        }

        @keyframes skull-float {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }

        @keyframes lightning-bolt {
          0%, 90%, 100% { opacity: 0; }
          92%, 94%, 96% { opacity: 1; }
          93%, 95%, 97% { opacity: 0; }
        }

        @keyframes brutal-text {
          0% { letter-spacing: 0px; }
          50% { letter-spacing: 5px; }
          100% { letter-spacing: 0px; }
        }

        @keyframes inferno {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes demon-eyes {
          0%, 90%, 100% { opacity: 0.3; }
          95% { opacity: 1; }
        }

        @keyframes chain-swing {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        @keyframes pr-brutal-zoom {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          30% { transform: scale(1.5) rotate(15deg); opacity: 1; }
          50% { transform: scale(0.9) rotate(-5deg); opacity: 1; }
          70% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes pr-fire-rain {
          0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }

        @keyframes pr-skull-spin {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.3); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(1.3); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @keyframes pr-blood-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(255, 0, 0, 0.5), 0 0 60px rgba(255, 68, 0, 0.3); }
          50% { box-shadow: 0 0 80px rgba(255, 0, 0, 0.8), 0 0 150px rgba(255, 68, 0, 0.5), 0 0 200px rgba(255, 0, 0, 0.3); }
        }

        @keyframes pr-metal-flash {
          0%, 100% { background: linear-gradient(45deg, #1a0000, #330000, #1a0000); }
          25% { background: linear-gradient(45deg, #ff0000, #ff4400, #ff0000); }
          50% { background: linear-gradient(45deg, #330000, #660000, #330000); }
          75% { background: linear-gradient(45deg, #ff4400, #ff8800, #ff4400); }
        }

        .animate-flame-flicker { animation: flame-flicker 0.3s ease-in-out infinite; }
        .animate-headbang { animation: headbang 0.3s ease-in-out infinite; }
        .animate-metal-pulse { animation: metal-pulse 1s ease-in-out infinite; }
        .animate-blood-drip-reno { animation: blood-drip-reno 3s ease-in-out infinite; }
        .animate-pentagram-spin { animation: pentagram-spin 10s linear infinite; }
        .animate-earthquake { animation: earthquake 0.5s ease-in-out infinite; }
        .animate-skull-float { animation: skull-float 3s ease-in-out infinite; }
        .animate-lightning { animation: lightning-bolt 4s ease-in-out infinite; }
        .animate-brutal-text { animation: brutal-text 2s ease-in-out infinite; }
        .animate-inferno { animation: inferno 3s ease infinite; background-size: 200% 200%; }
        .animate-demon-eyes { animation: demon-eyes 3s ease-in-out infinite; }
        .animate-chain-swing { animation: chain-swing 2s ease-in-out infinite; }
        .animate-pr-brutal-zoom { animation: pr-brutal-zoom 0.8s ease-out forwards; }
        .animate-pr-fire-rain { animation: pr-fire-rain 2s ease-out forwards; }
        .animate-pr-skull-spin { animation: pr-skull-spin 1s ease-in-out infinite; }
        .animate-pr-blood-pulse { animation: pr-blood-pulse 0.3s ease-in-out infinite; }
        .animate-pr-metal-flash { animation: pr-metal-flash 0.2s ease-in-out infinite; }

        .metal-gradient {
          background: linear-gradient(180deg, #1a0000 0%, #330000 30%, #1a0000 50%, #000000 100%);
        }

        .fire-gradient {
          background: linear-gradient(0deg, #ff0000, #ff4400, #ff8800, #ffcc00);
        }

        .chrome-text {
          background: linear-gradient(180deg, #ffffff 0%, #aaaaaa 45%, #333333 50%, #aaaaaa 55%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <Navigation />

      <main className={`max-w-4xl mx-auto px-4 py-8 relative overflow-hidden min-h-screen metal-gradient ${brutalMode ? 'animate-earthquake' : ''}`}>
        {/* Lightning effects */}
        <div className="fixed inset-0 pointer-events-none animate-lightning bg-white/10" />

        {/* Flames at bottom */}
        <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute bottom-0 w-12 animate-flame-flicker"
              style={{
                left: `${i * 5}%`,
                height: `${60 + Math.random() * 40}px`,
                background: 'linear-gradient(0deg, #ff4400, #ff8800, #ffcc00, transparent)',
                borderRadius: '50% 50% 0 0',
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `scaleY(${flameIntensity})`,
              }}
            />
          ))}
        </div>

        {/* Floating skulls and metal symbols */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['💀', '🤘', '⚡', '🔥', '👹', '⛓️', '🦇', '☠️', '🎸', '🖤'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-skull-float opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 80}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Blood drips */}
        <div className="fixed top-0 left-0 right-0 pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute top-0 w-2 bg-gradient-to-b from-red-800 via-red-600 to-transparent animate-blood-drip-reno rounded-b-full"
              style={{
                left: `${5 + i * 6.5}%`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>

        {/* Spinning pentagram background */}
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div className="text-[300px] animate-pentagram-spin">⛧</div>
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-16">
          {/* BRUTAL title */}
          <h1
            className={`text-6xl md:text-8xl font-black mb-4 cursor-pointer select-none ${brutalMode ? 'animate-brutal-text' : ''}`}
            onClick={headbang}
          >
            {'HI RENO...'.split('').map((letter, i) => (
              <span
                key={i}
                className={`inline-block animate-metal-pulse ${brutalMode ? 'animate-headbang' : ''}`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  color: '#ff0000',
                  textShadow: '0 0 10px #ff0000, 0 0 20px #880000, 3px 3px 0 #000',
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="text-2xl text-gray-400 mb-8 font-black tracking-widest animate-demon-eyes">
            🤘 WELCOME TO THE PIT 🤘
          </p>

          {/* Metal level meter */}
          <div className="bg-black/80 border-4 border-red-900 rounded-xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-orange-900/20 to-red-900/20 animate-inferno" />
            <h2 className="text-xl font-black text-red-500 mb-4 relative z-10">🔥 METAL LEVEL 🔥</h2>
            <div className="w-full bg-gray-900 rounded-full h-8 mb-4 overflow-hidden border-2 border-red-800 relative z-10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  metalLevel > 70 ? 'animate-inferno bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500' :
                  metalLevel > 40 ? 'bg-gradient-to-r from-red-700 to-red-500' :
                  'bg-gradient-to-r from-red-900 to-red-700'
                }`}
                style={{ width: `${metalLevel}%` }}
              />
            </div>
            <p className="text-3xl font-black text-red-500 relative z-10">
              {metalLevel}% {brutalMode && '💀 BRUTAL MODE 💀'}
            </p>
            <p className="text-gray-500 mt-2 relative z-10">Headbangs: {headbangCount} 🤘</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <button
              onClick={headbang}
              className={`px-10 py-5 text-xl font-black rounded-xl transition-all transform hover:scale-110 border-4 ${
                brutalMode
                  ? 'bg-gradient-to-r from-red-600 via-orange-500 to-red-600 border-yellow-500 text-black animate-pulse'
                  : 'bg-gradient-to-r from-gray-900 to-black border-red-800 text-red-500 hover:border-red-500'
              }`}
            >
              🤘 HEADBANG 🤘
            </button>

            <button
              onClick={unleashBrutality}
              className="px-10 py-5 text-xl font-black rounded-xl bg-gradient-to-r from-black via-red-900 to-black border-4 border-red-600 text-red-500 hover:scale-110 transition-transform hover:border-red-400"
            >
              ⚡ UNLEASH BRUTALITY ⚡
            </button>

            <button
              onClick={playDoubleBass}
              className="px-10 py-5 text-xl font-black rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 border-4 border-gray-600 text-gray-300 hover:scale-110 transition-transform hover:border-gray-400"
            >
              🥁 DOUBLE BASS 🥁
            </button>
          </div>

          {/* Metal stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'BRUTALITY', value: 'MAX', emoji: '💀' },
              { label: 'SHRED LVL', value: '∞', emoji: '🎸' },
              { label: 'HEAVINESS', value: '666', emoji: '🔥' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-black/80 border-2 border-red-900 rounded-xl p-6 animate-skull-float"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-3xl font-black text-red-500 animate-metal-pulse">{stat.value}</div>
                <div className="text-gray-500 text-sm font-bold tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Band name generator */}
          <div className="bg-gradient-to-b from-gray-900 via-black to-gray-900 border-4 border-red-800 rounded-xl p-8 mb-8">
            <h3 className="text-2xl font-black text-red-500 mb-4">🎸 RENO&apos;S METAL MANTRAS 🎸</h3>
            <div className="space-y-3">
              {[
                '"Pain is just weakness leaving the body... BRUTALLY"',
                '"Lift heavy or die trying"',
                '"Every rep is a battle cry"',
                '"Rest days are for the weak"',
              ].map((quote, i) => (
                <p key={i} className="text-gray-400 font-bold italic text-lg animate-demon-eyes" style={{ animationDelay: `${i * 0.5}s` }}>
                  {quote}
                </p>
              ))}
            </div>
          </div>

          {/* Chains decoration */}
          <div className="flex justify-center gap-8 mb-8">
            {['⛓️', '⛓️', '⛓️', '⛓️', '⛓️'].map((chain, i) => (
              <span
                key={i}
                className="text-4xl animate-chain-swing opacity-60"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {chain}
              </span>
            ))}
          </div>

          {/* Footer message */}
          <div className="bg-black border-2 border-red-900 rounded-xl p-6">
            <p className="text-red-600 font-black text-xl tracking-widest">
              🤘 STAY METAL, STAY BRUTAL 🤘
            </p>
            <p className="text-gray-600 text-sm mt-2">Click the title to headbang. The more you bang, the more brutal it gets.</p>
          </div>

          {/* PR Counter */}
          {prCount > 0 && (
            <div className="mt-8 bg-gradient-to-r from-red-900 via-orange-600 to-red-900 rounded-2xl p-4 text-center border-4 border-red-600">
              <p className="text-xl font-black text-white drop-shadow-lg">
                💀 BRUTAL PRs: {prCount} 💀
              </p>
            </div>
          )}
        </div>

        {/* PR Celebration Overlay */}
        {showPRCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-pr-metal-flash">
            {/* Fire and skull rain */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(60)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl animate-pr-fire-rain"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-100px',
                    animationDelay: `${Math.random() * 0.8}s`,
                    animationDuration: `${1.5 + Math.random() * 1.5}s`,
                  }}
                >
                  {['🔥', '💀', '⚡', '☠️', '🤘', '🎸', '👹', '⛓️', '🦇', '💥'][i % 10]}
                </div>
              ))}
            </div>

            {/* Main celebration card */}
            <div className="bg-gradient-to-br from-black via-red-950 to-black rounded-3xl p-8 animate-pr-brutal-zoom animate-pr-blood-pulse text-center max-w-md mx-4 border-4 border-red-600">
              <div className="text-8xl mb-4 animate-pr-skull-spin">💀</div>
              <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-lg animate-metal-pulse">
                BRUTAL PR!
              </h2>
              <p className="text-2xl font-black text-orange-500 mb-4 tracking-widest">
                🔥 MAXIMUM METAL ACHIEVED 🔥
              </p>
              <div className="flex justify-center gap-2 text-4xl mb-4">
                {['🤘', '⚡', '🎸', '💀', '🔥'].map((emoji, i) => (
                  <span key={i} className="animate-headbang" style={{ animationDelay: `${i * 0.1}s` }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <p className="text-lg text-gray-400 font-black tracking-widest">
                YOU ARE UNSTOPPABLE
              </p>
              <p className="text-red-600 text-sm mt-2 font-bold">
                &quot;PAIN IS TEMPORARY, METAL IS FOREVER&quot;
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
