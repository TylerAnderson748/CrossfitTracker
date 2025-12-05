"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiAspenPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [magicMode, setMagicMode] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Princess Collection
  const [tiarasCollected, setTiarasCollected] = useState(0);
  const [wanedWaves, setWandWaves] = useState(0);
  const [sparklesCreated, setSparklesCreated] = useState(0);

  // SpongeBob Game
  const [jellyfishCaught, setJellyfishCaught] = useState(0);
  const [activeJellyfish, setActiveJellyfish] = useState<number | null>(null);
  const [jellyGameActive, setJellyGameActive] = useState(false);
  const [jellyTimeLeft, setJellyTimeLeft] = useState(20);

  // Princess Dress Up
  const [currentDress, setCurrentDress] = useState('👗');
  const [currentCrown, setCurrentCrown] = useState('👑');
  const [currentShoes, setCurrentShoes] = useState('👠');

  // Bikini Bottom Characters
  const [spongebobHappiness, setSpongebobHappiness] = useState(50);

  // Castle Builder
  const [castleLevel, setCastleLevel] = useState(1);
  const [castlePieces, setCastlePieces] = useState(0);

  const dressOptions = ['👗', '💃', '🩱', '👘', '🥻'];
  const crownOptions = ['👑', '💎', '🌸', '🦋', '⭐'];
  const shoeOptions = ['👠', '👟', '🩰', '👡', '🥿'];

  const spongebobQuotes = [
    "I'm ready! I'm ready! I'm ready!",
    "The best time to wear a striped sweater... is all the time!",
    "F is for friends who do stuff together!",
    "Imagination! 🌈",
    "I can't hear you, it's too dark in here!",
    "Is mayonnaise an instrument?",
    "The inner machinations of my mind are an enigma...",
  ];

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Jellyfish game
  useEffect(() => {
    if (jellyGameActive && jellyTimeLeft > 0) {
      const jellyTimer = setInterval(() => {
        setActiveJellyfish(Math.floor(Math.random() * 9));
      }, 1000);

      const countdown = setInterval(() => {
        setJellyTimeLeft(t => t - 1);
      }, 1000);

      return () => {
        clearInterval(jellyTimer);
        clearInterval(countdown);
      };
    } else if (jellyTimeLeft === 0 && jellyGameActive) {
      setJellyGameActive(false);
      setActiveJellyfish(null);
      playMagicSound();
    }
  }, [jellyGameActive, jellyTimeLeft]);

  // Sound effects
  const playMagicSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  };

  const playSparkleSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.1);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  };

  const playBubbleSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [400, 500, 600].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.1);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.1);
    });
  };

  const playLaughSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    [300, 350, 300, 400, 350, 450].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.08);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.08);
    });
  };

  const collectTiara = () => {
    playMagicSound();
    setTiarasCollected(t => t + 1);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 1000);
  };

  const waveWand = () => {
    playSparkleSound();
    setWandWaves(w => w + 1);
    setSparklesCreated(s => s + Math.floor(Math.random() * 10) + 5);
  };

  const catchJellyfish = (index: number) => {
    if (index === activeJellyfish && jellyGameActive) {
      playBubbleSound();
      setJellyfishCaught(j => j + 1);
      setActiveJellyfish(null);
    }
  };

  const startJellyfishing = () => {
    setJellyGameActive(true);
    setJellyTimeLeft(20);
    setJellyfishCaught(0);
  };

  const makeSpongebobHappy = () => {
    playLaughSound();
    setSpongebobHappiness(h => Math.min(h + 10, 100));
    if (spongebobHappiness >= 90) {
      setShowFireworks(true);
      playMagicSound();
      setTimeout(() => setShowFireworks(false), 2000);
    }
  };

  const addCastlePiece = () => {
    playSparkleSound();
    setCastlePieces(p => p + 1);
    if ((castlePieces + 1) % 5 === 0) {
      setCastleLevel(l => l + 1);
      playMagicSound();
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 2000);
    }
  };

  const showSpongebobQuote = () => {
    const quote = spongebobQuotes[Math.floor(Math.random() * spongebobQuotes.length)];
    alert(`🧽 SpongeBob says: "${quote}"`);
    playLaughSound();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-400">
        <p className="text-white font-mono text-2xl">👑 Preparing the royal castle... 👑</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${magicMode ? 'animate-magic-bg' : 'bg-gradient-to-br from-pink-400 via-purple-400 to-yellow-300'}`}>
      <style jsx global>{`
        @keyframes magic-bg {
          0% { background: linear-gradient(135deg, #f472b6, #a855f7, #fde047); }
          25% { background: linear-gradient(135deg, #a855f7, #38bdf8, #f472b6); }
          50% { background: linear-gradient(135deg, #fde047, #f472b6, #a855f7); }
          75% { background: linear-gradient(135deg, #38bdf8, #fde047, #a855f7); }
          100% { background: linear-gradient(135deg, #f472b6, #a855f7, #fde047); }
        }
        @keyframes princess-bounce {
          0%, 100% { transform: translateY(0) rotate(-5deg) scale(1); }
          50% { transform: translateY(-20px) rotate(5deg) scale(1.1); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.7; transform: scale(1.3) rotate(180deg); }
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0.5); opacity: 0; }
        }
        @keyframes jellyfish-bob {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes underwater {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        @keyframes crown-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes bubble-float {
          0% { transform: translateY(100%) scale(0.5); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-100%) scale(1); opacity: 0; }
        }
        .animate-magic-bg { animation: magic-bg 10s linear infinite; }
        .animate-princess-bounce { animation: princess-bounce 1s ease-in-out infinite; }
        .animate-sparkle { animation: sparkle 1.5s ease-in-out infinite; }
        .animate-float-up { animation: float-up 1s ease-out forwards; }
        .animate-jellyfish-bob { animation: jellyfish-bob 1s ease-in-out infinite; }
        .animate-underwater { animation: underwater 3s ease-in-out infinite; }
        .animate-crown-spin { animation: crown-spin 3s linear infinite; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-float { animation: float 2s ease-in-out infinite; }
        .animate-bubble-float { animation: bubble-float 3s ease-in-out infinite; }
        .letter-animation {
          display: inline-block;
          animation: princess-bounce 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* Floating princess/spongebob emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['👑', '✨', '🧽', '⭐', '🦋', '💖', '🪼', '🏰', '💎', '🌟', '🧜‍♀️', '🍍'].map((emoji, i) => (
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

        {/* Bubbles for SpongeBob theme */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-bubble-float"
              style={{
                left: `${10 + i * 9}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${4 + Math.random() * 3}s`,
              }}
            >
              🫧
            </div>
          ))}
        </div>

        {/* Fireworks */}
        {showFireworks && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute text-3xl animate-float-up"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${30 + Math.random() * 50}%`,
                  animationDelay: `${Math.random() * 0.3}s`,
                }}
              >
                {['✨', '⭐', '💖', '👑', '💎'][i % 5]}
              </div>
            ))}
          </div>
        )}

        <div className="relative z-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-7xl font-black mb-2">
              {'HI ASPEN!'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="letter-animation inline-block"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    color: ['#f472b6', '#a855f7', '#fde047', '#38bdf8', '#f472b6', '#a855f7', '#fde047', '#38bdf8', '#f472b6'][i],
                    textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(168, 85, 247, 0.5)',
                  }}
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </span>
              ))}
            </h1>
            <p className="text-xl text-white font-bold" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
              👑 PRINCESS & BIKINI BOTTOM EXPLORER 🧽
            </p>
            <div className="flex justify-center gap-3 mt-3">
              {['👑', '🧽', '✨', '🪼', '🏰'].map((e, i) => (
                <span key={i} className="text-5xl animate-princess-bounce" style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Princess Collection */}
          <div className="bg-pink-500/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-pink-300 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4 text-center">👑 PRINCESS POWERS 👑</h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-5xl animate-sparkle mb-2">👑</div>
                <p className="text-white font-bold">{tiarasCollected} Tiaras</p>
              </div>
              <div className="text-center">
                <div className="text-5xl animate-sparkle mb-2" style={{ animationDelay: '0.3s' }}>🪄</div>
                <p className="text-white font-bold">{wanedWaves} Waves</p>
              </div>
              <div className="text-center">
                <div className="text-5xl animate-sparkle mb-2" style={{ animationDelay: '0.6s' }}>✨</div>
                <p className="text-white font-bold">{sparklesCreated} Sparkles</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={collectTiara}
                className="py-4 bg-gradient-to-r from-yellow-400 to-pink-400 hover:from-yellow-500 hover:to-pink-500 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
              >
                👑 GET TIARA! 👑
              </button>
              <button
                onClick={waveWand}
                className="py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
              >
                🪄 WAVE WAND! ✨
              </button>
            </div>
          </div>

          {/* Princess Dress Up */}
          <div className="bg-purple-500/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-purple-300 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4 text-center">💃 ROYAL DRESS UP 💃</h2>

            <div className="flex justify-center gap-4 mb-4">
              <div className="text-6xl">{currentCrown}</div>
              <div className="text-6xl">{currentDress}</div>
              <div className="text-6xl">{currentShoes}</div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-white text-sm mb-2 text-center">Crown:</p>
                <div className="flex justify-center gap-2">
                  {crownOptions.map((c, i) => (
                    <button key={i} onClick={() => { setCurrentCrown(c); playSparkleSound(); }} className={`text-3xl p-2 rounded-lg ${currentCrown === c ? 'bg-yellow-400' : 'bg-white/30'} hover:scale-110 transition-all`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white text-sm mb-2 text-center">Dress:</p>
                <div className="flex justify-center gap-2">
                  {dressOptions.map((d, i) => (
                    <button key={i} onClick={() => { setCurrentDress(d); playSparkleSound(); }} className={`text-3xl p-2 rounded-lg ${currentDress === d ? 'bg-pink-400' : 'bg-white/30'} hover:scale-110 transition-all`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white text-sm mb-2 text-center">Shoes:</p>
                <div className="flex justify-center gap-2">
                  {shoeOptions.map((s, i) => (
                    <button key={i} onClick={() => { setCurrentShoes(s); playSparkleSound(); }} className={`text-3xl p-2 rounded-lg ${currentShoes === s ? 'bg-purple-400' : 'bg-white/30'} hover:scale-110 transition-all`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SpongeBob Section */}
          <div className="bg-yellow-400/90 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-yellow-600 shadow-2xl">
            <h2 className="text-2xl font-black text-yellow-900 mb-4 text-center">🧽 BIKINI BOTTOM 🧽</h2>
            <p className="text-center text-yellow-800 mb-2 font-bold">Get ready to see SpongeBob! 🍍</p>

            <div className="flex justify-center gap-6 mb-4">
              <div className="text-center">
                <div className="text-6xl animate-underwater">🧽</div>
                <p className="text-yellow-900 font-bold">SpongeBob</p>
              </div>
              <div className="text-center">
                <div className="text-6xl animate-underwater" style={{ animationDelay: '0.5s' }}>⭐</div>
                <p className="text-yellow-900 font-bold">Patrick</p>
              </div>
              <div className="text-center">
                <div className="text-6xl animate-underwater" style={{ animationDelay: '1s' }}>🦑</div>
                <p className="text-yellow-900 font-bold">Squidward</p>
              </div>
            </div>

            <div className="bg-yellow-300 rounded-xl p-4 mb-4">
              <p className="text-center text-yellow-900 mb-2">SpongeBob's Happiness:</p>
              <div className="h-6 bg-yellow-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                  style={{ width: `${spongebobHappiness}%` }}
                />
              </div>
              <p className="text-center text-yellow-800 mt-1">{spongebobHappiness}%</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={makeSpongebobHappy}
                className="py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-lg font-black rounded-2xl transition-all transform hover:scale-105"
              >
                😄 MAKE HIM LAUGH! 😄
              </button>
              <button
                onClick={showSpongebobQuote}
                className="py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-lg font-black rounded-2xl transition-all transform hover:scale-105"
              >
                💬 HEAR A QUOTE! 💬
              </button>
            </div>
          </div>

          {/* Jellyfish Game */}
          <div className="bg-cyan-500/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-cyan-300 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4 text-center">🪼 JELLYFISHING! 🪼</h2>

            <div className="flex justify-between text-white mb-4">
              <span>Caught: {jellyfishCaught}</span>
              <span>Time: {jellyTimeLeft}s</span>
            </div>

            {!jellyGameActive ? (
              <button
                onClick={startJellyfishing}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-xl font-black rounded-2xl mb-4 transition-all transform hover:scale-105"
              >
                🎣 GO JELLYFISHING! 🪼
              </button>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => catchJellyfish(i)}
                  className={`h-20 rounded-2xl text-4xl transition-all transform ${
                    activeJellyfish === i
                      ? 'bg-pink-400 scale-110 animate-jellyfish-bob'
                      : 'bg-cyan-700 hover:bg-cyan-600'
                  }`}
                >
                  {activeJellyfish === i ? '🪼' : '🫧'}
                </button>
              ))}
            </div>

            {jellyTimeLeft === 0 && !jellyGameActive && jellyfishCaught > 0 && (
              <p className="text-center text-2xl font-black text-white mt-4 animate-princess-bounce">
                🎉 You caught {jellyfishCaught} jellyfish! 🎉
              </p>
            )}
          </div>

          {/* Castle Builder */}
          <div className="bg-pink-400/80 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-pink-200 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4 text-center">🏰 BUILD YOUR CASTLE 🏰</h2>

            <div className="text-center mb-4">
              <div className="text-6xl mb-2">
                {castleLevel >= 3 ? '🏰' : castleLevel >= 2 ? '🏠' : '🧱'}
              </div>
              <p className="text-white font-bold">Level {castleLevel} Castle</p>
              <p className="text-pink-200">Pieces: {castlePieces} ({5 - (castlePieces % 5)} more to upgrade!)</p>
            </div>

            <button
              onClick={addCastlePiece}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
            >
              🧱 ADD CASTLE PIECE! 🧱
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Tiaras', value: tiarasCollected, emoji: '👑' },
              { label: 'Magic', value: wanedWaves, emoji: '🪄' },
              { label: 'Jellyfish', value: jellyfishCaught, emoji: '🪼' },
              { label: 'Castle', value: `Lv${castleLevel}`, emoji: '🏰' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/30 backdrop-blur rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <div className="text-xl font-black text-white">{stat.value}</div>
                <div className="text-white/80 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Magic Mode Toggle */}
          <button
            onClick={() => setMagicMode(!magicMode)}
            className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-400 text-white text-xl font-black rounded-2xl mb-6 transform hover:scale-105 transition-all"
          >
            {magicMode ? '✨ MAGIC MODE: ON! ✨' : '🌈 ACTIVATE MAGIC! 🌈'}
          </button>

          {/* Footer */}
          <div className="text-center bg-white/30 backdrop-blur rounded-2xl p-6">
            <p className="text-2xl font-black text-white mb-2">
              👑 Princess Aspen's Kingdom 👑
            </p>
            <p className="text-white/90 text-lg">
              Can't wait to see SpongeBob with you! 🧽🍍
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {['👑', '🧽', '✨', '🪼', '💖', '🏰', '⭐'].map((e, i) => (
                <span key={i} className="text-3xl animate-float" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
