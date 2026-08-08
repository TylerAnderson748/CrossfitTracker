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

interface PersonalAITrainerProps {
  userId: string;
  todayPersonalWorkouts?: PersonalWorkout[];
  userPreferences?: AICoachPreferences;
}

// Generate a unique ID for storing advice
function getAdviceDocId(userId: string, personalWorkoutIds?: string[]): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const workoutPart = personalWorkoutIds?.join('_') || 'personal';
  return `${userId}_${today}_${workoutPart}`;
}

export default function PersonalAITrainer({ userId, todayPersonalWorkouts, userPreferences }: PersonalAITrainerProps) {
  // Check if there's any workout to analyze
  const hasWorkoutToAnalyze = todayPersonalWorkouts && todayPersonalWorkouts.length > 0;
  const [userHistory, setUserHistory] = useState<UserWorkoutHistory>({ lifts: [], wods: [] });
  const [baselineData, setBaselineData] = useState<{ skillNames: string[]; cardioLogs: { activity: string; miles?: number }[]; trainingStyle: string } | null>(null);
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
        const personalWorkoutIds = todayPersonalWorkouts?.map(pw => pw.id);
        const adviceDocId = getAdviceDocId(userId, personalWorkoutIds);
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
        // unlock gate matches Oddo's standard baseline minimum
        const [skillSnap, cardioSnap, prefsSnap] = await Promise.all([
          getDocs(query(collection(db, "skillResults"), where("userId", "==", userId), limit(150))),
          getDocs(query(collection(db, "cardioLogs"), where("userId", "==", userId), limit(150))),
          getDocs(query(collection(db, "aiProgrammingPreferences"), where("userId", "==", userId))),
        ]);
        setBaselineData({
          skillNames: Array.from(new Set(skillSnap.docs.map(d => String(d.data().skillTitle || d.data().skillName || "")).filter(Boolean))),
          cardioLogs: cardioSnap.docs.map(d => ({ activity: String(d.data().activity || ""), miles: Number(d.data().miles) || 0 })),
          trainingStyle: prefsSnap.empty ? "crossfit" : String(prefsSnap.docs[0].data().trainingStyle || "crossfit"),
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
      if (userHistory.lifts.length > 0) {
        const liftBests = new Map<string, { weight: number; reps: number }>();
        userHistory.lifts.forEach(lift => {
          const key = `${lift.liftTitle}-${lift.reps}`;
          const existing = liftBests.get(key);
          if (!existing || lift.weight > existing.weight) {
            liftBests.set(key, { weight: lift.weight, reps: lift.reps });
          }
        });

        historySummary += "Lift PRs:\n" + Array.from(liftBests.entries())
          .map(([key, val]) => {
            const liftName = key.split('-')[0];
            return `- ${liftName}: ${val.weight}lbs (${val.reps}RM)`;
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
${historySummary || "No workout history available yet - treat them as an intermediate athlete."}
${userGoalsInfo ? `\nATHLETE'S PROFILE & GOALS:${userGoalsInfo}` : `\nNO GOALS SET - Focus advice on improving their weaknesses and building well-rounded fitness.`}

You MUST provide advice in this EXACT format with these sections:

**SCALING RECOMMENDATION:**
Recommend Rx, Scaled, or Foundations and explain WHY this is the right choice for them based on their specific numbers. Be direct: "Do [this option] because [specific reason]."

**SPECIFIC WEIGHTS/LOADS:**
List each movement that requires loading and give them an EXACT number based on their lift PRs. Example: "Deadlifts: Use 185lb (that's 65% of your 285lb 1RM - perfect for this workout style)." If you don't have data for a lift, give a conservative recommendation and tell them to track it.

**PACING & REP SCHEME STRATEGY:**
Give them a specific pacing target. For AMRAP: target rounds/hour and how to break up reps (e.g., "Break the wall balls into sets of 10 from the start"). For For Time: target finish time and when to push/rest. For EMOMs: work-to-rest ratio goals. Be SPECIFIC with numbers.

**WHY THIS APPROACH IS BEST FOR YOU:**
${userPreferences?.goals ? `Connect this workout to their stated goal: "${userPreferences.goals}". Explain how today's approach helps them progress toward it.` : "Since they haven't set specific goals, explain how this approach helps them get fitter overall or addresses a weakness you noticed in their history."}

**ONE MENTAL CUE:**
A single focused thought to keep in mind during the workout. Training alone takes extra discipline - give them something to hold onto.

CRITICAL RULES:
- Use their ACTUAL numbers from history when recommending weights
- Be specific and direct - no vague advice like "listen to your body" or "go at a moderate pace"
- If this is a heavy strength day, give percentage-based recommendations
- If this is a metcon, give specific split times or round targets
${userPreferences?.injuries ? `- CRITICAL: They have injuries/limitations (${userPreferences.injuries}). Provide SPECIFIC modifications for affected movements.` : ""}

Respond in a confident, direct coach tone. This advice will be saved and shown every time they view this workout, so make it count.`;

      // Call the fast model with streaming so advice appears as it's written
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are an experienced CrossFit coach providing personalized workout advice." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
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
        const adviceDocId = getAdviceDocId(userId, personalWorkoutIds);

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

  // Get lift PRs summary for display
  const getLiftPRsSummary = () => {
    if (userHistory.lifts.length === 0) return null;

    const liftBests = new Map<string, { weight: number; reps: number }>();
    userHistory.lifts.forEach(lift => {
      const key = `${lift.liftTitle}-${lift.reps}`;
      const existing = liftBests.get(key);
      if (!existing || lift.weight > existing.weight) {
        liftBests.set(key, { weight: lift.weight, reps: lift.reps });
      }
    });

    return Array.from(liftBests.entries())
      .slice(0, 6)
      .map(([key, val]) => {
        const liftName = key.split('-')[0];
        return `${liftName}: ${val.weight}lb`;
      })
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
  const isGeneralStyle = baselineData?.trainingStyle === "general";
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
                  { label: "Strength Tests", done: strengthDone, needed: 2, show: true },
                  { label: "Cardio Test", done: baselineStatus?.cardio.done.length || 0, needed: 1, show: true },
                  { label: "Benchmark WOD", done: baselineStatus?.wods.done.length || 0, needed: 1, show: !isGeneralStyle },
                  { label: "Skill Test", done: baselineStatus?.skills.done.length || 0, needed: 1, show: !isGeneralStyle },
                ]).filter(r => r.show).map(row => (
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
                        {isStreaming && (
                          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
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
