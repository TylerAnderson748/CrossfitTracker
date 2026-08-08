"use client";

import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BaselineStatus,
  BaselineItem,
  BaselineCategory,
  BASELINE_CARDIO,
} from "@/lib/baselines";

// Conversational baseline flow:
// 1. If we can't tell what equipment the athlete has, ask.
// 2. "Can you log any of these already?" - inline quick-log for each needed test.
// 3. "Can't log the rest? Let me program those tests" - schedules the remainder.

interface BaselineWizardProps {
  userId: string;
  status: BaselineStatus;
  trainingStyle?: string;
  trainingEnvironment?: string;
  equipment: string;
  // Persist an equipment note the athlete gives us ("Has dumbbells", "bodyweight only")
  onEquipmentNote: (note: string) => void;
  // Parent updates its baseline data so status recomputes immediately
  onLogged: (category: BaselineCategory, itemName: string) => void;
  // Schedule the remaining missing tests on the calendar
  onScheduleRemaining: () => void;
  scheduling: boolean;
}

const LOADABLE_RE = /(barbell|dumbbell|\bdbs?\b|kettlebell|\bkbs?\b|sandbag|plate|weight)/i;
const TIME_BASED_KEYS = new Set(["wall_sit", "plank_hold", "handstand_hold"]);

interface EntryState {
  a: string; // weight / reps / minutes / rounds
  b: string; // reps / seconds / extra reps
  saving: boolean;
  saved: boolean;
}

