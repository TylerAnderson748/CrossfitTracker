"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiClairePage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [outdoorMode, setOutdoorMode] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Cat Swat Game State
  const [catGameActive, setCatGameActive] = useState(false);
  const [catScore, setCatScore] = useState(0);
  const [catHighScore, setCatHighScore] = useState(0);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [catTimeLeft, setCatTimeLeft] = useState(30);
  const [catsSwatted, setCatsSwatted] = useState(0);

  // Hiking Game State
  const [hikingProgress, setHikingProgress] = useState(0);
  const [hikingActive, setHikingActive] = useState(false);
  const [stepsCount, setStepsCount] = useState(0);
  const [peakReached, setPeakReached] = useState(false);

  // Cat Repellent Counter
  const [repellentSprays, setRepellentSprays] = useState(0);

  // Nature Sounds State
  const [natureSoundPlaying, setNatureSoundPlaying] = useState<string | null>(null);

  // Fun facts about outdoors
  const outdoorFacts = [
    "The longest hiking trail is the Great Trail in Canada at 24,000 km!",
    "Spending 2 hours a week in nature improves health and wellbeing!",
    "There are over 400 national parks in the United States!",
    "The oldest tree in the world is over 5,000 years old!",
    "Hiking burns 400-700 calories per hour!",
    "The Appalachian Trail takes 5-7 months to complete!",
    "Forest bathing (Shinrin-yoku) reduces stress hormones!",
    "Mountains cover 25% of Earth's land surface!",
  ];
  const [currentFact, setCurrentFact] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Cat swat game logic
  useEffect(() => {
    if (catGameActive && catTimeLeft > 0) {
      const catTimer = setInterval(() => {
        setActiveCat(Math.floor(Math.random() * 9));
      }, 900);

      const countdownTimer = setInterval(() => {
        setCatTimeLeft(t => t - 1);
      }, 1000);

      return () => {
        clearInterval(catTimer);
        clearInterval(countdownTimer);
      };
    } else if (catTimeLeft === 0 && catGameActive) {
      setCatGameActive(false);
      setActiveCat(null);
      if (catScore > catHighScore) {
        setCatHighScore(catScore);
        playVictorySound();
      }
    }
  }, [catGameActive, catTimeLeft, catScore, catHighScore]);

  // Sound effects
  const playSwatSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  };

  const playHissSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Create white noise for hiss
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
    filter.frequency.value = 3000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
  };

  const playSpraySound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Spray sound effect
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.4);
  };

  const playStepSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(100 + Math.random() * 50, ctx.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  };

  const playVictorySound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.25);
    });
  };

  const playBirdSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Chirpy bird sound
    [1200, 1400, 1200, 1600, 1200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.08);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.08);
    });
    setNatureSoundPlaying('bird');
    setTimeout(() => setNatureSoundPlaying(null), 600);
  };

  // Game functions
  const startCatGame = () => {
    setCatGameActive(true);
    setCatScore(0);
    setCatTimeLeft(30);
    setCatsSwatted(0);
  };

  const swatCat = (index: number) => {
    if (index === activeCat && catGameActive) {
      playSwatSound();
      playHissSound();
      setCatScore(s => s + 10);
      setCatsSwatted(c => c + 1);
      setActiveCat(null);
    }
  };

  const sprayRepellent = () => {
    playSpraySound();
    setRepellentSprays(s => s + 1);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 1000);
  };

  const startHike = () => {
    setHikingActive(true);
    setHikingProgress(0);
    setStepsCount(0);
    setPeakReached(false);
  };

  const takeStep = useCallback(() => {
    if (!hikingActive || peakReached) return;
    playStepSound();
    setStepsCount(s => s + 1);
    setHikingProgress(prev => {
      const newProgress = Math.min(prev + 5 + Math.random() * 3, 100);
      if (newProgress >= 100 && !peakReached) {
        setPeakReached(true);
        playVictorySound();
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 3000);
      }
      return newProgress;
    });
  }, [hikingActive, peakReached]);

  const showFact = () => {
    const fact = outdoorFacts[Math.floor(Math.random() * outdoorFacts.length)];
    setCurrentFact(fact);
    setTimeout(() => setCurrentFact(null), 5000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900">
        <p className="text-green-300 font-mono text-2xl">Loading the wilderness...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${outdoorMode ? 'animate-nature-bg' : 'bg-gradient-to-br from-green-600 via-emerald-500 to-sky-400'}`}>
      <style jsx global>{`
        @keyframes bounce-happy {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-15px) scale(1.1); }
        }
        @keyframes nature-colors {
          0% { color: #22c55e; }
          25% { color: #0ea5e9; }
          50% { color: #84cc16; }
          75% { color: #14b8a6; }
          100% { color: #22c55e; }
        }
        @keyframes nature-bg {
          0% { background: linear-gradient(135deg, #22c55e, #0ea5e9); }
          50% { background: linear-gradient(135deg, #84cc16, #14b8a6); }
          100% { background: linear-gradient(135deg, #22c55e, #0ea5e9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes shake-cat {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
        @keyframes run-away {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(100px) scale(0.5); opacity: 0; }
        }
        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes letter-wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.8), 0 0 60px rgba(14, 165, 233, 0.4); }
        }
        @keyframes tree-sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        .animate-bounce-happy { animation: bounce-happy 0.6s ease-in-out infinite; }
        .animate-nature-colors { animation: nature-colors 3s linear infinite; }
        .animate-nature-bg { animation: nature-bg 6s linear infinite; }
        .animate-float { animation: float 2.5s ease-in-out infinite; }
        .animate-shake-cat { animation: shake-cat 0.3s ease-in-out; }
        .animate-run-away { animation: run-away 0.4s ease-out forwards; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-tree-sway { animation: tree-sway 3s ease-in-out infinite; }
        .letter-animation {
          display: inline-block;
          animation: letter-wave 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* Floating nature emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🌲', '🏔️', '🌿', '🦋', '🌸', '☀️', '🍃', '⛰️', '🌻', '🦌', '🐿️', '🌈'].map((emoji, i) => (
            <div
              key={i}
              className={`absolute text-3xl ${emoji === '🌲' ? 'animate-tree-sway' : 'animate-float'}`}
              style={{
                left: `${(i * 8) % 100}%`,
                top: `${(i * 11) % 85}%`,
                animationDelay: `${i * 0.25}s`,
                opacity: 0.7,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Fireworks */}
        {showFireworks && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="absolute w-24 h-24 rounded-full animate-firework"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 60}%`,
                  background: `radial-gradient(circle, ${['#22c55e', '#0ea5e9', '#84cc16', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#a855f7'][i]} 0%, transparent 70%)`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-7xl font-black mb-2">
              {'HI CLAIRE!'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="letter-animation inline-block animate-nature-colors"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    textShadow: '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(14, 165, 233, 0.5)',
                  }}
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </span>
              ))}
            </h1>
            <p className="text-xl text-white font-bold">🏔️ OUTDOOR ADVENTURER & CAT NEMESIS 🏔️</p>
            <div className="flex justify-center gap-3 mt-3">
              {['🌲', '🏕️', '🥾', '🚫🐱', '⛰️'].map((e, i) => (
                <span key={i} className="text-4xl animate-bounce-happy" style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Cat Swat Game */}
          <div className="bg-red-900/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-red-400 shadow-2xl">
            <h2 className="text-2xl font-black text-red-300 mb-2 text-center">🚫🐱 SWAT THE CAT! 🚫🐱</h2>
            <p className="text-white/70 text-center mb-3 text-sm">Keep those pesky cats away from your campsite!</p>

            <div className="flex justify-between text-white mb-4">
              <span className="font-bold">Score: {catScore}</span>
              <span className="font-bold">Time: {catTimeLeft}s</span>
              <span className="font-bold">Best: {catHighScore}</span>
            </div>

            {!catGameActive ? (
              <button
                onClick={startCatGame}
                className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-xl font-black rounded-2xl mb-4 transition-all transform hover:scale-105"
              >
                🎯 START SWATTING! 🎯
              </button>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => swatCat(i)}
                  className={`h-20 rounded-2xl text-4xl transition-all transform ${
                    activeCat === i
                      ? 'bg-orange-400 scale-110 animate-shake-cat'
                      : 'bg-red-800 hover:bg-red-700'
                  }`}
                >
                  {activeCat === i ? '😾' : '🕳️'}
                </button>
              ))}
            </div>

            {catTimeLeft === 0 && catScore > 0 && (
              <div className="text-center mt-4">
                <p className="text-2xl font-black text-yellow-300 animate-bounce-happy">
                  🎉 You swatted {catsSwatted} cats! 🎉
                </p>
                {catScore >= catHighScore && catScore > 0 && (
                  <p className="text-green-400 font-bold">NEW HIGH SCORE!</p>
                )}
              </div>
            )}
          </div>

          {/* Cat Repellent Station */}
          <div className="bg-purple-900/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-purple-400 shadow-2xl">
            <h2 className="text-2xl font-black text-purple-300 mb-4 text-center">💨 CAT REPELLENT STATION 💨</h2>

            <div className="text-center mb-4">
              <p className="text-6xl font-black text-white mb-2">{repellentSprays}</p>
              <p className="text-purple-300">Sprays Deployed</p>
            </div>

            <button
              onClick={sprayRepellent}
              className="w-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-2xl font-black rounded-2xl transition-all transform hover:scale-105 active:scale-95"
            >
              💨 SPRAY REPELLENT! 💨
            </button>

            <p className="text-center text-purple-300 mt-3 text-sm">
              Every spray keeps cats 100 miles away! (Especially that one cat 😼)
            </p>
          </div>

          {/* Hiking Adventure */}
          <div className="bg-emerald-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-emerald-400 shadow-2xl">
            <h2 className="text-2xl font-black text-emerald-300 mb-4 text-center">🥾 SUMMIT HIKE! 🥾</h2>

            {!hikingActive ? (
              <button
                onClick={startHike}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xl font-black rounded-2xl mb-4"
              >
                🏔️ START HIKING! 🏔️
              </button>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-white mb-2">
                    <span>🏕️ Base Camp</span>
                    <span>Steps: {stepsCount}</span>
                    <span>⛰️ Summit</span>
                  </div>
                  <div className="h-8 bg-emerald-950 rounded-full overflow-hidden border-2 border-emerald-400">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        peakReached
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`}
                      style={{ width: `${hikingProgress}%` }}
                    >
                      <span className="flex items-center justify-end h-full pr-2 text-lg">
                        {peakReached ? '🏆' : '🥾'}
                      </span>
                    </div>
                  </div>
                </div>

                {!peakReached ? (
                  <button
                    onClick={takeStep}
                    className="w-full py-6 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-2xl font-black rounded-2xl transition-all transform active:scale-95 animate-pulse-glow"
                  >
                    🥾 TAKE A STEP! 🥾
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-3xl font-black text-yellow-300 mb-4 animate-bounce-happy">
                      🏆 SUMMIT REACHED! 🏆
                    </p>
                    <p className="text-white mb-4">You made it in {stepsCount} steps!</p>
                    <button
                      onClick={startHike}
                      className="py-3 px-8 bg-emerald-500 text-white font-bold rounded-xl"
                    >
                      🔄 Hike Again!
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Nature Sounds */}
          <div className="bg-sky-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-sky-400 shadow-2xl">
            <h2 className="text-2xl font-black text-sky-300 mb-4 text-center">🎵 NATURE SOUNDS 🎵</h2>
            <p className="text-white/70 text-center mb-4 text-sm">Relaxing sounds of the outdoors (NO cat noises!)</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { emoji: '🐦', label: 'Birds', action: playBirdSound },
                { emoji: '🌊', label: 'Stream', action: () => { playStepSound(); setNatureSoundPlaying('stream'); setTimeout(() => setNatureSoundPlaying(null), 500); } },
                { emoji: '🌲', label: 'Forest', action: () => { playStepSound(); setNatureSoundPlaying('forest'); setTimeout(() => setNatureSoundPlaying(null), 500); } },
                { emoji: '💨', label: 'Wind', action: () => { playSpraySound(); setNatureSoundPlaying('wind'); setTimeout(() => setNatureSoundPlaying(null), 500); } },
              ].map((sound, i) => (
                <button
                  key={i}
                  onClick={sound.action}
                  className={`p-4 rounded-xl text-center transition-all transform hover:scale-105 ${
                    natureSoundPlaying === sound.label.toLowerCase()
                      ? 'bg-sky-400 scale-105'
                      : 'bg-sky-700 hover:bg-sky-600'
                  }`}
                >
                  <div className="text-4xl mb-1">{sound.emoji}</div>
                  <div className="text-white font-bold text-sm">{sound.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fun Outdoor Fact */}
          <div className="bg-amber-700/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-amber-400 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-300 mb-4 text-center">🌿 OUTDOOR FACTS 🌿</h2>

            <button
              onClick={showFact}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-xl font-black rounded-2xl mb-4"
            >
              🎲 Random Nature Fact!
            </button>

            {currentFact && (
              <div className="bg-white/20 rounded-xl p-4 text-center">
                <p className="text-white text-lg font-medium">{currentFact}</p>
              </div>
            )}
          </div>

          {/* Fun Buttons Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => { playBirdSound(); setShowFireworks(true); setTimeout(() => setShowFireworks(false), 2000); }}
              className="py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-lg font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              🌲 FOREST VIBES 🌲
            </button>
            <button
              onClick={() => setOutdoorMode(!outdoorMode)}
              className="py-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white text-lg font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              {outdoorMode ? '🌈 NATURE MODE!' : '☀️ SUNNY MODE!'}
            </button>
            <button
              onClick={() => { playHissSound(); playSwatSound(); }}
              className="py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              😾 SCARE A CAT! 😾
            </button>
            <button
              onClick={() => { playVictorySound(); setShowFireworks(true); setTimeout(() => setShowFireworks(false), 2000); }}
              className="py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-lg font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              🎉 CELEBRATE! 🎉
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Cats Swatted', value: catsSwatted, emoji: '😾' },
              { label: 'Sprays Used', value: repellentSprays, emoji: '💨' },
              { label: 'Peaks Climbed', value: peakReached ? 1 : 0, emoji: '⛰️' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/20 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-3xl mb-1">{stat.emoji}</div>
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-white/70 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center bg-white/20 backdrop-blur rounded-2xl p-6">
            <p className="text-2xl font-black text-white mb-2">
              🌲 Adventure Awaits! 🌲
            </p>
            <p className="text-white/80">
              The great outdoors is calling... and it's definitely cat-free! 🚫🐱
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {['🏔️', '🌲', '🦋', '☀️', '🥾', '⛺', '🌈'].map((e, i) => (
                <span key={i} className="text-3xl animate-float" style={{ animationDelay: `${i * 0.2}s` }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
