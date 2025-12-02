"use client";

import { useEffect, useState } from "react";
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

  const handleClick = () => {
    setClickCount((c) => c + 1);
    if (clickCount >= 4) {
      setChaosMode(!chaosMode);
      setClickCount(0);
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
    <div className={`min-h-screen bg-black ${lightningFlash ? 'bg-white' : ''} transition-colors duration-75`}>
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

        @keyframes static-noise {
          0% { background-position: 0 0; }
          100% { background-position: 100% 100%; }
        }

        .animate-flicker {
          animation: flicker 3s infinite;
        }

        .animate-blood-drip {
          animation: blood-drip 4s linear infinite;
        }

        .animate-float-ghost {
          animation: float-ghost 6s ease-in-out infinite;
        }

        .animate-pulse-red {
          animation: pulse-red 2s ease-in-out infinite;
        }

        .animate-glitch {
          animation: glitch 0.3s infinite;
        }

        .animate-shake-violent {
          animation: shake-violent 0.5s infinite;
        }

        .animate-rise {
          animation: rise-from-below 1s ease-out forwards;
        }

        .animate-creepy-hover {
          animation: creepy-hover 4s ease-in-out infinite;
        }

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
      `}</style>

      <Navigation />

      <main className={`max-w-4xl mx-auto px-4 py-8 relative overflow-hidden vignette min-h-screen ${glitchMode ? 'animate-glitch' : ''} ${chaosMode ? 'animate-shake-violent' : ''}`}>
        {/* Scan line effect */}
        <div className="fixed inset-0 pointer-events-none scan-line" />

        {/* Floating skulls/ghosts background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {['💀', '👻', '🦇', '🕷️', '⚰️', '🩸', '😈', '🖤', '☠️', '🌑'].map((emoji, i) => (
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

        {/* Blood drips */}
        <div className="fixed top-0 left-0 right-0 pointer-events-none overflow-hidden h-full">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 bg-gradient-to-b from-red-900 via-red-600 to-transparent animate-blood-drip"
              style={{
                left: `${10 + i * 12}%`,
                height: '100px',
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center pt-20">
          {/* Giant sinister title */}
          <h1
            className="text-6xl md:text-8xl font-black mb-8 cursor-pointer select-none animate-pulse-red"
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
          <p className="text-2xl text-gray-500 mb-8 animate-flicker font-mono">
            We&apos;ve been expecting you...
          </p>

          {/* Sinister emoji row */}
          <div className="flex justify-center gap-4 mb-12">
            {['💀', '🔥', '⚡', '🩸', '😈', '☠️'].map((emoji, i) => (
              <span
                key={i}
                className="text-5xl animate-creepy-hover"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {emoji}
              </span>
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

          {/* Dark stats */}
          <div className="grid grid-cols-3 gap-4 mt-12">
            {[
              { label: 'Fear Level', value: '666', emoji: '😱' },
              { label: 'Darkness', value: 'MAX', emoji: '🌑' },
              { label: 'Souls Collected', value: '∞', emoji: '👻' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-gray-900/60 backdrop-blur rounded-2xl p-6 border border-red-900/50 animate-rise"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-3xl font-black text-red-500 animate-flicker">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Ominous message */}
          <div className="mt-12 p-6 bg-black/80 border border-red-900 rounded-xl">
            <p className="text-red-400 font-mono text-lg animate-flicker">
              &quot;In the shadows, strength is forged...&quot;
            </p>
            <p className="text-gray-600 text-sm mt-2">- Ancient Gym Proverb</p>
          </div>

          {/* Creepy scrolling text */}
          <div className="mt-12 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee-slow">
              <span className="text-2xl text-red-900/60 mx-8">💀 EMBRACE THE DARKNESS 💀</span>
              <span className="text-2xl text-red-900/60 mx-8">🔥 NO PAIN NO GAIN 🔥</span>
              <span className="text-2xl text-red-900/60 mx-8">⚡ BLAKE MODE ACTIVATED ⚡</span>
              <span className="text-2xl text-red-900/60 mx-8">😈 FEAR IS FUEL 😈</span>
              <span className="text-2xl text-red-900/60 mx-8">💀 EMBRACE THE DARKNESS 💀</span>
            </div>
          </div>
        </div>
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
