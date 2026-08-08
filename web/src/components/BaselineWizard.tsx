"use client";

import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BaselineStatus,
  BaselineItem,
  BaselineCategory,
  BaselineCategoryStatus,
} from "@/lib/baselines";

// Conversational baseline flow:
// 1. If we can't tell what equipment the athlete has, ask.
// 2. Show the FULL standard battery, organized by category, with inline
//    quick-log forms for everything not yet logged.
// 3. "Can't log the rest? Let me program those tests" - schedules the
//    missing minimum on the calendar.

interface BaselineWizardProps {
  userId: string;
  status: BaselineStatus;
  trainingStyle?: string;
  trainingEnvironment?: string;
  equipment: string;
  onEquipmentNote: (note: string) => void;
  onLogged: (category: BaselineCategory, itemName: string) => void;
  onScheduleRemaining: () => void;
  scheduling: boolean;
}

const LOADABLE_RE = /(barbell|dumbbell|\bdbs?\b|kettlebell|\bkbs?\b|sandbag|plate|weight)/i;
const TIME_BASED_KEYS = new Set(["wall_sit", "plank_hold", "handstand_hold"]);
// Fixed-distance cardio tests: log with mm:ss, distance and activity implied
const FIXED_CARDIO: Record<string, { miles: number; activity: string }> = {
  mile_run: { miles: 1, activity: "run" },
  run_5k: { miles: 3.1, activity: "run" },
  run_10k: { miles: 6.2, activity: "run" },
  fan_bike: { miles: 2, activity: "bike_road" },
  row_2k: { miles: 1.24, activity: "row" },
};

interface EntryState {
  a: string; // weight / reps / minutes / rounds / miles
  b: string; // reps / seconds / extra reps / minutes
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
  const [openSection, setOpenSection] = useState<string | null>(null);

  const getEntry = (key: string): EntryState => entries[key] || { a: "", b: "", saving: false, saved: false };
  const patchEntry = (key: string, patch: Partial<EntryState>) =>
    setEntries(prev => ({ ...prev, [key]: { ...getEntry(key), ...patch } }));

  const equipmentKnown = (trainingEnvironment || "home") === "commercial" || equipment.trim().length > 0 || equipmentAnswer !== null;
  const hasLoad = (trainingEnvironment || "home") === "commercial" ||
    LOADABLE_RE.test(equipment) ||
    (equipmentAnswer !== null && equipmentAnswer !== "none");

