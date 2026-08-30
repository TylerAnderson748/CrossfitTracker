"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, Timestamp, limit, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { computeBaselineStatus } from "@/lib/baselines";
import { AICoachPreferences, WorkoutComponent } from "@/lib/types";
import { chatCompletion } from "@/lib/ai";

// Types for user workout history
interface LiftHistoryEntry {
  liftTitle: string;
  weight: number;
  reps: number;
  date: Timestamp;
  // "working" = programmed submaximal sets; "max"/missing = true rep-max attempt
  setType?: "max" | "working";
}

interface WodHistoryEntry {
  wodTitle: string;
  timeInSeconds?: number;
  rounds?: number;
  reps?: number;
  category: string;
  completedDate: Timestamp;
  aiCoachFeedback?: string;
}

interface UserWorkoutHistory {
  lifts: LiftHistoryEntry[];
  wods: WodHistoryEntry[];
}

// Personal workout type (from AI programming, scan, or manual entry)
interface PersonalWorkout {
  id: string;
  components: WorkoutComponent[];
  notes?: string;
}

interface SessionFeedbackEntry {
  dateString: string;
  titles: string;
  rating: "easy" | "right" | "hard";
  note?: string;
}

const feedbackRatingLabels: Record<"easy" | "right" | "hard", string> = {
  easy: "too easy",
  right: "about right",
  hard: "very hard",
};

interface PersonalAITrainerProps {
  userId: string;
  todayPersonalWorkouts?: PersonalWorkout[];
  userPreferences?: AICoachPreferences;
}

// Generate a unique ID for storing advice. Includes a hash of the day's
// component CONTENT (not just workout ids) so advice regenerates when the
// programming changes - e.g. after scanning the class whiteboard.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function getAdviceDocId(userId: string, workouts?: PersonalWorkout[]): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const idPart = workouts?.map(pw => pw.id).join('_') || 'personal';
  const contentPart = hashString(
    (workouts || [])
      .flatMap(pw => pw.components || [])
      .map(c => `${c.type}|${c.title}|${c.description}|${c.notes || ''}`)
      .join('~')
  );
  return `${userId}_${today}_${idPart}_${contentPart}`;
}

