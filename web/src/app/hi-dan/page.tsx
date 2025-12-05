"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

export default function HiDanPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [showFireworks, setShowFireworks] = useState(false);
  const [raceMode, setRaceMode] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [riderStats, setRiderStats] = useState({ roczen: 0, tomac: 0, anderson: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  // Dad Joke State
  const [currentJoke, setCurrentJoke] = useState<string | null>(null);
  const [showPunchline, setShowPunchline] = useState(false);

  // Race Game State
  const [gameActive, setGameActive] = useState(false);
  const [racePositions, setRacePositions] = useState({ player: 0, cpu1: 0, cpu2: 0 });
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [tapsCount, setTapsCount] = useState(0);

  // Whack-a-Mole Game State
  const [whackGameActive, setWhackGameActive] = useState(false);
  const [whackScore, setWhackScore] = useState(0);
  const [whackHighScore, setWhackHighScore] = useState(0);
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [whackTimeLeft, setWhackTimeLeft] = useState(30);

  // Reaction Game State
  const [reactionGameState, setReactionGameState] = useState<'idle' | 'waiting' | 'ready' | 'done'>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const reactionStartRef = useRef<number>(0);

  const dadJokes = [
    { setup: "Why did the dirt bike go to therapy?", punchline: "It had too many breakdowns! 🏍️" },
    { setup: "What do you call a sleeping motorcycle?", punchline: "A yamahammock! 😴" },
    { setup: "Why don't dirt bikes ever get lost?", punchline: "Because they always follow the track! 🏁" },
    { setup: "What's a supercross rider's favorite meal?", punchline: "Crash potatoes! 🥔" },
    { setup: "Why did Ken Roczen bring a ladder to the race?", punchline: "To get to the top of the podium! 🏆" },
    { setup: "What do you call Eli Tomac on a bicycle?", punchline: "Eli Slowmac! 🚴" },
    { setup: "Why are dirt bikes bad at hide and seek?", punchline: "Because they're always revving to go! BRAAAP! 💨" },
    { setup: "What did the dad say when his kid won the race?", punchline: "That's wheelie awesome! 🎉" },
    { setup: "Why did the motocross bike break up with the road bike?", punchline: "It needed more dirt in the relationship! 🤣" },
    { setup: "What's Jason Anderson's favorite day?", punchline: "Whip-it Wednesday! 🌀" },
  ];

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 1000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Whack-a-mole game logic
  useEffect(() => {
    if (whackGameActive && whackTimeLeft > 0) {
      const holeTimer = setInterval(() => {
        setActiveHole(Math.floor(Math.random() * 9));
      }, 800);

      const countdownTimer = setInterval(() => {
        setWhackTimeLeft(t => t - 1);
      }, 1000);

      return () => {
        clearInterval(holeTimer);
        clearInterval(countdownTimer);
      };
    } else if (whackTimeLeft === 0 && whackGameActive) {
      setWhackGameActive(false);
      setActiveHole(null);
      if (whackScore > whackHighScore) {
        setWhackHighScore(whackScore);
      }
    }
  }, [whackGameActive, whackTimeLeft, whackScore, whackHighScore]);

  // Sound effects
  const playRevSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
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
    osc2.type = 'square';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
  };

  const playWinSound = () => {
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

  const playBonkSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  };

  const tellJoke = () => {
    const joke = dadJokes[Math.floor(Math.random() * dadJokes.length)];
    setCurrentJoke(joke.setup);
    setShowPunchline(false);
    setTimeout(() => {
      setCurrentJoke(joke.punchline);
      setShowPunchline(true);
    }, 2500);
  };

  const voteForRider = (rider: 'roczen' | 'tomac' | 'anderson') => {
    setSelectedRider(rider);
    setRiderStats(prev => ({ ...prev, [rider]: prev[rider] + 1 }));
    playRevSound();
  };

  // Race game functions
  const startRace = () => {
    setGameActive(true);
    setGameResult(null);
    setRacePositions({ player: 0, cpu1: 0, cpu2: 0 });
    setTapsCount(0);
  };

  const tapToRace = useCallback(() => {
    if (!gameActive) return;
    playRevSound();
    setTapsCount(t => t + 1);
    setRacePositions(prev => {
      const newPlayer = Math.min(prev.player + 8 + Math.random() * 4, 100);
      const newCpu1 = Math.min(prev.cpu1 + 3 + Math.random() * 5, 100);
      const newCpu2 = Math.min(prev.cpu2 + 3 + Math.random() * 5, 100);

      if (newPlayer >= 100) {
        setGameActive(false);
        setGameResult("YOU WIN! 🏆");
        playWinSound();
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 2000);
      } else if (newCpu1 >= 100 || newCpu2 >= 100) {
        setGameActive(false);
        setGameResult("Try again! 💪");
      }

      return { player: newPlayer, cpu1: newCpu1, cpu2: newCpu2 };
    });
  }, [gameActive]);

  // Whack game functions
  const startWhackGame = () => {
    setWhackGameActive(true);
    setWhackScore(0);
    setWhackTimeLeft(30);
  };

  const whackHole = (index: number) => {
    if (index === activeHole && whackGameActive) {
      playBonkSound();
      setWhackScore(s => s + 1);
      setActiveHole(null);
    }
  };

  // Reaction game functions
  const startReactionGame = () => {
    setReactionGameState('waiting');
    setReactionTime(null);
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      setReactionGameState('ready');
      reactionStartRef.current = Date.now();
    }, delay);
  };

  const handleReactionClick = () => {
    if (reactionGameState === 'waiting') {
      setReactionGameState('idle');
      setReactionTime(-1); // Too early!
    } else if (reactionGameState === 'ready') {
      const time = Date.now() - reactionStartRef.current;
      setReactionTime(time);
      setReactionGameState('done');
      if (!bestReactionTime || time < bestReactionTime) {
        setBestReactionTime(time);
        playWinSound();
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-orange-400 font-mono text-2xl">🏍️ Loading the track... 🏍️</p>
      </div>
    );
  }

  const riders = [
    { id: 'roczen', name: 'Ken Roczen', number: '94', flag: '🇩🇪', color: 'from-red-500 to-yellow-500', bgColor: 'bg-red-600' },
    { id: 'tomac', name: 'Eli Tomac', number: '1', flag: '🇺🇸', color: 'from-green-500 to-blue-500', bgColor: 'bg-green-600' },
    { id: 'anderson', name: 'Jason Anderson', number: '21', flag: '🇺🇸', color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-600' },
  ];

  return (
    <div className={`min-h-screen ${raceMode ? 'animate-race-bg' : 'bg-gradient-to-br from-orange-500 via-red-600 to-yellow-500'}`}>
      <style jsx global>{`
        @keyframes bounce-crazy {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-20px) rotate(-5deg) scale(1.1); }
          50% { transform: translateY(0) rotate(5deg) scale(0.95); }
          75% { transform: translateY(-10px) rotate(-3deg) scale(1.05); }
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
          50% { background: linear-gradient(45deg, #000000, #ff6600); }
          100% { background: linear-gradient(45deg, #ff6600, #cc0000); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,102,0,0.5); }
          50% { box-shadow: 0 0 40px rgba(255,102,0,0.9), 0 0 60px rgba(255,0,0,0.5); }
        }
        @keyframes firework {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes bike-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-2deg); }
          75% { transform: translateX(3px) rotate(2deg); }
        }
        @keyframes letter-wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes pop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-bounce-crazy { animation: bounce-crazy 0.8s ease-in-out infinite; }
        .animate-race-colors { animation: race-colors 2s linear infinite; }
        .animate-race-bg { animation: race-bg 3s linear infinite; }
        .animate-float { animation: float 2s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-firework { animation: firework 1s ease-out forwards; }
        .animate-bike-shake { animation: bike-shake 0.3s ease-in-out infinite; }
        .animate-pop { animation: pop 0.3s ease-out; }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
        .letter-animation {
          display: inline-block;
          animation: letter-wave 1s ease-in-out infinite;
        }
      `}</style>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 relative overflow-hidden">
        {/* Floating background emojis */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['🏍️', '🏆', '🔥', '💪', '🏁', '🥇', '⚡', '💨', '🦅', '🌟', '👨‍👧‍👦', '❤️'].map((emoji, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-float"
              style={{
                left: `${(i * 8) % 100}%`,
                top: `${(i * 12) % 80}%`,
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
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-32 rounded-full animate-firework"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 60}%`,
                  background: `radial-gradient(circle, ${['#ff6600', '#ff0000', '#ffcc00', '#ff3300', '#00ff00', '#00ffff', '#ff00ff', '#ffff00'][i]} 0%, transparent 70%)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-7xl font-black mb-2">
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
            <p className="text-xl text-white font-bold">🏍️ WORLD&apos;S BEST SUPERCROSS DAD 🏍️</p>
            <div className="flex justify-center gap-3 mt-3">
              {['👨‍👧‍👦', '🏍️', '🏆', '❤️', '🔥'].map((e, i) => (
                <span key={i} className="text-4xl animate-bounce-crazy" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Dad Joke Section */}
          <div className="bg-yellow-400 rounded-3xl p-6 mb-6 border-4 border-yellow-600 shadow-2xl">
            <h2 className="text-2xl font-black text-yellow-900 mb-4 text-center">🤣 DAD JOKE TIME 🤣</h2>
            <button
              onClick={tellJoke}
              className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105 mb-4"
            >
              🎤 TELL ME A JOKE! 🎤
            </button>
            {currentJoke && (
              <div className={`text-center p-4 bg-white rounded-2xl ${showPunchline ? 'animate-pop' : ''}`}>
                <p className={`text-xl font-bold ${showPunchline ? 'text-green-600' : 'text-gray-800'}`}>
                  {currentJoke}
                </p>
              </div>
            )}
          </div>

          {/* Race Game */}
          <div className="bg-gray-900 rounded-3xl p-6 mb-6 border-4 border-orange-500 shadow-2xl">
            <h2 className="text-2xl font-black text-orange-400 mb-4 text-center">🏁 TAP TO RACE! 🏁</h2>

            {!gameActive && !gameResult && (
              <button
                onClick={startRace}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-black rounded-2xl transition-all transform hover:scale-105"
              >
                🏍️ START RACE! 🏍️
              </button>
            )}

            {gameActive && (
              <div>
                <div className="space-y-3 mb-4">
                  {/* Player */}
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold">YOU 🏍️</span>
                      <span className="text-yellow-400 text-sm">Taps: {tapsCount}</span>
                    </div>
                    <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-100 flex items-center justify-end pr-2"
                        style={{ width: `${racePositions.player}%` }}
                      >
                        <span className="text-lg">🏍️</span>
                      </div>
                    </div>
                  </div>
                  {/* CPU 1 - Roczen */}
                  <div className="relative">
                    <div className="text-white font-bold mb-1">Ken Roczen #94 🇩🇪</div>
                    <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-100 flex items-center justify-end pr-2"
                        style={{ width: `${racePositions.cpu1}%` }}
                      >
                        <span className="text-lg">🏍️</span>
                      </div>
                    </div>
                  </div>
                  {/* CPU 2 - Tomac */}
                  <div className="relative">
                    <div className="text-white font-bold mb-1">Eli Tomac #1 🇺🇸</div>
                    <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-100 flex items-center justify-end pr-2"
                        style={{ width: `${racePositions.cpu2}%` }}
                      >
                        <span className="text-lg">🏍️</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={tapToRace}
                  className="w-full py-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-2xl font-black rounded-2xl transition-all transform active:scale-95 animate-pulse-glow"
                >
                  🔥 TAP TAP TAP! 🔥
                </button>
              </div>
            )}

            {gameResult && (
              <div className="text-center">
                <p className={`text-4xl font-black mb-4 ${gameResult.includes('WIN') ? 'text-yellow-400 animate-bounce-crazy' : 'text-white'}`}>
                  {gameResult}
                </p>
                <button
                  onClick={startRace}
                  className="py-4 px-8 bg-gradient-to-r from-green-500 to-green-600 text-white text-xl font-black rounded-2xl"
                >
                  🔄 RACE AGAIN!
                </button>
              </div>
            )}
          </div>

          {/* Whack-a-Mole Game */}
          <div className="bg-green-800 rounded-3xl p-6 mb-6 border-4 border-green-400 shadow-2xl">
            <h2 className="text-2xl font-black text-green-300 mb-2 text-center">🎯 WHACK THE HELMET! 🎯</h2>
            <div className="flex justify-between text-white mb-4">
              <span className="font-bold">Score: {whackScore}</span>
              <span className="font-bold">Time: {whackTimeLeft}s</span>
              <span className="font-bold">Best: {whackHighScore}</span>
            </div>

            {!whackGameActive ? (
              <button
                onClick={startWhackGame}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-black rounded-2xl mb-4"
              >
                🎮 START GAME! 🎮
              </button>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => whackHole(i)}
                  className={`h-20 rounded-2xl text-4xl transition-all transform ${
                    activeHole === i
                      ? 'bg-red-500 scale-110 animate-wiggle'
                      : 'bg-green-900 hover:bg-green-700'
                  }`}
                >
                  {activeHole === i ? '🪖' : '⭕'}
                </button>
              ))}
            </div>

            {whackTimeLeft === 0 && (
              <p className="text-center text-2xl font-black text-yellow-300 mt-4 animate-bounce-crazy">
                🎉 Final Score: {whackScore}! 🎉
              </p>
            )}
          </div>

          {/* Reaction Time Game */}
          <div className="bg-purple-800 rounded-3xl p-6 mb-6 border-4 border-purple-400 shadow-2xl">
            <h2 className="text-2xl font-black text-purple-300 mb-4 text-center">⚡ HOLESHOT REACTION! ⚡</h2>
            <p className="text-white text-center mb-4">Test your gate drop reaction time!</p>

            {reactionGameState === 'idle' && (
              <button
                onClick={startReactionGame}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xl font-black rounded-2xl"
              >
                🏁 GET READY! 🏁
              </button>
            )}

            {reactionGameState === 'waiting' && (
              <button
                onClick={handleReactionClick}
                className="w-full py-8 bg-red-600 text-white text-2xl font-black rounded-2xl"
              >
                🔴 WAIT FOR GREEN... 🔴
              </button>
            )}

            {reactionGameState === 'ready' && (
              <button
                onClick={handleReactionClick}
                className="w-full py-8 bg-green-500 text-white text-2xl font-black rounded-2xl animate-pulse"
              >
                🟢 GO GO GO! 🟢
              </button>
            )}

            {reactionGameState === 'done' && (
              <div className="text-center">
                <p className="text-3xl font-black text-yellow-300 mb-2">
                  {reactionTime}ms
                </p>
                {bestReactionTime === reactionTime && (
                  <p className="text-xl text-green-400 mb-4">🏆 NEW BEST TIME! 🏆</p>
                )}
                <button
                  onClick={startReactionGame}
                  className="py-4 px-8 bg-purple-500 text-white text-xl font-black rounded-2xl"
                >
                  🔄 TRY AGAIN!
                </button>
              </div>
            )}

            {reactionTime === -1 && (
              <div className="text-center">
                <p className="text-2xl font-black text-red-400 mb-4">😅 TOO EARLY! Wait for green!</p>
                <button
                  onClick={startReactionGame}
                  className="py-4 px-8 bg-purple-500 text-white text-xl font-black rounded-2xl"
                >
                  🔄 TRY AGAIN!
                </button>
              </div>
            )}

            {bestReactionTime && reactionGameState === 'idle' && (
              <p className="text-center text-yellow-300 mt-4">Best Time: {bestReactionTime}ms</p>
            )}
          </div>

          {/* Rider Voting */}
          <div className="bg-black/70 backdrop-blur rounded-3xl p-6 mb-6 border-4 border-yellow-500">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">🏆 WHO&apos;S THE GOAT? 🏆</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {riders.map((rider) => (
                <button
                  key={rider.id}
                  onClick={() => voteForRider(rider.id as 'roczen' | 'tomac' | 'anderson')}
                  className={`p-4 rounded-xl border-4 transition-all transform hover:scale-105 ${
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

          {/* Fun Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => { playRevSound(); setShowFireworks(true); setTimeout(() => setShowFireworks(false), 2000); }}
              className="py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              🏍️ BRAAAP! 🏍️
            </button>
            <button
              onClick={() => setRaceMode(!raceMode)}
              className="py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xl font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              {raceMode ? '🏁 RACE MODE!' : '🌈 PARTY MODE!'}
            </button>
            <button
              onClick={() => { playWinSound(); setShowFireworks(true); setTimeout(() => setShowFireworks(false), 2000); }}
              className="py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white text-xl font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              🎉 CELEBRATE! 🎉
            </button>
            <button
              onClick={tellJoke}
              className="py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-black rounded-2xl transform hover:scale-105 transition-all"
            >
              😂 DAD JOKE! 😂
            </button>
          </div>

          {/* Footer Message */}
          <div className="text-center bg-white/20 backdrop-blur rounded-2xl p-6">
            <p className="text-2xl font-black text-white mb-2">
              👨‍👧‍👦 Best Dad Ever! 👨‍👧‍👦
            </p>
            <p className="text-white/80">
              Racing through life with the best crew! 🏍️❤️
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {['🏆', '🏍️', '❤️', '👨‍👧‍👦', '🔥', '🏁', '⭐'].map((e, i) => (
                <span key={i} className="text-3xl animate-float" style={{ animationDelay: `${i * 0.2}s` }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
