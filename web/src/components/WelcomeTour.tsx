"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// First-run welcome: pick your path (Oddo coaches you vs bring your own
// programming), then a quick map of the app. Shown once per account.

interface WelcomeTourProps {
  userId: string;
  onDone: () => void;
}

export default function WelcomeTour({ userId, onDone }: WelcomeTourProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [dismissed, setDismissed] = useState(false);

  const markOnboarded = async () => {
    setDismissed(true);
    onDone();
    try {
      await updateDoc(doc(db, "users", userId), { onboardedAt: Timestamp.now() });
    } catch (err) {
      console.error("Error saving onboarding state:", err);
    }
  };

  const chooseOddo = async () => {
    await markOnboarded();
    router.push("/programming");
  };

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {step === 1 ? (
          <>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white text-center">
              <div className="text-4xl mb-2">👋</div>
              <h1 className="text-2xl font-bold">Welcome to CoachODDO</h1>
              <p className="text-purple-100 text-sm mt-1">How do you want to train?</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={chooseOddo}
                className="w-full p-4 rounded-xl border-2 border-purple-300 bg-purple-50 hover:border-purple-500 hover:shadow-md text-left transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🤖</span>
                  <div>
                    <p className="font-bold text-gray-900">Coach me, Oddo</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Tell Oddo your goals, schedule, and equipment. It runs you through a few baseline
                      tests, then builds and manages your full training plan.
                    </p>
                    <p className="text-xs text-purple-600 font-semibold mt-1.5">Recommended • free trial included →</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-md text-left transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">📝</span>
                  <div>
                    <p className="font-bold text-gray-900">I&apos;ve got my own programming</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Put workouts on your calendar yourself (or scan them from a photo), log results,
                      and track PRs - free forever.
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 pt-1"
              >
                Just show me around
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white text-center">
              <h1 className="text-xl font-bold">Your quick map 🗺️</h1>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {[
                  { icon: "🏠", name: "Home", desc: "Your training calendar - every workout lives here. Log results right from each day's card." },
                  { icon: "🤖", name: "Oddo", desc: "Your AI coach - baselines, full training plans, and workout scanning." },
                  { icon: "📋", name: "My Plan", desc: "Your locked training plan as a day-by-day table with done/missed tracking." },
                  { icon: "📖", name: "Records", desc: "Your logbook - WODs, lifts, skills, cardio, and the 🎯 Benchmarks Oddo coaches from." },
                  { icon: "📈", name: "Progress", desc: "Charts and trends built from everything you log." },
                ].map(row => (
                  <div key={row.name} className="flex items-start gap-3">
                    <span className="text-2xl">{row.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{row.name}</p>
                      <p className="text-xs text-gray-600">{row.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={markOnboarded}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
                >
                  Let&apos;s Go
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
