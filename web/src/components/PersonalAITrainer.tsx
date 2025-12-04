"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, Timestamp, limit } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, AICoachPreferences } from "@/lib/types";

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

interface PersonalAITrainerProps {
  userId: string;
  todayWorkout?: ScheduledWorkout | null;
  gymId?: string;
  userPreferences?: AICoachPreferences;
}

interface GymMemberStats {
  lifts: Map<string, number>; // liftName -> average 1RM
  count: number;
}

export default function PersonalAITrainer({ userId, todayWorkout, gymId, userPreferences }: PersonalAITrainerProps) {
  const [userHistory, setUserHistory] = useState<UserWorkoutHistory>({ lifts: [], wods: [] });
  const [gymMemberStats, setGymMemberStats] = useState<GymMemberStats | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

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
        setHasLoadedHistory(true);
      } catch (err) {
        console.error("Error loading user history:", err);
        setHasLoadedHistory(true);
      }
    };

    loadUserHistory();
  }, [userId]);

  // Load gym member stats for consistency
  useEffect(() => {
    const loadGymMemberStats = async () => {
      if (!gymId) return;

      try {
        // Get all gym members' lift data for comparison
        const gymDoc = await getDocs(query(collection(db, "gyms"), where("__name__", "==", gymId)));
        if (gymDoc.empty) return;

        const gymData = gymDoc.docs[0].data();
        const memberIds = [...(gymData.memberIds || []), ...(gymData.coachIds || [])];

        if (memberIds.length === 0) return;

        // Get lift results from gym members
        const liftTotals = new Map<string, { total: number; count: number }>();

        for (const memberId of memberIds.slice(0, 20)) { // Limit to 20 members for performance
          if (memberId === userId) continue; // Skip current user

          const memberLifts = await getDocs(query(
            collection(db, "liftResults"),
            where("userId", "==", memberId),
            limit(50)
          ));

          memberLifts.docs.forEach(doc => {
            const data = doc.data();
            const liftName = data.liftTitle;
            if (liftName && data.weight && data.reps === 1) { // Only 1RM for comparison
              const existing = liftTotals.get(liftName) || { total: 0, count: 0 };
              liftTotals.set(liftName, {
                total: existing.total + data.weight,
                count: existing.count + 1
              });
            }
          });
        }

        // Calculate averages
        const avgLifts = new Map<string, number>();
        liftTotals.forEach((val, key) => {
          avgLifts.set(key, Math.round(val.total / val.count));
        });

        setGymMemberStats({
          lifts: avgLifts,
          count: memberIds.length
        });
      } catch (err) {
        console.error("Error loading gym member stats:", err);
      }
    };

    loadGymMemberStats();
  }, [gymId, userId]);

  const getPersonalizedAdvice = async () => {
    if (!todayWorkout || isLoading) return;

    setIsLoading(true);
    setAiAdvice(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setAiAdvice("AI service not configured. Please contact support.");
        setIsLoading(false);
        return;
      }

      // Build workout description and extract scaling options from notes
      let prescribedScalingOptions = "";
      const workoutDescription = todayWorkout.components?.map(comp => {
        let desc = `${comp.type.toUpperCase()}: ${comp.title}\n${comp.description || ""}`;
        if (comp.notes) {
          desc += `\nCoach Notes: ${comp.notes}`;
          // Check if notes contain scaling info
          const notesLower = comp.notes.toLowerCase();
          if (notesLower.includes("scale") || notesLower.includes("rx") || notesLower.includes("modify") ||
              notesLower.includes("option") || notesLower.includes("substitute") || notesLower.includes("foundation")) {
            prescribedScalingOptions += `\n${comp.type}: ${comp.notes}`;
          }
        }
        return desc;
      }).join("\n\n") || todayWorkout.wodDescription || "No workout details";

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

      // Build gym comparison data
      let gymComparisonInfo = "";
      if (gymMemberStats && gymMemberStats.lifts.size > 0) {
        gymComparisonInfo = "\nGYM AVERAGES (for context - ensure consistency with other members):\n";
        gymMemberStats.lifts.forEach((avg, lift) => {
          gymComparisonInfo += `- ${lift}: ${avg}lb avg across ${gymMemberStats.count} members\n`;
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Build prompt based on whether scaling options are prescribed
      let scalingInstructions = "";
      if (prescribedScalingOptions.trim()) {
        scalingInstructions = `
IMPORTANT - PRESCRIBED SCALING OPTIONS:
The coach has provided specific scaling options for this workout. You MUST ONLY recommend from these options:
${prescribedScalingOptions}

Do NOT suggest any scaling modifications outside of what the coach has prescribed above. Help the athlete choose the RIGHT prescribed option for their level.`;
      } else {
        scalingInstructions = `
No specific scaling options were prescribed by the coach, so you may suggest appropriate scaling based on the athlete's ability level (Rx, Scaled, or Foundations).`;
      }

      const prompt = `You are a personal CrossFit coach providing personalized advice.

TODAY'S WORKOUT:
${workoutDescription}
${scalingInstructions}

ATHLETE'S WORKOUT HISTORY:
${historySummary || "No workout history available yet."}
${userGoalsInfo ? `\nATHLETE'S PROFILE & GOALS:${userGoalsInfo}` : ""}
${gymComparisonInfo}

Based on this athlete's history, goals, and today's workout, provide SPECIFIC and PERSONALIZED recommendations:

1. Suggest specific weights they should use based on their lift PRs
2. ${prescribedScalingOptions.trim() ? "Help them choose the RIGHT prescribed scaling option for their ability level" : "Recommend a scaling option (Rx, Scaled, or Foundations) based on their typical performance level"}
3. Give them a goal pace or target to aim for
4. One mental cue or focus point for the workout
${userPreferences?.goals ? "5. Briefly mention how today's workout connects to their stated goals" : ""}

CRITICAL RULES:
- ${prescribedScalingOptions.trim() ? "ONLY suggest scaling options from the coach's prescribed options above - never invent your own scaling" : "You may suggest appropriate scaling since none was prescribed"}
- Keep recommendations consistent with what similar athletes in the gym would do
- Be encouraging but realistic. Reference their actual numbers
- Keep it concise (3-4 short paragraphs max)
- If they don't have relevant lift data, help them choose based on the prescribed options and note they should track their lifts
${userPreferences?.injuries ? "- IMPORTANT: Consider their injuries/limitations when giving advice - suggest modifications if needed" : ""}

Respond in a friendly, coach-like tone. Use their actual numbers when giving recommendations.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      setAiAdvice(text);
    } catch (err) {
      console.error("Error getting AI advice:", err);
      setAiAdvice("Sorry, I couldn't generate personalized advice right now. Please try again.");
    }

    setIsLoading(false);
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

  if (!hasLoadedHistory) {
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
            <h3 className="font-semibold">Your AI Coach</h3>
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

          {/* User History Summary */}
          {(userHistory.lifts.length > 0 || userHistory.wods.length > 0) && (
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs font-medium text-white/70 mb-2">Your Stats (AI uses these):</p>
              <div className="text-sm space-y-1">
                {userHistory.lifts.length > 0 && (
                  <p className="text-white/90">{getLiftPRsSummary()}</p>
                )}
                {userHistory.wods.length > 0 && (
                  <p className="text-white/70 text-xs">
                    {userHistory.wods.length} WODs logged | Most recent: {userHistory.wods[0]?.wodTitle}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Get Advice Button or AI Advice Display */}
          {todayWorkout ? (
            <>
              {/* Only show button if no advice yet */}
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

              {/* AI Advice Display */}
              {aiAdvice && (
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="font-medium text-yellow-300 text-sm">Your Personalized Plan</span>
                  </div>
                  <p className="text-sm text-white/90 whitespace-pre-line">{aiAdvice}</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-white/70 text-sm">No workout scheduled for today.</p>
              <p className="text-white/50 text-xs mt-1">Check back when you have a workout to get personalized advice!</p>
            </div>
          )}

          {/* No History Message */}
          {userHistory.lifts.length === 0 && userHistory.wods.length === 0 && (
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-white/70 text-sm">Start logging your workouts to unlock personalized recommendations!</p>
              <p className="text-white/50 text-xs mt-1">The more you log, the smarter your AI trainer becomes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