  const strengthDone = status.lifts.done.length + status.bodyweight.done.length;
  const sections: { name: string; needText: string; met: boolean; cat: BaselineCategoryStatus }[] = [
    ...(hasLoad
      ? [{ name: "Lifts", needText: "need 2 strength total (lifts or bodyweight)", met: strengthDone >= 2, cat: status.lifts }]
      : []),
    { name: "Bodyweight", needText: hasLoad ? "also count toward the 2 strength tests" : "need 2 (these are your strength tests)", met: strengthDone >= 2, cat: status.bodyweight },
    { name: "Cardio", needText: "need 1", met: status.cardio.done.length >= 1, cat: status.cardio },
    { name: "Benchmark WODs", needText: general ? "optional for general gym training" : "need 1", met: status.wods.done.length >= 1, cat: status.wods },
    { name: "Skills", needText: general ? "optional for general gym training" : "need 1", met: status.skills.done.length >= 1, cat: status.skills },
  ];

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
        const d = new Date();
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (FIXED_CARDIO[item.key]) {
          const totalSeconds = (parseInt(entry.a) || 0) * 60 + (parseInt(entry.b) || 0);
          if (totalSeconds <= 0) throw new Error("Enter your time");
          await addDoc(collection(db, "cardioLogs"), {
            userId, activity: FIXED_CARDIO[item.key].activity, miles: FIXED_CARDIO[item.key].miles, timeInSeconds: totalSeconds,
            date: now(), dateString, notes: `Baseline: ${item.name}`, createdAt: now(),
          });
        } else {
          const miles = parseFloat(entry.a) || 0;
          const minutes = parseInt(entry.b) || 0;
          if (miles <= 0 && minutes <= 0) throw new Error("Enter miles and/or minutes");
          await addDoc(collection(db, "cardioLogs"), {
            userId, activity: item.key === "swim" ? "swim" : "bike_road", miles, timeInSeconds: minutes * 60,
            date: now(), dateString, notes: `Baseline: ${item.name}`, createdAt: now(),
          });
        }
      } else if (item.category === "wod") {
        const isAmrap = item.key === "cindy";
        if (isAmrap) {
          const rounds = parseInt(entry.a);
          if (!rounds && rounds !== 0) throw new Error("Enter your rounds");
          await addDoc(collection(db, "workoutLogs"), {
            userId, wodTitle: item.name, wodDescription: item.description,
            workoutDate: now(), completedDate: now(), resultType: "rounds",
            rounds: rounds || 0, reps: parseInt(entry.b) || 0,
            notes: "Baseline test", isPersonalRecord: false,
          });
        } else {
          const totalSeconds = (parseInt(entry.a) || 0) * 60 + (parseInt(entry.b) || 0);
          if (totalSeconds <= 0) throw new Error("Enter your time");
          await addDoc(collection(db, "workoutLogs"), {
            userId, wodTitle: item.name, wodDescription: item.description,
            workoutDate: now(), completedDate: now(), resultType: "time",
            timeInSeconds: totalSeconds, notes: "Baseline test", isPersonalRecord: false,
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

  const smallInput = "w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white";

  const renderForm = (item: BaselineItem) => {
    const entry = getEntry(item.key);
    if (item.category === "lift") {
      return (
        <>
          <input type="number" inputMode="decimal" min="0" placeholder="Weight" value={entry.a}
            onChange={(e) => patchEntry(item.key, { a: e.target.value })} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
          <span className="text-xs text-gray-500">lbs ×</span>
          <input type="number" inputMode="numeric" min="1" placeholder="5" value={entry.b}
            onChange={(e) => patchEntry(item.key, { b: e.target.value })} className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
          <span className="text-xs text-gray-500">reps</span>
        </>
      );
    }
    if (item.category === "skill" || item.category === "bodyweight") {
      return (
        <>
          <input type="number" inputMode="numeric" min="0" placeholder={TIME_BASED_KEYS.has(item.key) ? "Seconds" : "Reps"} value={entry.a}
            onChange={(e) => patchEntry(item.key, { a: e.target.value })} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-sm text-gray-900 bg-white" />
          <span className="text-xs text-gray-500">{TIME_BASED_KEYS.has(item.key) ? "seconds" : "reps"}</span>
        </>
      );
    }
    if (item.category === "cardio") {
      if (FIXED_CARDIO[item.key]) {
        return (
          <>
            <input type="number" inputMode="numeric" min="0" placeholder="min" value={entry.a}
              onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={smallInput} />
            <span className="text-xs text-gray-500">:</span>
            <input type="number" inputMode="numeric" min="0" max="59" placeholder="sec" value={entry.b}
              onChange={(e) => patchEntry(item.key, { b: e.target.value })} className={smallInput} />
          </>
        );
      }
      return (
        <>
          <input type="number" inputMode="decimal" min="0" placeholder="miles" value={entry.a}
            onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={smallInput} />
          <span className="text-xs text-gray-500">mi in</span>
          <input type="number" inputMode="numeric" min="0" placeholder="min" value={entry.b}
            onChange={(e) => patchEntry(item.key, { b: e.target.value })} className={smallInput} />
          <span className="text-xs text-gray-500">min</span>
        </>
      );
    }
    // WOD
    if (item.key === "cindy") {
      return (
        <>
          <input type="number" inputMode="numeric" min="0" placeholder="Rounds" value={entry.a}
            onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={smallInput} />
          <span className="text-xs text-gray-500">+</span>
          <input type="number" inputMode="numeric" min="0" placeholder="Reps" value={entry.b}
            onChange={(e) => patchEntry(item.key, { b: e.target.value })} className={smallInput} />
        </>
      );
    }
    return (
      <>
        <input type="number" inputMode="numeric" min="0" placeholder="min" value={entry.a}
          onChange={(e) => patchEntry(item.key, { a: e.target.value })} className={smallInput} />
        <span className="text-xs text-gray-500">:</span>
        <input type="number" inputMode="numeric" min="0" max="59" placeholder="sec" value={entry.b}
          onChange={(e) => patchEntry(item.key, { b: e.target.value })} className={smallInput} />
      </>
    );
  };

  return (
    <div className="p-4 bg-purple-50 border-b border-purple-100">
      <p className="font-semibold text-purple-900 text-sm mb-1">
        🎯 Before I can program real numbers, I need baselines. Minimum: {status.minimumDescription}.
      </p>

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
          <p className="text-sm text-purple-800 mb-3">
            Already know any of these numbers? Log them right here - no test needed:
          </p>
          <div className="space-y-2">
            {sections.map(section => {
              const isOpen = openSection === section.name;
              const met = section.met;
              return (
                <div key={section.name} className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenSection(isOpen ? null : section.name)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-purple-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-900">
                      {met ? "✅" : "⬜"} {section.name}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {section.cat.done.length}/{section.cat.done.length + section.cat.missing.length} logged • {section.needText}
                      </span>
                    </span>
                    <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-purple-100 pt-2">
                      {section.cat.done.map(item => (
                        <div key={item.key} className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <span className="text-green-600 font-bold">✓</span>
                          <span className="text-green-800">{item.name}</span>
                        </div>
                      ))}
                      {section.cat.missing.map(item => {
                        const entry = getEntry(item.key);
                        if (entry.saved) {
                          return (
                            <div key={item.key} className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm">
                              <span className="text-green-600 font-bold">✓</span>
                              <span className="text-green-800">{item.name} logged</span>
                            </div>
                          );
                        }
                        return (
                          <div key={item.key} className="px-2 py-2 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {renderForm(item)}
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
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-purple-800">
              Haven&apos;t tested some yet? That&apos;s what I&apos;m here for.
            </p>
            <button
              onClick={onScheduleRemaining}
              disabled={scheduling}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {scheduling ? "Scheduling..." : "Program my baseline tests"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
