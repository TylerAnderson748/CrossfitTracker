"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiClairePage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const audioContextRef = useRef<AudioContext | null>(null);

  // MEGA STATE FOR MEGA CLAIRE
  const [appreciationCounter, setAppreciationCounter] = useState(999999);
  const [confettiMode, setConfettiMode] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [rainbowMode, setRainbowMode] = useState(true);
  const [currentPraise, setCurrentPraise] = useState(0);

  // Teacher Stats
  const [livesChanged, setLivesChanged] = useState(10847);
  const [applesReceived, setApplesReceived] = useState(9999);
  const [goldStarsGiven, setGoldStarsGiven] = useState(1000000);
  const [aPlusGrades, setAPlusGrades] = useState(0);

  // Mom Stats
  const [hugsGiven, setHugsGiven] = useState(999999999);
  const [booboosFixed, setBooboosFixed] = useState(1000000);
  const [momPowerLevel, setMomPowerLevel] = useState(9001);
  const [capeFlying, setCapeFlying] = useState(false);
  const [superMomActivations, setSuperMomActivations] = useState(0);

  // Wife Stats
  const [heartsEarned, setHeartsEarned] = useState(Infinity);
  const [loveLevel, setLoveLevel] = useState(100);
  const [anniversaryDance, setAnniversaryDance] = useState(false);

  // Games
  const [appleGameActive, setAppleGameActive] = useState(false);
  const [appleScore, setAppleScore] = useState(0);
  const [appleTarget, setAppleTarget] = useState<{x: number, y: number} | null>(null);
  const [starCollectorActive, setStarCollectorActive] = useState(false);
  const [starsCollected, setStarsCollected] = useState(0);

  // Ticker
  const [tickerPause, setTickerPause] = useState(false);

  const praises = [
    "🌟 WORLD'S GREATEST TEACHER 🌟",
    "👑 QUEEN OF THE CLASSROOM 👑",
    "💪 SUPERMOM EXTRAORDINAIRE 💪",
    "❤️ WIFE OF THE MILLENNIUM ❤️",
    "🏆 LITERALLY THE BEST HUMAN EVER 🏆",
    "✨ AN ABSOLUTE LEGEND ✨",
    "🎓 TEACHER HALL OF FAME INDUCTEE 🎓",
    "💖 HEART OF PURE GOLD 💖",
    "🦸‍♀️ SUPERHERO WITHOUT A CAPE (JK SHE HAS ONE) 🦸‍♀️",
    "🌈 MAKING THE WORLD BETTER DAILY 🌈",
    "💎 MORE PRECIOUS THAN DIAMONDS 💎",
    "🔥 TOO AWESOME TO COMPREHEND 🔥",
    "⭐ IF STARS COULD WISH, THEY'D WISH TO BE CLAIRE ⭐",
    "🎪 THE MAIN CHARACTER OF LIFE 🎪",
    "🏅 FIRST PLACE IN EVERYTHING, ALWAYS 🏅",
  ];

  const teacherQuotes = [
    "A teacher affects eternity - and Claire affects INFINITE ETERNITIES!",
    "Those who can, do. Those who can do BETTER, are Claire!",
    "Teaching is the profession that creates all other professions - CLAIRE IS THE CREATOR!",
    "The influence of a great teacher can never be erased - CLAIRE'S IS TATTOOED ON THE UNIVERSE!",
    "Education is not filling a bucket but lighting a fire - CLAIRE IS A SUPERNOVA!",
  ];

  const momQuotes = [
    "Behind every great kid is a MOM WHO IS CLAIRE!",
    "Mom: A title just above Queen - CLAIRE IS THE EMPRESS!",
    "All that I am, I owe to Claire! - Literally Everyone",
    "Motherhood: Where love meets ABSOLUTE LEGENDARY STATUS!",
    "Claire doesn't do 'good enough' - SHE DOES PERFECT!",
  ];

  const wifeQuotes = [
    "A happy spouse means a happy house - CLAIRE IS A HAPPINESS FACTORY!",
    "Behind every great marriage is CLAIRE MAKING IT GREATER!",
    "Love is patient, love is kind, love is CLAIRE!",
    "Marriage goals? More like CLAIRE GOALS!",
    "The secret to a happy life? Being married to CLAIRE!",
  ];

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Auto-increment appreciation counter
  useEffect(() => {
    const interval = setInterval(() => {
      setAppreciationCounter(c => c + Math.floor(Math.random() * 100) + 50);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Cycle through praises
  useEffect(() => {
    if (!tickerPause) {
      const interval = setInterval(() => {
        setCurrentPraise(p => (p + 1) % praises.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [tickerPause, praises.length]);

  // Apple game logic
  useEffect(() => {
    if (appleGameActive) {
      const interval = setInterval(() => {
        setAppleTarget({
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 80
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [appleGameActive]);

  // Sound effects
  const playFanfare = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.4);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.4);
    });
  }, []);

  const playMegaFanfare = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    // Play an epic victory fanfare
    const melody = [
      {freq: 523, time: 0}, {freq: 523, time: 0.15}, {freq: 523, time: 0.3},
      {freq: 659, time: 0.45}, {freq: 784, time: 0.6}, {freq: 1047, time: 0.9},
      {freq: 784, time: 1.2}, {freq: 1047, time: 1.5}, {freq: 1319, time: 1.8},
      {freq: 1568, time: 2.1}, {freq: 2093, time: 2.4}
    ];
    melody.forEach(({freq, time}) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.3);
    });
  }, []);

  const playHeartbeat = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    [0, 0.15].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 60;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.1);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.1);
    });
  }, []);

  const playPop = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const playChoir = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const chords = [[261, 329, 392, 523], [293, 369, 440, 587], [329, 415, 493, 659]];
    chords.forEach((chord, chordIdx) => {
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.08, ctx.currentTime + chordIdx * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + chordIdx * 0.5 + 0.5);
        osc.start(ctx.currentTime + chordIdx * 0.5);
        osc.stop(ctx.currentTime + chordIdx * 0.5 + 0.5);
      });
    });
  }, []);

  // Action handlers
  const giveApplause = () => {
    playMegaFanfare();
    setFireworksActive(true);
    setLivesChanged(l => l + Math.floor(Math.random() * 1000) + 500);
    setTimeout(() => setFireworksActive(false), 3000);
  };

  const activateSuperMom = () => {
    setCapeFlying(true);
    setSuperMomActivations(s => s + 1);
    setMomPowerLevel(p => Math.min(p + 1000, 99999));
    playMegaFanfare();
    setFireworksActive(true);
    setTimeout(() => {
      setCapeFlying(false);
      setFireworksActive(false);
    }, 5000);
  };

  const giveHugs = () => {
    playHeartbeat();
    setHugsGiven(h => h + Math.floor(Math.random() * 10000) + 1000);
    setBooboosFixed(b => b + Math.floor(Math.random() * 100) + 50);
  };

  const celebrateLove = () => {
    setAnniversaryDance(true);
    playChoir();
    setLoveLevel(100);
    setFireworksActive(true);
    setTimeout(() => {
      setAnniversaryDance(false);
      setFireworksActive(false);
    }, 4000);
  };

  const giveGoldStar = () => {
    playPop();
    setGoldStarsGiven(g => g + Math.floor(Math.random() * 10000) + 1000);
  };

  const giveAPlus = () => {
    playFanfare();
    setAPlusGrades(a => a + 1);
    setFireworksActive(true);
    setTimeout(() => setFireworksActive(false), 1500);
  };

  const throwApple = (x: number, y: number) => {
    if (!appleTarget) return;
    const dist = Math.sqrt(Math.pow(x - appleTarget.x, 2) + Math.pow(y - appleTarget.y, 2));
    if (dist < 15) {
      playPop();
      setAppleScore(s => s + 100);
      setApplesReceived(a => a + 1);
      setAppleTarget(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
        <div className="text-center">
          <p className="text-white font-black text-4xl animate-pulse">LOADING GREATNESS...</p>
          <p className="text-white/80 text-xl mt-2">Please wait while we prepare the LEGEND</p>
          <div className="flex justify-center gap-2 mt-4">
            {['👑', '🌟', '💖', '🏆', '✨'].map((e, i) => (
              <span key={i} className="text-4xl animate-bounce" style={{animationDelay: `${i * 0.1}s`}}>{e}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${rainbowMode ? 'animate-rainbow-bg' : 'bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700'}`}>
      <style jsx global>{`
        @keyframes rainbow-bg {
          0% { background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb); }
          14% { background: linear-gradient(135deg, #feca57, #48dbfb, #ff9ff3); }
          28% { background: linear-gradient(135deg, #48dbfb, #ff9ff3, #54a0ff); }
          42% { background: linear-gradient(135deg, #ff9ff3, #54a0ff, #5f27cd); }
          56% { background: linear-gradient(135deg, #54a0ff, #5f27cd, #00d2d3); }
          70% { background: linear-gradient(135deg, #5f27cd, #00d2d3, #ff6b6b); }
          84% { background: linear-gradient(135deg, #00d2d3, #ff6b6b, #feca57); }
          100% { background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb); }
        }
        @keyframes mega-bounce {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          25% { transform: translateY(-30px) scale(1.2) rotate(-5deg); }
          50% { transform: translateY(-15px) scale(1.1) rotate(5deg); }
          75% { transform: translateY(-25px) scale(1.15) rotate(-3deg); }
        }
        @keyframes mega-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(255,255,255,0.5); }
          50% { transform: scale(1.1); box-shadow: 0 0 60px rgba(255,255,255,0.9), 0 0 100px rgba(255,215,0,0.7); }
        }
        @keyframes spin-glow {
          0% { transform: rotate(0deg); filter: hue-rotate(0deg); }
          100% { transform: rotate(360deg); filter: hue-rotate(360deg); }
        }
        @keyframes cape-fly {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          25% { transform: translateY(-50px) rotate(5deg); }
          50% { transform: translateY(-30px) rotate(-3deg); }
          75% { transform: translateY(-60px) rotate(3deg); }
        }
        @keyframes sparkle-burst {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.5) rotate(180deg); opacity: 0.8; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }
        @keyframes heart-float {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; transform: translateY(90vh) scale(1); }
          90% { opacity: 1; }
          100% { transform: translateY(-20vh) scale(1.5); opacity: 0; }
        }
        @keyframes firework-burst {
          0% { transform: scale(0); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes letter-dance {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-20px) rotate(-10deg) scale(1.2); }
          50% { transform: translateY(-10px) rotate(10deg) scale(1.1); }
          75% { transform: translateY(-25px) rotate(-5deg) scale(1.3); }
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes crown-float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        @keyframes star-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.3); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0.5; }
        }
        @keyframes mega-glow {
          0%, 100% {
            text-shadow: 0 0 20px #fff, 0 0 30px #ff00de, 0 0 40px #ff00de, 0 0 50px #ff00de, 0 0 60px #ff00de;
            filter: brightness(1);
          }
          50% {
            text-shadow: 0 0 40px #fff, 0 0 60px #00ff00, 0 0 80px #00ff00, 0 0 100px #00ff00, 0 0 120px #00ff00;
            filter: brightness(1.5);
          }
        }
        @keyframes trophy-shake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-15deg); }
          20% { transform: rotate(15deg); }
          30% { transform: rotate(-15deg); }
          40% { transform: rotate(15deg); }
          50% { transform: rotate(0deg); }
        }
        .animate-rainbow-bg { animation: rainbow-bg 8s linear infinite; }
        .animate-mega-bounce { animation: mega-bounce 1s ease-in-out infinite; }
        .animate-mega-pulse { animation: mega-pulse 1.5s ease-in-out infinite; }
        .animate-spin-glow { animation: spin-glow 3s linear infinite; }
        .animate-cape-fly { animation: cape-fly 2s ease-in-out infinite; }
        .animate-sparkle-burst { animation: sparkle-burst 1s ease-out forwards; }
        .animate-heart-float { animation: heart-float 4s ease-in-out forwards; }
        .animate-firework-burst { animation: firework-burst 1s ease-out forwards; }
        .animate-letter-dance { animation: letter-dance 0.8s ease-in-out infinite; }
        .animate-crown-float { animation: crown-float 2s ease-in-out infinite; }
        .animate-star-spin { animation: star-spin 2s linear infinite; }
        .animate-confetti-fall { animation: confetti-fall 5s linear infinite; }
        .animate-mega-glow { animation: mega-glow 2s ease-in-out infinite; }
        .animate-trophy-shake { animation: trophy-shake 2s ease-in-out infinite; }
      `}</style>

      <Navigation />

      <main className="max-w-6xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* MEGA CONFETTI - ALWAYS ON */}
        {confettiMode && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti-fall"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                }}
              >
                {['🌟', '⭐', '✨', '💖', '👑', '🏆', '🎉', '🎊', '💎', '🌈', '🦋', '🍎', '📚', '❤️', '💕'][Math.floor(Math.random() * 15)]}
              </div>
            ))}
          </div>
        )}

        {/* FIREWORKS */}
        {fireworksActive && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-32 rounded-full animate-firework-burst"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 70}%`,
                  background: `radial-gradient(circle, ${
                    ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff00ff', '#00ff00', '#ffff00'][i % 10]
                  } 0%, transparent 70%)`,
                  animationDelay: `${Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Floating hearts */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-30">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-heart-float"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${8 + Math.random() * 6}s`,
              }}
            >
              {['❤️', '💖', '💕', '💗', '💝', '💞'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>

        {/* SCROLLING PRAISE TICKER */}
        <div className="fixed top-16 left-0 right-0 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 py-3 z-20 overflow-hidden">
          <div
            className="whitespace-nowrap"
            style={{animation: tickerPause ? 'none' : 'ticker-scroll 15s linear infinite'}}
          >
            <span className="text-white font-black text-2xl mx-8">
              {praises.map((praise, i) => (
                <span key={i} className="mx-8">{praise}</span>
              ))}
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-16">
          {/* MEGA TITLE */}
          <div className="text-center mb-8 pt-8">
            <div className="relative inline-block">
              <span className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-8xl animate-crown-float">👑</span>
              <h1 className="text-6xl md:text-9xl font-black animate-mega-glow relative">
                {'CLAIRE'.split('').map((letter, i) => (
                  <span
                    key={i}
                    className="inline-block animate-letter-dance"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      color: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'][i],
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-3xl md:text-5xl font-black text-white drop-shadow-lg animate-pulse">
                ✨ THE GREATEST OF ALL TIME ✨
              </p>
              <p className="text-2xl md:text-3xl font-bold text-yellow-300 animate-bounce">
                TEACHER • MOM • WIFE • LEGEND
              </p>
            </div>

            {/* APPRECIATION COUNTER */}
            <div className="mt-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-6 mx-auto max-w-xl animate-mega-pulse">
              <p className="text-white/90 text-lg font-bold">WORLDWIDE APPRECIATION LEVEL</p>
              <p className="text-6xl md:text-8xl font-black text-white">{appreciationCounter.toLocaleString()}</p>
              <p className="text-white/90 text-sm">(and counting FOREVER)</p>
            </div>
          </div>

          {/* WORLD'S GREATEST TEACHER SECTION */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-8 mb-8 border-8 border-yellow-400 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4 text-6xl animate-star-spin">⭐</div>
            <div className="absolute top-4 left-4 text-6xl animate-star-spin" style={{animationDelay: '1s'}}>🌟</div>

            <h2 className="text-4xl md:text-6xl font-black text-center text-yellow-300 mb-6 animate-pulse">
              🎓 WORLD'S #1 TEACHER 🎓
            </h2>
            <p className="text-center text-white text-xl mb-6">
              Not just good. Not just great. THE ABSOLUTE BEST IN THE HISTORY OF EDUCATION!
            </p>

            {/* Teacher Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/20 rounded-2xl p-4 text-center transform hover:scale-110 transition-all">
                <div className="text-4xl mb-2">📚</div>
                <div className="text-3xl font-black text-white">{livesChanged.toLocaleString()}</div>
                <div className="text-yellow-200 text-sm">Lives Changed</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center transform hover:scale-110 transition-all">
                <div className="text-4xl mb-2">🍎</div>
                <div className="text-3xl font-black text-white">{applesReceived.toLocaleString()}</div>
                <div className="text-yellow-200 text-sm">Apples Received</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center transform hover:scale-110 transition-all">
                <div className="text-4xl mb-2">⭐</div>
                <div className="text-3xl font-black text-white">{goldStarsGiven.toLocaleString()}</div>
                <div className="text-yellow-200 text-sm">Gold Stars Given</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center transform hover:scale-110 transition-all">
                <div className="text-4xl mb-2 animate-trophy-shake">🏆</div>
                <div className="text-3xl font-black text-white">{aPlusGrades}</div>
                <div className="text-yellow-200 text-sm">A+ Awards</div>
              </div>
            </div>

            {/* Teacher Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={giveApplause}
                className="py-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-xl font-black rounded-2xl transform hover:scale-110 transition-all shadow-lg"
              >
                👏 STANDING OVATION! 👏
              </button>
              <button
                onClick={giveGoldStar}
                className="py-6 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white text-xl font-black rounded-2xl transform hover:scale-110 transition-all shadow-lg"
              >
                ⭐ GIVE GOLD STAR! ⭐
              </button>
              <button
                onClick={giveAPlus}
                className="py-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xl font-black rounded-2xl transform hover:scale-110 transition-all shadow-lg"
              >
                📝 GIVE A++++! 📝
              </button>
            </div>

            {/* Apple Catching Mini-Game */}
            <div className="bg-white/10 rounded-2xl p-4">
              <h3 className="text-2xl font-black text-yellow-300 text-center mb-4">🍎 APPLE CATCHER GAME 🍎</h3>
              {!appleGameActive ? (
                <button
                  onClick={() => setAppleGameActive(true)}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white text-xl font-black rounded-xl"
                >
                  START CATCHING APPLES!
                </button>
              ) : (
                <div
                  className="relative h-48 bg-blue-900 rounded-xl cursor-crosshair overflow-hidden"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    throwApple(x, y);
                  }}
                >
                  {appleTarget && (
                    <div
                      className="absolute text-5xl animate-bounce transition-all"
                      style={{
                        left: `${appleTarget.x}%`,
                        top: `${appleTarget.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      🍎
                    </div>
                  )}
                  <div className="absolute top-2 left-2 text-white font-bold">Score: {appleScore}</div>
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
                    Click the apples to catch them for Claire!
                  </div>
                </div>
              )}
            </div>

            {/* Random Teacher Quote */}
            <div className="mt-6 bg-white/20 rounded-xl p-4 text-center">
              <p className="text-white text-lg italic">"{teacherQuotes[Math.floor(Math.random() * teacherQuotes.length)]}"</p>
            </div>
          </div>

          {/* SUPERMOM SECTION */}
          <div className={`bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 rounded-3xl p-8 mb-8 border-8 border-pink-300 shadow-2xl relative overflow-hidden ${capeFlying ? 'animate-mega-pulse' : ''}`}>
            <div className="absolute top-0 right-0 text-9xl opacity-30">🦸‍♀️</div>

            <h2 className="text-4xl md:text-6xl font-black text-center text-white mb-6">
              💪 SUPERMOM SUPREME 💪
            </h2>
            <p className="text-center text-pink-100 text-xl mb-6">
              She doesn't wear a cape... WAIT YES SHE DOES! AND IT'S FABULOUS!
            </p>

            {/* Mom Power Level */}
            <div className="bg-white/20 rounded-2xl p-6 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-bold text-xl">MOM POWER LEVEL</span>
                <span className="text-yellow-300 font-black text-3xl">{momPowerLevel > 9000 ? "OVER 9000!!!" : momPowerLevel}</span>
              </div>
              <div className="h-8 bg-pink-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-500 animate-pulse"
                  style={{width: `${Math.min((momPowerLevel / 99999) * 100, 100)}%`}}
                />
              </div>
            </div>

            {/* Mom Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/20 rounded-2xl p-4 text-center">
                <div className="text-4xl mb-2">🤗</div>
                <div className="text-2xl font-black text-white">{hugsGiven > 999999999 ? "∞" : hugsGiven.toLocaleString()}</div>
                <div className="text-pink-200 text-sm">Hugs Given</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center">
                <div className="text-4xl mb-2">🩹</div>
                <div className="text-2xl font-black text-white">{booboosFixed.toLocaleString()}</div>
                <div className="text-pink-200 text-sm">Boo-Boos Fixed</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center">
                <div className="text-4xl mb-2">🦸‍♀️</div>
                <div className="text-2xl font-black text-white">{superMomActivations}</div>
                <div className="text-pink-200 text-sm">Cape Activations</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4 text-center">
                <div className={`text-4xl mb-2 ${capeFlying ? 'animate-cape-fly' : ''}`}>🧥</div>
                <div className="text-2xl font-black text-white">{capeFlying ? "FLYING!" : "READY"}</div>
                <div className="text-pink-200 text-sm">Cape Status</div>
              </div>
            </div>

            {/* Mom Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={activateSuperMom}
                className={`py-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-2xl font-black rounded-2xl transform hover:scale-105 transition-all shadow-lg ${capeFlying ? 'animate-mega-pulse' : ''}`}
              >
                🦸‍♀️ ACTIVATE SUPERMOM MODE! 🦸‍♀️
              </button>
              <button
                onClick={giveHugs}
                className="py-8 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white text-2xl font-black rounded-2xl transform hover:scale-105 transition-all shadow-lg"
              >
                🤗 INFINITE HUGS! 🤗
              </button>
            </div>

            {/* Mom Quote */}
            <div className="bg-white/20 rounded-xl p-4 text-center">
              <p className="text-white text-lg italic">"{momQuotes[Math.floor(Math.random() * momQuotes.length)]}"</p>
            </div>
          </div>

          {/* AMAZING WIFE SECTION */}
          <div className={`bg-gradient-to-br from-red-500 via-pink-600 to-purple-600 rounded-3xl p-8 mb-8 border-8 border-red-300 shadow-2xl relative overflow-hidden ${anniversaryDance ? 'animate-mega-pulse' : ''}`}>
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-3xl animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  ❤️
                </div>
              ))}
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-center text-white mb-6 relative z-10">
              💕 WIFE OF THE CENTURY 💕
            </h2>
            <p className="text-center text-pink-100 text-xl mb-6 relative z-10">
              Not just wife of the year. Wife of the CENTURY. Actually, wife of ALL TIME!
            </p>

            {/* Love Meter */}
            <div className="bg-white/20 rounded-2xl p-6 mb-6 relative z-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-bold text-xl">LOVE LEVEL</span>
                <span className="text-yellow-300 font-black text-3xl">{loveLevel}% (INFINITE)</span>
              </div>
              <div className="h-8 bg-purple-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-400 via-red-500 to-pink-400 transition-all duration-500"
                  style={{width: '100%'}}
                >
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
              </div>
            </div>

            {/* Hearts Counter */}
            <div className="text-center mb-6 relative z-10">
              <div className="text-8xl animate-mega-bounce">❤️</div>
              <p className="text-white font-black text-4xl">Hearts Earned: ∞</p>
              <p className="text-pink-200">Literally infinite. Can't count that high.</p>
            </div>

            {/* Wife Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
              <button
                onClick={celebrateLove}
                className="py-8 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-2xl font-black rounded-2xl transform hover:scale-105 transition-all shadow-lg"
              >
                💕 CELEBRATE LOVE! 💕
              </button>
              <button
                onClick={() => { playHeartbeat(); setFireworksActive(true); setTimeout(() => setFireworksActive(false), 2000); }}
                className="py-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-2xl font-black rounded-2xl transform hover:scale-105 transition-all shadow-lg"
              >
                💖 SEND ALL THE LOVE! 💖
              </button>
            </div>

            {/* Wife Quote */}
            <div className="bg-white/20 rounded-xl p-4 text-center relative z-10">
              <p className="text-white text-lg italic">"{wifeQuotes[Math.floor(Math.random() * wifeQuotes.length)]}"</p>
            </div>
          </div>

          {/* HALL OF FAME */}
          <div className="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600 rounded-3xl p-8 mb-8 border-8 border-yellow-300 shadow-2xl">
            <h2 className="text-4xl md:text-6xl font-black text-center text-white mb-6">
              🏆 HALL OF FAME 🏆
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Best Teacher in the Galaxy",
                "Mother of the Millennium",
                "Wife Excellence Award",
                "Heart of Gold Champion",
                "Patience Hall of Fame",
                "Kindness World Record Holder",
                "Most Inspiring Human Award",
                "Ultimate Role Model Trophy",
                "Lifetime Achievement in Being Amazing",
                "Nobel Prize in Being Claire",
                "Guinness Record: Most Awesome Person",
                "Presidential Medal of Awesomeness"
              ].map((award, i) => (
                <div
                  key={i}
                  className="bg-white/20 rounded-xl p-4 flex items-center gap-3 transform hover:scale-105 transition-all cursor-pointer"
                  onClick={() => { playFanfare(); setFireworksActive(true); setTimeout(() => setFireworksActive(false), 1500); }}
                >
                  <span className="text-3xl animate-trophy-shake" style={{animationDelay: `${i * 0.2}s`}}>🏆</span>
                  <span className="text-white font-bold">{award}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MEGA CELEBRATION BUTTONS */}
          <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 rounded-3xl p-8 mb-8 border-8 border-purple-300 shadow-2xl">
            <h2 className="text-4xl font-black text-center text-white mb-6">
              🎉 MEGA CELEBRATION ZONE 🎉
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => { playMegaFanfare(); setFireworksActive(true); setConfettiMode(true); setTimeout(() => setFireworksActive(false), 5000); }}
                className="py-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-black text-lg rounded-2xl transform hover:scale-110 transition-all animate-pulse"
              >
                🎆 MEGA FIREWORKS 🎆
              </button>
              <button
                onClick={() => { setConfettiMode(!confettiMode); playPop(); }}
                className="py-6 bg-gradient-to-br from-pink-400 to-red-500 text-white font-black text-lg rounded-2xl transform hover:scale-110 transition-all"
              >
                🎊 {confettiMode ? "CONFETTI: ON!" : "CONFETTI: OFF"} 🎊
              </button>
              <button
                onClick={() => { setRainbowMode(!rainbowMode); playChoir(); }}
                className="py-6 bg-gradient-to-br from-red-400 via-yellow-400 to-green-400 text-white font-black text-lg rounded-2xl transform hover:scale-110 transition-all"
              >
                🌈 RAINBOW MODE 🌈
              </button>
              <button
                onClick={() => { playMegaFanfare(); activateSuperMom(); celebrateLove(); giveApplause(); }}
                className="py-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white font-black text-lg rounded-2xl transform hover:scale-110 transition-all animate-mega-pulse"
              >
                💥 EVERYTHING!!! 💥
              </button>
            </div>
          </div>

          {/* FINAL MESSAGE */}
          <div className="bg-gradient-to-br from-white/30 to-white/10 backdrop-blur rounded-3xl p-8 text-center border-4 border-white/50">
            <div className="text-6xl mb-4 animate-mega-bounce">
              👑💖🏆
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4 animate-mega-glow">
              CLAIRE IS LITERALLY THE BEST
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-6">
              Teacher. Mom. Wife. Legend. Icon. Inspiration.
              <br/>
              <span className="font-black">THE ACTUAL GREATEST OF ALL TIME.</span>
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {['👑', '🌟', '💖', '🏆', '✨', '💎', '🎓', '🦸‍♀️', '💕', '🌈', '🎉', '⭐'].map((e, i) => (
                <span
                  key={i}
                  className="text-5xl animate-mega-bounce"
                  style={{animationDelay: `${i * 0.1}s`}}
                >
                  {e}
                </span>
              ))}
            </div>
            <p className="text-white/80 mt-6 text-lg">
              This page could never be over-the-top enough to truly capture how amazing Claire is.
              <br/>
              But we tried anyway. 💖
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