export default function PersonalAITrainer({ userId, todayPersonalWorkouts, userPreferences }: PersonalAITrainerProps) {
  // Check if there's any workout to analyze
  const hasWorkoutToAnalyze = todayPersonalWorkouts && todayPersonalWorkouts.length > 0;
  const [userHistory, setUserHistory] = useState<UserWorkoutHistory>({ lifts: [], wods: [] });
  const [sessionFeedbacks, setSessionFeedbacks] = useState<SessionFeedbackEntry[]>([]);
  const [baselineData, setBaselineData] = useState<{ skillNames: string[]; cardioLogs: { activity: string; miles?: number; dateString?: string }[]; trainingStyle: string; equipment: string } | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [hasCheckedSavedAdvice, setHasCheckedSavedAdvice] = useState(false);

  // Check for existing saved advice on mount
  useEffect(() => {
    const loadSavedAdvice = async () => {
      if (!userId || !hasWorkoutToAnalyze) {
        setHasCheckedSavedAdvice(true);
        return;
      }

      try {
        const adviceDocId = getAdviceDocId(userId, todayPersonalWorkouts);
        const adviceDoc = await getDoc(doc(db, "aiCoachAdvice", adviceDocId));

        if (adviceDoc.exists()) {
          const savedAdvice = adviceDoc.data();
          setAiAdvice(savedAdvice.advice);
        }
      } catch (err) {
        console.error("Error loading saved advice:", err);
      } finally {
        setHasCheckedSavedAdvice(true);
      }
    };

    loadSavedAdvice();
  }, [userId, todayPersonalWorkouts, hasWorkoutToAnalyze]);

  // Load user workout history
  useEffect(() => {
    const loadUserHistory = async () => {
      if (!userId) return;

      try {
        // Fetch lift results
        const liftQuery = query(
          collection(db, "liftResults"),
          where("userId", "==", userId),
          limit(100)
        );
        const liftSnapshot = await getDocs(liftQuery);
        const lifts = liftSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            liftTitle: data.liftTitle || "",
            weight: data.weight || 0,
            reps: data.reps || 1,
            date: data.date,
            setType: data.setType,
          } as LiftHistoryEntry;
        }).filter(l => l.liftTitle && l.weight > 0);

        // Fetch WOD logs
        const wodQuery = query(
          collection(db, "workoutLogs"),
          where("userId", "==", userId),
          limit(100)
        );
        const wodSnapshot = await getDocs(wodQuery);
        const wods = wodSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            wodTitle: data.wodTitle || "",
            timeInSeconds: data.timeInSeconds,
            rounds: data.rounds,
            reps: data.reps,
            category: data.notes || data.category || "RX",
            completedDate: data.completedDate,
            aiCoachFeedback: data.aiCoachFeedback,
          } as WodHistoryEntry;
        }).filter(w => w.wodTitle);

        setUserHistory({ lifts, wods });

        // Baseline-battery data (skills, cardio, training style) so the
        // unlock gate matches Oddo's standard baseline minimum, plus recent
        // post-workout check-ins so advice reflects how training has felt
        const [skillSnap, cardioSnap, prefsSnap, pwSnap] = await Promise.all([
          getDocs(query(collection(db, "skillResults"), where("userId", "==", userId), limit(150))),
          getDocs(query(collection(db, "cardioLogs"), where("userId", "==", userId), limit(150))),
          getDocs(query(collection(db, "aiProgrammingPreferences"), where("userId", "==", userId))),
          getDocs(query(collection(db, "personalWorkouts"), where("userId", "==", userId), limit(150))),
        ]);
        const feedbacks: SessionFeedbackEntry[] = pwSnap.docs
          .map(d => d.data())
          .filter(d => d.sessionFeedback?.rating)
          .sort((a, b) => String(b.dateString || "").localeCompare(String(a.dateString || "")))
          .slice(0, 5)
          .map(d => ({
            dateString: String(d.dateString || ""),
            titles: ((d.components || []) as WorkoutComponent[]).map(c => c.title).filter(Boolean).slice(0, 3).join(", "),
            rating: d.sessionFeedback.rating,
            note: d.sessionFeedback.note || undefined,
          }));
        setSessionFeedbacks(feedbacks);
        setBaselineData({
          skillNames: Array.from(new Set(skillSnap.docs.map(d => String(d.data().skillTitle || d.data().skillName || "")).filter(Boolean))),
          cardioLogs: cardioSnap.docs.map(d => ({ activity: String(d.data().activity || ""), miles: Number(d.data().miles) || 0, dateString: String(d.data().dateString || "") })),
          trainingStyle: prefsSnap.empty ? "crossfit" : String(prefsSnap.docs[0].data().trainingStyle || "crossfit"),
          equipment: prefsSnap.empty ? "" : String(prefsSnap.docs[0].data().equipment || ""),
        });
        setHasLoadedHistory(true);
      } catch (err) {
        console.error("Error loading user history:", err);
        setHasLoadedHistory(true);
      }
    };

    loadUserHistory();
  }, [userId]);

  const getPersonalizedAdvice = async () => {
    if (!hasWorkoutToAnalyze || isLoading) return;

    setIsLoading(true);
    setIsStreaming(false);
    setAiAdvice(null);

    try {
      // Build workout description from today's workouts
      const workoutDescriptionParts: string[] = [];

      if (todayPersonalWorkouts && todayPersonalWorkouts.length > 0) {
        workoutDescriptionParts.push("TODAY'S WORKOUT:");
        todayPersonalWorkouts.forEach((pw) => {
          if (pw.components && pw.components.length > 0) {
            pw.components.forEach(comp => {
              let desc = `${comp.type.toUpperCase()}: ${comp.title}\n${comp.description || ""}`;
              if (comp.notes) {
                desc += `\nNotes: ${comp.notes}`;
              }
              workoutDescriptionParts.push(desc);
            });
          }
        });
      }

      const workoutDescription = workoutDescriptionParts.join("\n\n") || "No workout details";

      // Build user history summary
      let historySummary = "";
      const loggedLiftNames: string[] = [];
      if (userHistory.lifts.length > 0) {
        // Best TESTED result per lift per rep count (working sets are
        // programmed submaximal training, not PRs - they only contribute a
        // 1RM floor). Estimated 1RM uses Epley so the AI has a correct
        // anchor for % math.
        const epley = (weight: number, reps: number) => Math.round(weight * (1 + reps / 30));
        const liftGroups = new Map<string, { maxBests: Map<number, number>; e1rmFloor: number }>();
        userHistory.lifts.forEach(lift => {
          const group = liftGroups.get(lift.liftTitle) || { maxBests: new Map<number, number>(), e1rmFloor: 0 };
          if ((lift.setType || "max") === "max" && (group.maxBests.get(lift.reps) || 0) < lift.weight) {
            group.maxBests.set(lift.reps, lift.weight);
          }
          group.e1rmFloor = Math.max(group.e1rmFloor, epley(lift.weight, lift.reps));
          liftGroups.set(lift.liftTitle, group);
        });
        loggedLiftNames.push(...liftGroups.keys());

        historySummary += "Lift PRs:\n" + Array.from(liftGroups.entries())
          .map(([liftName, group]) => {
            // A tested single is the athlete's REAL 1RM - it beats any
            // Epley estimate, which can only fill in for untested lifts
            const tested1RM = group.maxBests.get(1);
            if (tested1RM) {
              const others = Array.from(group.maxBests.entries())
                .filter(([reps]) => reps !== 1)
                .sort((a, b) => a[0] - b[0])
                .map(([reps, weight]) => `${weight}lb x ${reps}`)
                .join(", ");
              return `- ${liftName}: TESTED 1RM ${tested1RM}lb${others ? ` (other maxes: ${others})` : ""} -> ALL % math uses ${tested1RM}lb`;
            }
            if (group.maxBests.size === 0) {
              return `- ${liftName}: no tested max yet; logged working sets imply a 1RM of at least ~${group.e1rmFloor}lb (estimate only)`;
            }
            const sets = Array.from(group.maxBests.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([reps, weight]) => `${weight}lb x ${reps}`)
              .join(", ");
            const e1rm = Math.max(
              group.e1rmFloor,
              ...Array.from(group.maxBests.entries()).map(([reps, weight]) => epley(weight, reps))
            );
            return `- ${liftName}: ${sets} (no tested single; estimated 1RM ~${e1rm}lb - present it as an estimate)`;
          })
          .join("\n");
      }

      if (userHistory.wods.length > 0) {
        historySummary += "\n\nRecent WOD Performances:\n" + userHistory.wods
          .slice(0, 10)
          .map(wod => {
            let result = "";
            if (wod.timeInSeconds && !wod.rounds) {
              const mins = Math.floor(wod.timeInSeconds / 60);
              const secs = wod.timeInSeconds % 60;
              result = `- ${wod.wodTitle}: ${mins}:${secs.toString().padStart(2, '0')} (${wod.category})`;
            } else if (wod.rounds !== undefined) {
              result = `- ${wod.wodTitle}: ${wod.rounds}+${wod.reps || 0} rounds (${wod.category})`;
            } else {
              result = `- ${wod.wodTitle} (${wod.category})`;
            }
            return result;
          })
          .join("\n");

        // Include recent feedback from the athlete
        const recentFeedback = userHistory.wods
          .filter(wod => wod.aiCoachFeedback)
          .slice(0, 5);
        if (recentFeedback.length > 0) {
          historySummary += "\n\nATHLETE'S RECENT FEEDBACK ON WORKOUTS:\n" + recentFeedback
            .map(wod => `- ${wod.wodTitle}: "${wod.aiCoachFeedback}"`)
            .join("\n");
        }
      }

      if (sessionFeedbacks.length > 0) {
        historySummary += "\n\nHOW RECENT SESSIONS FELT (athlete's post-workout check-ins - adjust intensity accordingly):\n" + sessionFeedbacks
          .map(f => `- ${f.dateString} (${f.titles || "session"}): felt ${feedbackRatingLabels[f.rating]}${f.note ? ` - "${f.note}"` : ""}`)
          .join("\n");
      }

      // Last-7-days training load so the coach can judge fatigue
      const nowMs = Date.now();
      const loadByDay = new Map<string, string[]>();
      const noteDay = (d: Date | undefined | null, s: string) => {
        if (!d) return;
        const ageDays = (nowMs - d.getTime()) / 86400000;
        if (ageDays < -1 || ageDays > 7) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        loadByDay.set(key, [...(loadByDay.get(key) || []), s]);
      };
      userHistory.lifts.forEach(l => noteDay(l.date?.toDate?.(), `${l.liftTitle} ${l.weight}x${l.reps}`));
      userHistory.wods.forEach(w => noteDay(w.completedDate?.toDate?.(), w.wodTitle));
      baselineData?.cardioLogs.forEach(c => {
        if (!c.dateString) return;
        const [yy, mm, dd] = c.dateString.split("-").map(Number);
        if (yy && mm && dd) noteDay(new Date(yy, mm - 1, dd, 12), `${c.activity}${c.miles ? ` ${c.miles}mi` : ""}`);
      });
      const feedbackByDay = new Map(sessionFeedbacks.map(f => [f.dateString, f]));
      let recentLoad = "";
      if (loadByDay.size > 0) {
        recentLoad = "\n\nLAST 7 DAYS OF TRAINING (judge fatigue from this - consecutive hard days, volume spikes, check-ins):\n" + Array.from(loadByDay.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 7)
          .map(([day, items]) => {
            const fb = feedbackByDay.get(day);
            return `- ${day}: ${items.slice(0, 5).join("; ")}${fb ? ` (felt ${feedbackRatingLabels[fb.rating]})` : ""}`;
          })
          .join("\n");
      }

      // Which of today's lift movements have ZERO logged history - computed
      // in code so "no data" is a stated fact, not a judgment the model can
      // wiggle out of (it once invented an "estimated bench 1RM" for a lift
      // with no bench data at all)
      const normLift = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const loggedNorm = loggedLiftNames.map(normLift).filter(Boolean);
      const noDataLifts: string[] = [];
      (todayPersonalWorkouts || []).forEach(pw => (pw.components || []).forEach(comp => {
        if (comp.type !== "lift") return;
        const t = normLift(comp.title || "");
        if (!t) return;
        const known = loggedNorm.some(l => l.includes(t) || t.includes(l));
        if (!known && !noDataLifts.includes(comp.title)) noDataLifts.push(comp.title);
      }));
      const noDataBlock = noDataLifts.length > 0
        ? `\n\nMOVEMENTS IN TODAY'S WORKOUT WITH ZERO LOGGED DATA: ${noDataLifts.join(", ")}. For each of these you have NO 1RM and NO estimate - numbers from OTHER lifts are NOT evidence for these movements. Give a conservative, easily-completed starting weight, tell the athlete to log what they hit as their baseline, and NEVER print a percentage or an "estimated 1RM" for them.`
        : "";

      // Build user preferences/goals section
      let userGoalsInfo = "";
      if (userPreferences) {
        if (userPreferences.goals) {
          userGoalsInfo += `\nATHLETE'S GOALS: ${userPreferences.goals}`;
        }
        if (userPreferences.injuries) {
          userGoalsInfo += `\nINJURIES/LIMITATIONS: ${userPreferences.injuries}`;
        }
        if (userPreferences.experienceLevel) {
          userGoalsInfo += `\nEXPERIENCE LEVEL: ${userPreferences.experienceLevel}`;
        }
        if (userPreferences.focusAreas && userPreferences.focusAreas.length > 0) {
          userGoalsInfo += `\nFOCUS AREAS: ${userPreferences.focusAreas.join(", ")}`;
        }
      }

      const prompt = `You are Oddo, the athlete's personal CrossFit coach, providing SPECIFIC, ACTIONABLE advice for today's workout. Your athlete trains alone in a garage/home gym - you are their only coach, so be direct and complete.

${workoutDescription}

ATHLETE'S WORKOUT HISTORY:
${historySummary || "No workout history available yet - start every load conservative and have them log results."}${noDataBlock}${recentLoad}
${baselineData?.equipment ? `\nEQUIPMENT THE ATHLETE OWNS (home/garage): ${baselineData.equipment}` : ""}
${userGoalsInfo ? `\nATHLETE'S PROFILE & GOALS:${userGoalsInfo}` : `\nNO GOALS SET - Focus advice on improving their weaknesses and building well-rounded fitness.`}

You MUST provide advice in this EXACT format with these sections:

**SCALING RECOMMENDATION:**
ONLY if today's workout is a WOD/benchmark with actual Rx/Scaled variants (prescribed Rx weights or standard scaling options): recommend Rx, Scaled, or Foundations and explain WHY based on their numbers. If today is percentage-based strength work, class programming, or anything WITHOUT an Rx option, there is NOTHING to scale - SKIP this section entirely (do not print the header) and let the weights section do the talking. Never tell them to "do Rx" on a workout that has no Rx.

**SPECIFIC WEIGHTS/LOADS:**
List each movement that requires loading and give them an EXACT number based on their lift PRs. Example: "Deadlifts: Use 185lb (that's 65% of your 285lb 1RM - perfect for this workout style)." If you don't have data for a lift, give a conservative recommendation and tell them to track it.

**PACING & REP SCHEME STRATEGY:**
Give them a specific pacing target. For AMRAP: target rounds/hour and how to break up reps (e.g., "Break the wall balls into sets of 10 from the start"). For For Time: target finish time and when to push/rest. For EMOMs: work-to-rest ratio goals. Be SPECIFIC with numbers.

**FATIGUE & READINESS:**
Judge how fresh or beat up they likely are from the LAST 7 DAYS OF TRAINING above (consecutive hard days, volume spikes, "very hard" check-ins) and say why in one sentence. Then fork today's plan: "Feeling good: [slightly harder option with specific loads/pace]" vs "Feeling beat up: [reduced option with specific loads/pace]". If there's no recent training data, say so and skip the fork.

**WHY THIS APPROACH IS BEST FOR YOU:**
${userPreferences?.goals ? `Connect this workout to their stated goal: "${userPreferences.goals}". Explain how today's approach helps them progress toward it.` : "Since they haven't set specific goals, explain how this approach helps them get fitter overall or addresses a weakness you noticed in their history."}

**ONE MENTAL CUE:**
A single focused thought to keep in mind during the workout. Training alone takes extra discipline - give them something to hold onto.

CRITICAL RULES:
- ONLY coach the movements listed in TODAY'S WORKOUT above. Do NOT add extra movements, sessions, classes, or workouts that are not listed - if it's not written in today's workout, it does not exist.
- Follow the written rep scheme EXACTLY as programmed. If it says "E2MOM - 3 reps", that means 3 reps every 2 minutes - never change the interval, sets, or rep count. (EMOM = every minute on the minute; E2MOM = every 2 minutes on the minute.)
- PERCENTAGE MATH: "@ 65%" means 65% of the athlete's 1RM for THAT SAME lift. Apply the percentage exactly ONCE to the correct 1RM, show the math (e.g. "115lb - that's 65% of your 175lb snatch 1RM"), and round to the nearest 5lb. Never apply a percentage to a weight that was already reduced by a percentage.
- A lift's TESTED 1RM (marked in the history above) IS the athlete's 1RM. Use it EXACTLY for all % math - never quote a different or Epley-estimated number for that lift. Estimates exist only for lifts with no tested single and must be written as estimates ("~180lb estimated").
- The ONLY 1RMs and estimates that exist are the ones printed in the history above. A movement not in that list has NO number - inventing an "estimated 1RM" for it (from a related lift, a strength ratio, or anything else) is a coaching failure.
- SAFETY OVERRIDES EVERYTHING: never recommend above 100% of their max, and respect rep-max physiology (2 reps=95%, 3=92%, 5=87%, 8=80%, 10=75%, 12=70% of 1RM). If the programmed load exceeds what their numbers support, SAY SO and give the safe load instead. On any max attempt: only crisp attempts, stop at technical breakdown, set safeties - they train alone.
- If you have NO data for a movement, say so and give a conservative starting weight with a note to log it. NEVER derive it from an unrelated lift (e.g. do not base RDL weight on strict press).
- When the workout is at home, recommend ONLY loads and implements from the EQUIPMENT list above (their exact bells/bags/bars - don't invent a 53lb kettlebell they don't own). If a movement needs equipment they lack, give the closest substitution using what they have. Heavy soft sandbags can't be back-racked or pressed overhead - bear-hug squats/carries, single-shoulder cleans, and over-shoulder tosses are the sandbag moves. Workouts at a gym/class can assume full gym equipment.
- If today's workout is a coached CLASS with no specific programming listed, do NOT guess the class content. Keep advice short: readiness, effort level, and mindset only - and remind them they can scan the class whiteboard to log the actual work.
- Use their ACTUAL numbers from history when recommending weights
- Be specific and direct - no vague advice like "listen to your body" or "go at a moderate pace"
- If this is a heavy strength day, give percentage-based recommendations
- If this is a metcon, give specific split times or round targets
${userPreferences?.injuries ? `- CRITICAL: They have injuries/limitations (${userPreferences.injuries}). Provide SPECIFIC modifications for affected movements.` : ""}

Respond in a confident, direct coach tone. This advice will be saved and shown every time they view this workout, so make it count.`;

      // Call the fast model with streaming so advice appears as it's written
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are an experienced CrossFit coach providing personalized workout advice. You only coach the workout you are given - you never invent extra movements or change the programmed rep scheme, and your percentage/weight math is always correct." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
        onDelta: (textSoFar) => {
          setIsStreaming(true);
          setAiAdvice(textSoFar);
        },
      });

      if (!text) {
        throw new Error("No response from AI");
      }

      setAiAdvice(text);

      // Save the advice to Firestore so it persists
      try {
        const personalWorkoutIds = todayPersonalWorkouts?.map(pw => pw.id);
        const adviceDocId = getAdviceDocId(userId, todayPersonalWorkouts);

        await setDoc(doc(db, "aiCoachAdvice", adviceDocId), {
          userId,
          advice: text,
          personalWorkoutIds: personalWorkoutIds || null,
          createdAt: Timestamp.now(),
          date: new Date().toISOString().split('T')[0],
        });
      } catch (saveErr) {
        console.error("Error saving advice to Firestore:", saveErr);
        // Don't fail - advice is still shown to user
      }
    } catch (err) {
      console.error("Error getting AI advice:", err);
      setAiAdvice("Sorry, I couldn't generate personalized advice right now. Please try again.");
    }

    setIsLoading(false);
    setIsStreaming(false);
  };

  // Get lift PRs summary for display: the tested 1RM when one exists,
  // otherwise the heaviest tested set (working sets never shown as PRs)
  const getLiftPRsSummary = () => {
    if (userHistory.lifts.length === 0) return null;

    const bests = new Map<string, { weight: number; reps: number }>();
    userHistory.lifts.forEach(lift => {
      if ((lift.setType || "max") === "working") return;
      const cur = bests.get(lift.liftTitle);
      const better = !cur
        || (lift.reps === 1 && cur.reps !== 1)
        || ((lift.reps === 1) === (cur.reps === 1) && lift.weight > cur.weight);
      if (better) bests.set(lift.liftTitle, { weight: lift.weight, reps: lift.reps });
    });

    return Array.from(bests.entries())
      .slice(0, 6)
      .map(([liftName, val]) => `${liftName}: ${val.weight}lb${val.reps !== 1 ? ` x${val.reps}` : ""}`)
      .join(" | ");
  };

  // Advice unlocks at the same standard baseline minimum Oddo programs from
  const baselineStatus = baselineData
    ? computeBaselineStatus({
        trainingStyle: baselineData.trainingStyle,
        liftTitles: Array.from(new Set(userHistory.lifts.map(l => l.liftTitle))),
        wodTitles: Array.from(new Set(userHistory.wods.map(w => w.wodTitle))),
        skillNames: baselineData.skillNames,
        cardioLogs: baselineData.cardioLogs,
      })
    : null;
  const strengthDone = baselineStatus ? baselineStatus.lifts.done.length + baselineStatus.bodyweight.done.length : 0;
  const meetsRequirements = baselineStatus ? baselineStatus.meetsMinimum : false;

  if (!hasLoadedHistory || !hasCheckedSavedAdvice) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Coach Oddo</h3>
            <p className="text-white/70 text-xs">Personalized scaling & advice</p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Quick Actions */}
          <Link
            href="/programming"
            className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">AI Programming</p>
              <p className="text-white/60 text-xs">Have your coach build your next training block</p>
            </div>
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/ai-coach/scan"
            className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Scan Programming</p>
              <p className="text-white/60 text-xs">Take a photo of handwritten notes</p>
            </div>
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Requirements Check */}
          {!meetsRequirements ? (
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">Complete Your Baseline</span>
              </div>
              <p className="text-sm text-white/80 mb-3">
                Log your baseline tests so Oddo can coach from YOUR numbers - {baselineStatus?.minimumDescription || "a few strength and cardio tests"}.
              </p>
              <div className="space-y-2">
                {([
                  { label: "Strength Tests", done: strengthDone, needed: 2 },
                  { label: "Cardio Test", done: baselineStatus?.cardio.done.length || 0, needed: 1 },
                ]).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-white/70">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (row.done / row.needed) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${row.done >= row.needed ? 'text-green-400' : 'text-white/90'}`}>
                        {Math.min(row.done, row.needed)}/{row.needed}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="/programming"
                className="inline-block mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
              >
                Log or Schedule My Baselines →
              </a>
              <p className="text-xs text-white/50 mt-3">
                Log your results from preset workouts to build your training profile.
              </p>
            </div>
          ) : (
            <>
              {/* User Stats Summary */}
              {(userHistory.lifts.length > 0) && (
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs font-medium text-white/70 mb-1">Your Stats (AI uses these):</p>
                  <p className="text-sm text-white/90">{getLiftPRsSummary()}</p>
                </div>
              )}

              {/* Get Advice Button or AI Advice Display */}
              {hasWorkoutToAnalyze && (
                <>
                  {!aiAdvice && (
                    <button
                      onClick={getPersonalizedAdvice}
                      disabled={isLoading}
                      className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analyzing your workout...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Get Personalized Advice for Today
                        </>
                      )}
                    </button>
                  )}

                  {aiAdvice && (
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="font-medium text-yellow-300 text-sm">Your Personalized Plan</span>
                        </div>
                        {isStreaming || isLoading ? (
                          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <button
                            onClick={getPersonalizedAdvice}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            title="Get fresh advice (uses your latest logs and check-ins)"
                          >
                            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="text-sm text-white/90 whitespace-pre-line">
                        {aiAdvice.split('\n').map((line, i) => {
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={i} className="font-bold text-white mt-3 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                          }
                          return line ? <p key={i} className="mt-1">{line}</p> : null;
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
