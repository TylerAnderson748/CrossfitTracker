"use client";

// Devin's Tab - born at a pool table, zero fitness value, maximum buttons.
// Everything is client-side; scores persist in localStorage only.

import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";

const TRASH_TALK = [
  "Signs point to scratch.",
  "Outlook not so good... for your opponent.",
  "The 8-ball says: bank it, coward.",
  "Absolutely. Call the corner pocket.",
  "Ask again after this shot.",
  "My sources say Devin is due for a miss.",
  "100%. Unless you choke.",
  "The felt gods demand a jump shot.",
  "Reply hazy. Chalk up and try again.",
  "It is known: whoever reads this wins.",
  "Don't scratch. That's the whole strategy.",
  "Yes, but only if you call your shot loudly.",
];

const CLICK_TITLES: [number, string][] = [
  [0, "Button Rookie"],
  [25, "Click Apprentice"],
  [75, "Certified Clicker"],
  [150, "Button Crusher"],
  [300, "Clickzilla"],
  [500, "The Devin"],
  [1000, "ASCENDED THUMB"],
];

const CONFETTI_EMOJI = ["🎱", "🎉", "🔥", "💥", "⭐", "🏆", "🍀", "💸"];

interface Burst {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

export default function DevinPage() {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [nameA, setNameA] = useState("Tyler");
  const [nameB, setNameB] = useState("Devin");
  const [clicks, setClicks] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [eightBall, setEightBall] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [coin, setCoin] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [partyMode, setPartyMode] = useState(false);
  const burstId = useRef(0);

  // Load + persist the important state (the pool score, obviously)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("devins_tab") || "{}");
      if (typeof saved.scoreA === "number") setScoreA(saved.scoreA);
      if (typeof saved.scoreB === "number") setScoreB(saved.scoreB);
      if (saved.nameA) setNameA(saved.nameA);
      if (saved.nameB) setNameB(saved.nameB);
      if (typeof saved.clicks === "number") setClicks(saved.clicks);
    } catch { /* fresh start */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("devins_tab", JSON.stringify({ scoreA, scoreB, nameA, nameB, clicks }));
    } catch { /* storage unavailable - scores live for the session */ }
  }, [scoreA, scoreB, nameA, nameB, clicks]);

  const confetti = (count: number) => {
    const fresh: Burst[] = Array.from({ length: count }, () => ({
      id: ++burstId.current,
      emoji: CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)],
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.6 + Math.random() * 1.4,
      size: 18 + Math.random() * 26,
    }));
    setBursts(prev => [...prev.slice(-80), ...fresh]);
    window.setTimeout(() => {
      setBursts(prev => prev.filter(b => !fresh.some(f => f.id === b.id)));
    }, 3500);
  };

  const win = (who: "A" | "B") => {
    if (who === "A") setScoreA(s => s + 1);
    else setScoreB(s => s + 1);
    confetti(24);
  };

  const shake8Ball = () => {
    if (shaking) return;
    setShaking(true);
    setEightBall(null);
    window.setTimeout(() => {
      setEightBall(TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)]);
      setShaking(false);
    }, 900);
  };

  const flipCoin = () => {
    if (flipping) return;
    setFlipping(true);
    setCoin(null);
    window.setTimeout(() => {
      setCoin(Math.random() < 0.5 ? nameA : nameB);
      setFlipping(false);
      confetti(10);
    }, 800);
  };

  const megaClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next % 50 === 0) confetti(30);
    else if (next % 10 === 0) confetti(6);
  };

  const clickTitle = CLICK_TITLES.reduce((t, [n, label]) => (clicks >= n ? label : t), CLICK_TITLES[0][1]);

  return (
    <div className={`min-h-screen ${partyMode ? "animate-party" : "bg-gray-50"}`}>
      <Navigation />

      {/* Confetti layer */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {bursts.map(b => (
          <span
            key={b.id}
            className="absolute animate-fall"
            style={{
              left: `${b.left}%`,
              top: "-40px",
              fontSize: `${b.size}px`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          >
            {b.emoji}
          </span>
        ))}
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-900">
            🎱 Devin&apos;s Tab
          </h1>
          <p className="text-gray-500 mt-1">The most important tab in a fitness app.</p>
          <button
            onClick={() => { setPartyMode(p => !p); confetti(40); }}
            className="mt-3 px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 via-amber-400 to-cyan-400 text-white font-extrabold text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            {partyMode ? "🛑 Okay okay, chill" : "🪩 PARTY MODE"}
          </button>
        </div>

        {/* Pool scoreboard */}
        <section className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-emerald-200 mb-4">
            Official Pool Scoreboard
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {([["A", nameA, setNameA, scoreA] as const, ["B", nameB, setNameB, scoreB] as const]).map(
              ([who, name, setName, score]) => (
                <div key={who} className="bg-white/10 rounded-xl p-4 text-center">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 14))}
                    className="w-full bg-transparent text-center font-bold text-lg outline-none border-b border-white/20 focus:border-white/60 mb-2"
                  />
                  <div className="text-6xl font-black tabular-nums mb-3">{score}</div>
                  <button
                    onClick={() => win(who)}
                    className="w-full py-3 rounded-lg bg-amber-400 text-emerald-950 font-extrabold text-lg hover:bg-amber-300 active:scale-95 transition-all"
                  >
                    +1 WIN 🏆
                  </button>
                </div>
              )
            )}
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <div className="text-emerald-200 text-sm font-medium self-center">
              {scoreA === scoreB
                ? "Dead even. Tension rising."
                : `${scoreA > scoreB ? nameA : nameB} leads ${Math.max(scoreA, scoreB)}-${Math.min(scoreA, scoreB)}`}
            </div>
            <button
              onClick={() => { setScoreA(0); setScoreB(0); }}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              Reset
            </button>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Who breaks */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <h2 className="font-bold text-gray-900 mb-1">🪙 Who Breaks?</h2>
            <p className="text-xs text-gray-400 mb-4">Settle it like adults. With a fake coin.</p>
            <button
              onClick={flipCoin}
              disabled={flipping}
              className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-yellow-600 shadow-lg text-4xl font-black text-yellow-900 hover:scale-105 active:scale-90 transition-transform disabled:animate-spin"
            >
              {flipping ? "🪙" : coin ? "🎯" : "FLIP"}
            </button>
            <div className="mt-4 h-8 text-xl font-extrabold text-gray-900">
              {coin ? `${coin} breaks!` : flipping ? "..." : ""}
            </div>
          </section>

          {/* Magic 8-ball */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <h2 className="font-bold text-gray-900 mb-1">🎱 Pool Oracle</h2>
            <p className="text-xs text-gray-400 mb-4">Ask it anything. It only knows pool.</p>
            <button
              onClick={shake8Ball}
              className={`w-28 h-28 rounded-full bg-gray-950 shadow-lg flex items-center justify-center text-4xl hover:scale-105 active:scale-90 transition-transform ${shaking ? "animate-wiggle" : ""}`}
            >
              <span className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-gray-950 text-xl font-black">8</span>
            </button>
            <div className="mt-4 min-h-12 text-sm font-semibold text-gray-700 italic">
              {shaking ? "consulting the felt gods..." : eightBall || "Tap the ball."}
            </div>
          </section>
        </div>

        {/* The Button */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="font-bold text-gray-900 mb-1">💥 The Button</h2>
          <p className="text-xs text-gray-400 mb-4">It does nothing. People love it.</p>
          <button
            onClick={megaClick}
            className="px-12 py-8 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 text-white text-3xl font-black shadow-xl hover:shadow-2xl hover:scale-105 active:scale-90 transition-all select-none"
          >
            PRESS ME
          </button>
          <div className="mt-4 text-2xl font-black tabular-nums text-gray-900">{clicks.toLocaleString()}</div>
          <div className="text-sm font-semibold text-rose-600">Rank: {clickTitle}</div>
          <div className="text-xs text-gray-400 mt-1">Every 50 presses: confetti. That&apos;s the economy.</div>
        </section>

        <p className="text-center text-xs text-gray-400 pb-8">
          Made for Devin during a pool game. Scores are stored on this device only.
        </p>
      </main>

      <style jsx global>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.7; }
        }
        .animate-fall { animation-name: fall; animation-timing-function: ease-in; animation-fill-mode: forwards; }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-14deg); }
          40% { transform: rotate(12deg); }
          60% { transform: rotate(-8deg); }
          80% { transform: rotate(6deg); }
        }
        .animate-wiggle { animation: wiggle 0.45s ease-in-out infinite; }
        @keyframes partybg {
          0% { background-color: #fdf2f8; }
          25% { background-color: #eff6ff; }
          50% { background-color: #f0fdf4; }
          75% { background-color: #fefce8; }
          100% { background-color: #fdf2f8; }
        }
        .animate-party { animation: partybg 2.5s linear infinite; }
      `}</style>
    </div>
  );
}