export default function BaselineWizard({
  userId,
  status,
  trainingStyle,
  trainingEnvironment,
  equipment,
  onEquipmentNote,
  onLogged,
  onScheduleRemaining,
  scheduling,
}: BaselineWizardProps) {
  const general = trainingStyle === "general";
  const [equipmentAnswer, setEquipmentAnswer] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, EntryState>>({});

  const getEntry = (key: string): EntryState => entries[key] || { a: "", b: "", saving: false, saved: false };
  const patchEntry = (key: string, patch: Partial<EntryState>) =>
    setEntries(prev => ({ ...prev, [key]: { ...getEntry(key), ...patch } }));

  // Do we know whether they can load anything?
  const equipmentKnown = (trainingEnvironment || "home") === "commercial" || equipment.trim().length > 0 || equipmentAnswer !== null;
  const hasLoad = (trainingEnvironment || "home") === "commercial" ||
    LOADABLE_RE.test(equipment) ||
    (equipmentAnswer !== null && equipmentAnswer !== "none");

  // The tests still needed to reach the minimum
  const strengthNeeded = Math.max(0, 2 - (status.lifts.done.length + status.bodyweight.done.length));
  const neededTests: BaselineItem[] = [
    ...(hasLoad ? status.lifts.missing : status.bodyweight.missing).slice(0, strengthNeeded),
    ...(status.cardio.done.length === 0 ? [BASELINE_CARDIO.find(c => c.key === "mile_run")!] : []),
    ...(!general && status.wods.done.length === 0
      ? [status.wods.missing.find(w => w.key === "cindy") || status.wods.missing[0]].filter(Boolean)
      : []),
    ...(!general && status.skills.done.length === 0
      ? [status.skills.missing.find(s => s.key === "max_pushups") || status.skills.missing[0]].filter(Boolean)
      : []),
  ];
  const unsavedCount = neededTests.filter(t => !getEntry(t.key).saved).length;

  const now = () => Timestamp.now();

  const saveTest = async (item: BaselineItem) => {
    const entry = getEntry(item.key);
    patchEntry(item.key, { saving: true });
    try {
      if (item.category === "lift") {
        const weight = parseFloat(entry.a);
        if (!weight || weight <= 0) throw new Error("Enter the weight you lifted");
        await addDoc(collection(db, "liftResults"), {
          userId,
          liftTitle: item.name,
          weight,
          reps: parseInt(entry.b) || 5,
          date: now(),
          isPersonalRecord: false,
        });
      } else if (item.category === "skill" || item.category === "bodyweight") {
        const score = parseInt(entry.a);
        if (!score || score <= 0) throw new Error(TIME_BASED_KEYS.has(item.key) ? "Enter the seconds you held" : "Enter your rep count");
        await addDoc(collection(db, "skillResults"), {
          userId,
          skillTitle: item.name,
          maxReps: score,
          notes: TIME_BASED_KEYS.has(item.key) ? "Baseline test (seconds)" : "Baseline test",
          date: now(),
          isPersonalRecord: false,
        });
      } else if (item.category === "cardio") {
        const totalSeconds = (parseInt(entry.a) || 0) * 60 + (parseInt(entry.b) || 0);
        if (totalSeconds <= 0) throw new Error("Enter your mile time");
        const d = new Date();
        await addDoc(collection(db, "cardioLogs"), {
          userId,
          activity: "run",
          miles: 1,
          timeInSeconds: totalSeconds,
          date: now(),
          dateString: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          notes: `Baseline: ${item.name}`,
          createdAt: now(),
        });
      } else if (item.category === "wod") {
        const isAmrap = item.key === "cindy";
        if (isAmrap) {
          const rounds = parseInt(entry.a);
          if (!rounds && rounds !== 0) throw new Error("Enter your rounds");
          await addDoc(collection(db, "workoutLogs"), {
            userId,
            wodTitle: item.name,
            wodDescription: item.description,
            workoutDate: now(),
            completedDate: now(),
            resultType: "rounds",
            rounds: rounds || 0,
            reps: parseInt(entry.b) || 0,
            notes: "Baseline test",
            isPersonalRecord: false,
          });
        } else {
          const totalSeconds = (parseInt(entry.a) || 0) * 60 + (parseInt(entry.b) || 0);
          if (totalSeconds <= 0) throw new Error("Enter your time");
          await addDoc(collection(db, "workoutLogs"), {
            userId,
            wodTitle: item.name,
            wodDescription: item.description,
            workoutDate: now(),
            completedDate: now(),
            resultType: "time",
            timeInSeconds: totalSeconds,
            notes: "Baseline test",
            isPersonalRecord: false,
          });
        }
      }
      patchEntry(item.key, { saving: false, saved: true });
      onLogged(item.category, item.name);
    } catch (err) {
      patchEntry(item.key, { saving: false });
      alert(err instanceof Error ? err.message : "Couldn't save - try again");
    }
  };

  const inputCls = "w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white";

  return (
    <div className="p-4 bg-purple-50 border-b border-purple-100">
      <p className="font-semibold text-purple-900 text-sm mb-1">
        🎯 Before I can program real numbers, I need a few baselines ({status.minimumDescription}).
      </p>

      {/* Step 1: equipment question when we can't tell */}
      {!equipmentKnown ? (
        <div className="mt-2">
          <p className="text-sm text-purple-800 mb-2">Quick question first - what do you have to lift with?</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "barbell", label: "🏋️ Barbell + plates", note: "Has a barbell and plates" },
              { key: "dumbbells", label: "💪 Dumbbells / kettlebell", note: "Has dumbbells and/or a kettlebell" },
              { key: "none", label: "🙌 Nothing - bodyweight only", note: "No loadable equipment - bodyweight only" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => { setEquipmentAnswer(opt.key); onEquipmentNote(opt.note); }}
                className="px-3 py-2 bg-white border border-purple-300 hover:bg-purple-100 rounded-lg text-sm text-purple-900 font-medium transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Step 2: inline quick-log for each needed test */}
          <p className="text-sm text-purple-800 mb-3">
            Already know any of these numbers? Log them right here - no test needed:
          </p>
          <div className="space-y-2">
            {neededTests.map(item => {
              const entry = getEntry(item.key);
              if (entry.saved) {
                return (
                  <div key={item.key} className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-green-800 font-medium">{item.name} logged</span>
                  </div>
                );
              }
              return (
                <div key={item.key} className="p-2.5 bg-white border border-purple-200 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {item.category === "lift" && (
                      <>
                        <input type="number" inputMode="decimal" min="0" placeholder="Weight" value={entry.a}
                          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={inputCls} />
                        <span className="text-xs text-gray-500">lbs ×</span>
                        <input type="number" inputMode="numeric" min="1" placeholder="5" value={entry.b}
                          onChange={(e) => patchEntry(item.key, { b: e.target.value })} className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                        <span className="text-xs text-gray-500">reps</span>
                      </>
                    )}
                    {(item.category === "skill" || item.category === "bodyweight") && (
                      <>
                        <input type="number" inputMode="numeric" min="0" placeholder={TIME_BASED_KEYS.has(item.key) ? "Seconds" : "Reps"} value={entry.a}
                          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={inputCls} />
                        <span className="text-xs text-gray-500">{TIME_BASED_KEYS.has(item.key) ? "seconds" : "reps"}</span>
                      </>
                    )}
                    {item.category === "cardio" && (
                      <>
                        <input type="number" inputMode="numeric" min="0" placeholder="min" value={entry.a}
                          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                        <span className="text-xs text-gray-500">:</span>
                        <input type="number" inputMode="numeric" min="0" max="59" placeholder="sec" value={entry.b}
                          onChange={(e) => patchEntry(item.key, { b: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                      </>
                    )}
                    {item.category === "wod" && (item.key === "cindy" ? (
                      <>
                        <input type="number" inputMode="numeric" min="0" placeholder="Rounds" value={entry.a}
                          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={inputCls} />
                        <span className="text-xs text-gray-500">+</span>
                        <input type="number" inputMode="numeric" min="0" placeholder="Reps" value={entry.b}
                          onChange={(e) => patchEntry(item.key, { b: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                      </>
                    ) : (
                      <>
                        <input type="number" inputMode="numeric" min="0" placeholder="min" value={entry.a}
                          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                        <span className="text-xs text-gray-500">:</span>
                        <input type="number" inputMode="numeric" min="0" max="59" placeholder="sec" value={entry.b}
                          onChange={(e) => patchEntry(item.key, { b: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
                      </>
                    ))}
                    <button
                      onClick={() => saveTest(item)}
                      disabled={entry.saving}
                      className="ml-auto px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {entry.saving ? "..." : "Log It"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step 3: offer to program whatever they can't log */}
          {unsavedCount > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-purple-800">
                Haven&apos;t tested {unsavedCount === neededTests.length ? "these" : "the rest"} yet? That&apos;s what I&apos;m here for.
              </p>
              <button
                onClick={onScheduleRemaining}
                disabled={scheduling}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Program my baseline tests"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
