"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiChappyPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [beerMode, setBeerMode] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Beer Counter
  const [beersCollected, setBeersCollected] = useState(0);
  const [cheersCount, setCheersCount] = useState(0);

  // Fishing Game
  const [fishingActive, setFishingActive] = useState(false);
  const [fishCaught, setFishCaught] = useState(0);
  const [currentFish, setCurrentFish] = useState<string | null>(null);
  const [fishingResult, setFishingResult] = useState<string | null>(null);

  // Campfire Stories
  const [currentStory, setCurrentStory] = useState<string | null>(null);

  // Beer Pong Game
  const [pongScore, setPongScore] = useState(0);
  const [pongCups, setPongCups] = useState([true, true, true, true, true, true]);
  const [pongStreak, setPongStreak] = useState(0);

  // Trail Progress
  const [trailProgress, setTrailProgress] = useState(0);
  const [trailMiles, setTrailMiles] = useState(0);

  const fishTypes = ['🐟', '🐠', '🐡', '🦈', '🐋', '🦑', '🦐', '🦞'];
  const fishNames = ['Trout', 'Tropical Fish', 'Blowfish', 'SHARK!', 'WHALE!', 'Squid', 'Shrimp', 'Lobster'];

  const campfireStories = [
    "So there I was, face to face with a bear... holding my last beer. The bear looked at me, I looked at the bear... we both cracked one open. 🐻🍺",
    "Legend says if you finish a 6-pack before sunset, the mountains whisper your name. I've heard them twice. 🏔️",
    "The fish was THIS big! *spreads arms wide* ...okay maybe it was a minnow, but it put up a fight! 🐟",
    "One time I hiked 20 miles just to find out the brewery was closed. Worst day of my life. 🥾😢",
    "They say the best beer is the one you earn after a long hike. They're absolutely right. 🍺⛰️",
    "I once saw a squirrel steal my trail mix. Chased it for a mile. Worth it. 🐿️",
  ];

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Sound effects
  const playGlugSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [300, 350, 300, 400, 300].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.06);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.06);
    });
  };

  const playCheersSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Clink sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 2000;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  };

  const playSplashSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
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
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  };

  const collectBeer = () => {
    playGlugSound();
    setBeersCollected(b => b + 1);
    if ((beersCollected + 1) % 6 === 0) {
      setShowFireworks(true);
      playVictorySound();
      setTimeout(() => setShowFireworks(false), 2000);
    }
  };

  const cheers = () => {
    playCheersSound();
    setCheersCount(c => c + 1);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 1000);
  };

  const goFishing = () => {
    setFishingActive(true);
    setCurrentFish(null);
    setFishingResult(null);

    setTimeout(() => {
      const fishIndex = Math.floor(Math.random() * fishTypes.length);
      setCurrentFish(fishTypes[fishIndex]);
      setFishingResult(`You caught a ${fishNames[fishIndex]}!`);
      setFishCaught(f => f + 1);
      playSplashSound();
      setFishingActive(false);

      if (fishIndex >= 3) {
        setShowFireworks(true);
        playVictorySound();
        setTimeout(() => setShowFireworks(false), 2000);
      }
    }, 1500 + Math.random() * 1500);
  };

  const tellStory = () => {
    const story = campfireStories[Math.floor(Math.random() * campfireStories.length)];
    setCurrentStory(story);
  };

  const throwBall = (cupIndex: number) => {
    if (!pongCups[cupIndex]) return;

    const hit = Math.random() > 0.4;
    if (hit) {
      playSplashSound();
      const newCups = [...pongCups];
      newCups[cupIndex] = false;
      setPongCups(newCups);
      setPongScore(s => s + 10);
      setPongStreak(s => s + 1);

      if (newCups.every(c => !c)) {
        setShowFireworks(true);
        playVictorySound();
        setTimeout(() => {
          setShowFireworks(false);
          setPongCups([true, true, true, true, true, true]);
        }, 3000);
      }
    } else {
      setPongStreak(0);
    }
  };

  const hike = () => {
    const distance = 0.5 + Math.random() * 1.5;
    setTrailMiles(m => m + distance);
    setTrailProgress(p => Math.min(p + 10 + Math.random() * 10, 100));

    if (trailProgress >= 90) {
      setShowFireworks(true);
      playVictorySound();
      setTimeout(() => {
        setShowFireworks(false);
        setTrailProgress(0);
      }, 3000);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-900">
        <p className="text-amber-300 font-mono text-2xl">🍺 Pouring a cold one... 🍺</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${beerMode ? 'animate-beer-bg' : 'bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-500'}`}>
      <style jsx global>{`
        @keyframes bounce-beer {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes beer-colors {
          0% { color: #f59e0b; }
          33% { color: #ea580c; }
          66% { color: #ca8a04; }
          100% { color: #f59e0b; }
        }
        @keyframes beer-bg {
          0% { background: linear-gradient(135deg, #f59e0b, #ea580c); }
          50% { background: linear-gradient(135deg, #ca8a04, #c2410c); }
          100% { background: linear-gradient(135deg, #f59e0b, #ea580c); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes bubble {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-50px) scale(0.5); opacity: 0; }
        }
        @keyframes pour {
          0% { height: 0%; }
          100% { height: 80%; }
        }
        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes fish-swim {
          0%, 100% { transform: translateX(0) scaleX(1); }
          50% { transform: translateX(20px) scaleX(-1); }
        }
        @keyframes campfire {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          50% { transform: scale(1.1) rotate(2deg); }
        }
        .animate-bounce-beer { animation: bounce-beer 1s ease-in-out infinite; }
        .animate-beer-colors { animation: beer-colors 2s linear infinite; }
        .animate-beer-bg { animation: beer-bg 4s linear infinite; }
        .animate-float { animation: float 2s ease-in-out infinite; }
        .animate-bubble { animation: bubble 1s ease-out forwards; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-fish-swim { animation: fish-swim 2s ease-in-out infinite; }
        .animate-campfire { animation: campfire 0.5s ease-in-out infinite; }
        .letter-animation {
          display: inline-block;
          animation: float 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* Floating emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🍺', '🏕️', '🎣', '⛺', '🌲', '🍻', '🥾', '🔥', '🐟', '🏔️', '🌙', '⭐'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-float"
              style={{
                left: `${(i * 8) % 100}%`,
                top: `${(i * 11) % 85}%`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.6,
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
                  background: `radial-gradient(circle, ${['#f59e0b', '#ea580c', '#ca8a04', '#fbbf24', '#f97316', '#eab308', '#fb923c', '#facc15', '#fdba74', '#fde047'][i]} 0%, transparent 70%)`,
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
              {'HI CHAPPY!'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="letter-animation inline-block animate-beer-colors"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    textShadow: '0 0 20px rgba(245, 158, 11, 0.8), 0 0 40px rgba(234, 88, 12, 0.5)',
                  }}
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </span>
              ))}
            </h1>
            <p className="text-xl text-white font-bold">🍺 OUTDOOR LEGEND & BEER CONNOISSEUR 🍺</p>
            <div className="flex justify-center gap-3 mt-3">
              {['🍺', '🏕️', '🎣', '🔥', '🍻'].map((e, i) => (
                <span key={i} className="text-4xl animate-bounce-beer" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Beer Collection */}
          <div className="bg-amber-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-amber-400 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-300 mb-4 text-center">🍺 BEER COLLECTION 🍺</h2>

            <div className="text-center mb-4">
              <p className="text-6xl font-black text-white mb-2">{beersCollected}</p>
              <p className="text-amber-300">Beers Collected</p>
              <p className="text-amber-400 text-sm mt-1">
                {6 - (beersCollected % 6)} more until 6-pack bonus!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={collectBeer}
                className="py-6 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105 active:scale-95"
              >
                🍺 GRAB A BEER! 🍺
              </button>
              <button
                onClick={cheers}
                className="py-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105 active:scale-95"
              >
                🍻 CHEERS! ({cheersCount}) 🍻
              </button>
            </div>
          </div>

          {/* Fishing Game */}
          <div className="bg-blue-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-blue-400 shadow-2xl">
            <h2 className="text-2xl font-black text-blue-300 mb-4 text-center">🎣 GONE FISHING 🎣</h2>

            <div className="text-center mb-4">
              <p className="text-white mb-2">Fish Caught: <span className="text-2xl font-black text-yellow-300">{fishCaught}</span></p>

              {currentFish && (
                <div className="my-4">
                  <span className="text-6xl animate-fish-swim inline-block">{currentFish}</span>
                  <p className="text-yellow-300 font-bold mt-2">{fishingResult}</p>
                </div>
              )}
            </div>

            <button
              onClick={goFishing}
              disabled={fishingActive}
              className={`w-full py-4 text-xl font-black rounded-2xl transition-all ${
                fishingActive
                  ? 'bg-gray-500 text-gray-300'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white transform hover:scale-105'
              }`}
            >
              {fishingActive ? '🎣 Waiting for a bite...' : '🎣 CAST YOUR LINE! 🎣'}
            </button>
          </div>

          {/* Beer Pong */}
          <div className="bg-red-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-red-400 shadow-2xl">
            <h2 className="text-2xl font-black text-red-300 mb-4 text-center">🏓 BEER PONG 🏓</h2>

            <div className="flex justify-between text-white mb-4">
              <span>Score: {pongScore}</span>
              <span>Streak: {pongStreak}🔥</span>
            </div>

            <div className="flex justify-center gap-2 mb-4">
              {pongCups.slice(0, 3).map((cup, i) => (
                <button
                  key={i}
                  onClick={() => throwBall(i)}
                  className={`w-16 h-20 rounded-b-full text-3xl transition-all transform hover:scale-110 ${
                    cup ? 'bg-red-500 hover:bg-red-400' : 'bg-gray-700'
                  }`}
                >
                  {cup ? '🍺' : ''}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2">
              {pongCups.slice(3, 6).map((cup, i) => (
                <button
                  key={i + 3}
                  onClick={() => throwBall(i + 3)}
                  className={`w-16 h-20 rounded-b-full text-3xl transition-all transform hover:scale-110 ${
                    cup ? 'bg-red-500 hover:bg-red-400' : 'bg-gray-700'
                  }`}
                >
                  {cup ? '🍺' : ''}
                </button>
              ))}
            </div>
            <p className="text-center text-red-300 mt-4 text-sm">Click cups to throw! 40% chance to sink it!</p>
          </div>

          {/* Trail Progress */}
          <div className="bg-green-800/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-green-400 shadow-2xl">
            <h2 className="text-2xl font-black text-green-300 mb-4 text-center">🥾 TRAIL TRACKER 🥾</h2>

            <div className="mb-4">
              <div className="flex justify-between text-white mb-2">
                <span>🏕️ Camp</span>
                <span>{trailMiles.toFixed(1)} miles</span>
                <span>🍺 Beer Stop</span>
              </div>
              <div className="h-6 bg-green-950 rounded-full overflow-hidden border-2 border-green-400">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all"
                  style={{ width: `${trailProgress}%` }}
                />
              </div>
            </div>

            <button
              onClick={hike}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
            >
              🥾 KEEP HIKING! 🥾
            </button>
          </div>

          {/* Campfire Stories */}
          <div className="bg-orange-900/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-orange-400 shadow-2xl">
            <h2 className="text-2xl font-black text-orange-300 mb-4 text-center">
              <span className="animate-campfire inline-block">🔥</span> CAMPFIRE STORIES <span className="animate-campfire inline-block">🔥</span>
            </h2>

            <button
              onClick={tellStory}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xl font-black rounded-2xl mb-4 transition-all transform hover:scale-105"
            >
              📖 TELL A STORY! 📖
            </button>

            {currentStory && (
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <p className="text-white text-lg italic">{currentStory}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Beers', value: beersCollected, emoji: '🍺' },
              { label: 'Cheers', value: cheersCount, emoji: '🍻' },
              { label: 'Fish', value: fishCaught, emoji: '🐟' },
              { label: 'Miles', value: trailMiles.toFixed(1), emoji: '🥾' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/20 backdrop-blur rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <div className="text-xl font-black text-white">{stat.value}</div>
                <div className="text-white/70 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Fun Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setBeerMode(!beerMode)}
              className="py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-lg font-black rounded-2xl transform hover:scale-105"
            >
              {beerMode ? '🍺 BEER MODE!' : '🌅 SUNSET MODE!'}
            </button>
            <button
              onClick={() => { playVictorySound(); setShowFireworks(true); setTimeout(() => setShowFireworks(false), 2000); }}
              className="py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-black rounded-2xl transform hover:scale-105"
            >
              🎉 CELEBRATE! 🎉
            </button>
          </div>

          {/* Footer */}
          <div className="text-center bg-white/20 backdrop-blur rounded-2xl p-6">
            <p className="text-2xl font-black text-white mb-2">
              🍺 Life's Better Outdoors (With Beer) 🍺
            </p>
            <p className="text-white/80">
              Here's to cold beers, warm campfires, and great adventures! 🏕️
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {['🍺', '🏕️', '🎣', '🔥', '🍻', '🥾', '⛺'].map((e, i) => (
                <span key={i} className="text-3xl animate-float" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
