"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, Timestamp, limit, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, AICoachPreferences, WorkoutComponent, UserRole } from "@/lib/types";

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

// Personal workout type (from scan or manual entry)
interface PersonalWorkout {
  id: string;
  components: WorkoutComponent[];
  notes?: string;
}

interface PersonalAITrainerProps {
  userId: string;
  todayWorkout?: ScheduledWorkout | null;
  todayPersonalWorkouts?: PersonalWorkout[];
  gymId?: string;
  userPreferences?: AICoachPreferences;
  viewerRole?: UserRole; // For super admins viewing other users' AI coach
}

interface GymMemberStats {
  lifts: Map<string, number>; // liftName -> average 1RM
  count: number;
}

// Generate a unique ID for storing advice
function getAdviceDocId(userId: string, workoutId?: string, personalWorkoutIds?: string[]): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const workoutPart = workoutId || (personalWorkoutIds?.join('_') || 'personal');
  return `${userId}_${today}_${workoutPart}`;
}

export default function PersonalAITrainer({ userId, todayWorkout, todayPersonalWorkouts, gymId, userPreferences, viewerRole }: PersonalAITrainerProps) {
  const isSuperAdmin = viewerRole === "superAdmin";
  // Check if there's any workout to analyze (gym or personal)
  const hasWorkoutToAnalyze = todayWorkout || (todayPersonalWorkouts && todayPersonalWorkouts.length > 0);
  const [userHistory, setUserHistory] = useState<UserWorkoutHistory>({ lifts: [], wods: [] });
  const [gymMemberStats, setGymMemberStats] = useState<GymMemberStats | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [hasCheckedSavedAdvice, setHasCheckedSavedAdvice] = useState(false);
  const [suggestionType, setSuggestionType] = useState<"today" | "tomorrow" | "week" | null>(null);
  const [suggestionResponse, setSuggestionResponse] = useState<string | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);

  // Check for existing saved advice on mount
  useEffect(() => {
    const loadSavedAdvice = async () => {
      if (!userId || !hasWorkoutToAnalyze) {
        setHasCheckedSavedAdvice(true);
        return;
      }

      try {
        const personalWorkoutIds = todayPersonalWorkouts?.map(pw => pw.id);
        const adviceDocId = getAdviceDocId(userId, todayWorkout?.id, personalWorkoutIds);
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
  }, [userId, todayWorkout?.id, todayPersonalWorkouts, hasWorkoutToAnalyze]);

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
    if (!hasWorkoutToAnalyze || isLoading) return;

    setIsLoading(true);
    setAiAdvice(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
      if (!apiKey) {
        setAiAdvice("AI service not configured. Please add NEXT_PUBLIC_XAI_API_KEY to your environment.");
        setIsLoading(false);
        return;
      }

      // Build workout description from gym workout and/or personal workouts
      let prescribedScalingOptions = "";
      let workoutDescriptionParts: string[] = [];

      // Add gym workout if present
      if (todayWorkout && todayWorkout.components) {
        workoutDescriptionParts.push("GYM PROGRAMMING:");
        todayWorkout.components.forEach(comp => {
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
          workoutDescriptionParts.push(desc);
        });
      } else if (todayWorkout?.wodDescription) {
        workoutDescriptionParts.push("GYM PROGRAMMING:");
        workoutDescriptionParts.push(todayWorkout.wodDescription);
      }

      // Add personal workouts if present
      if (todayPersonalWorkouts && todayPersonalWorkouts.length > 0) {
        workoutDescriptionParts.push("\nPERSONAL WORKOUTS:");
        todayPersonalWorkouts.forEach((pw, idx) => {
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

      // Build gym comparison data
      let gymComparisonInfo = "";
      if (gymMemberStats && gymMemberStats.lifts.size > 0) {
        gymComparisonInfo = "\nGYM AVERAGES (for context - ensure consistency with other members):\n";
        gymMemberStats.lifts.forEach((avg, lift) => {
          gymComparisonInfo += `- ${lift}: ${avg}lb avg across ${gymMemberStats.count} members\n`;
        });
      }

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

      // Determine if we should focus on weaknesses (no goals set)
      const shouldFocusOnWeaknesses = !userPreferences?.goals;

      // Analyze weaknesses from workout history
      let weaknessAnalysis = "";
      if (shouldFocusOnWeaknesses && userHistory.wods.length > 0) {
        // Look for patterns in workout categories/results to identify weaknesses
        const wodsByCategory: Record<string, number[]> = {};
        userHistory.wods.forEach(wod => {
          if (wod.timeInSeconds && wod.category) {
            if (!wodsByCategory[wod.category]) wodsByCategory[wod.category] = [];
            wodsByCategory[wod.category].push(wod.timeInSeconds);
          }
        });
        weaknessAnalysis = "\nPotential areas for improvement based on logged workouts - focus your advice here.";
      }

      const prompt = `You are a personal CrossFit coach providing SPECIFIC, ACTIONABLE advice for today's workout.

TODAY'S WORKOUT:
${workoutDescription}
${scalingInstructions}

ATHLETE'S WORKOUT HISTORY:
${historySummary || "No workout history available yet - treat them as an intermediate athlete."}
${userGoalsInfo ? `\nATHLETE'S PROFILE & GOALS:${userGoalsInfo}` : `\nNO GOALS SET - Focus advice on improving their weaknesses and building well-rounded fitness.${weaknessAnalysis}`}
${gymComparisonInfo}

You MUST provide advice in this EXACT format with these sections:

**SCALING RECOMMENDATION:**
${prescribedScalingOptions.trim() ? "Choose from the coach's prescribed options and explain which one they should do" : "Recommend Rx, Scaled, or Foundations"} and explain WHY this is the right choice for them based on their specific numbers. Be direct: "Do [this option] because [specific reason]."

**SPECIFIC WEIGHTS/LOADS:**
List each movement that requires loading and give them an EXACT number based on their lift PRs. Example: "Deadlifts: Use 185lb (that's 65% of your 285lb 1RM - perfect for this workout style)." If you don't have data for a lift, give a conservative recommendation and tell them to track it.

**PACING & REP SCHEME STRATEGY:**
Give them a specific pacing target. For AMRAP: target rounds/hour and how to break up reps (e.g., "Break the wall balls into sets of 10 from the start"). For For Time: target finish time and when to push/rest. For EMOMs: work-to-rest ratio goals. Be SPECIFIC with numbers.

**WHY THIS APPROACH IS BEST FOR YOU:**
${userPreferences?.goals ? `Connect this workout to their stated goal: "${userPreferences.goals}". Explain how today's approach helps them progress toward it.` : "Since they haven't set specific goals, explain how this approach helps them get fitter overall or addresses a weakness you noticed in their history."}

**ONE MENTAL CUE:**
A single focused thought to keep in mind during the workout.

CRITICAL RULES:
- ${prescribedScalingOptions.trim() ? "ONLY suggest scaling options from the coach's prescribed options above" : "You may suggest appropriate scaling"}
- Use their ACTUAL numbers from history when recommending weights
- Be specific and direct - no vague advice like "listen to your body" or "go at a moderate pace"
- If this is a heavy strength day, give percentage-based recommendations
- If this is a metcon, give specific split times or round targets
${userPreferences?.injuries ? `- CRITICAL: They have injuries/limitations (${userPreferences.injuries}). Provide SPECIFIC modifications for affected movements.` : ""}

Respond in a confident, direct coach tone. This advice will be saved and shown every time they view this workout, so make it count.`;

      // Call xAI/Grok API (OpenAI-compatible format)
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-4-latest",
          messages: [
            { role: "system", content: "You are an experienced CrossFit coach providing personalized workout advice." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No response from AI");
      }

      setAiAdvice(text);

      // Save the advice to Firestore so it persists
      try {
        const personalWorkoutIds = todayPersonalWorkouts?.map(pw => pw.id);
        const adviceDocId = getAdviceDocId(userId, todayWorkout?.id, personalWorkoutIds);

        await setDoc(doc(db, "aiCoachAdvice", adviceDocId), {
          userId,
          advice: text,
          workoutId: todayWorkout?.id || null,
          personalWorkoutIds: personalWorkoutIds || null,
          gymId: gymId || null,
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
  };

  // Handle quick suggestion requests
  const handleSuggestion = async (type: "today" | "tomorrow" | "week") => {
    if (isSuggestionLoading) return;

    setSuggestionType(type);
    setIsSuggestionLoading(true);
    setSuggestionResponse(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
      if (!apiKey) {
        setSuggestionResponse("AI service not configured.");
        setIsSuggestionLoading(false);
        return;
      }

      // Build user context
      let userContext = "";
      if (userHistory.lifts.length > 0) {
        const liftBests = new Map<string, number>();
        userHistory.lifts.forEach(lift => {
          const existing = liftBests.get(lift.liftTitle);
          if (!existing || lift.weight > existing) {
            liftBests.set(lift.liftTitle, lift.weight);
          }
        });
        userContext += "Lift PRs: " + Array.from(liftBests.entries()).slice(0, 5).map(([name, weight]) => `${name}: ${weight}lb`).join(", ");
      }
      if (userHistory.wods.length > 0) {
        userContext += `\n${userHistory.wods.length} WODs logged recently.`;
      }
      if (userPreferences?.goals) {
        userContext += `\nGoals: ${userPreferences.goals}`;
      }
      if (userPreferences?.injuries) {
        userContext += `\nInjuries/limitations: ${userPreferences.injuries}`;
      }

      // Get today's date info
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayName = dayNames[today.getDay()];

      // Helper to format date
      const formatDate = (date: Date) => {
        return `${dayNames[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
      };

      // Helper to describe a workout
      const describeWorkout = (workout: ScheduledWorkout | { components?: WorkoutComponent[] }) => {
        if ('components' in workout && workout.components && workout.components.length > 0) {
          return workout.components.map(c => {
            let desc = `${c.type.toUpperCase()}: ${c.title}`;
            if (c.description) desc += ` - ${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}`;
            return desc;
          }).join('\n');
        }
        if ('wodTitle' in workout && workout.wodTitle) {
          return `${workout.wodTitle}${workout.wodDescription ? `: ${workout.wodDescription.substring(0, 100)}` : ''}`;
        }
        return 'Workout scheduled';
      };

      // Fetch scheduled workouts for date range
      const fetchWorkoutsForRange = async (startDate: Date, endDate: Date) => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        try {
          const workoutsQuery = query(
            collection(db, "scheduledWorkouts"),
            where("date", ">=", Timestamp.fromDate(start)),
            where("date", "<=", Timestamp.fromDate(end))
          );
          const snapshot = await getDocs(workoutsQuery);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ScheduledWorkout[];
        } catch {
          return [];
        }
      };

      // Fetch personal workouts for date range
      const fetchPersonalWorkoutsForRange = async (startDate: Date, endDate: Date) => {
        if (!userId) return [];

        try {
          const personalQuery = query(
            collection(db, "personalWorkouts"),
            where("userId", "==", userId)
          );
          const snapshot = await getDocs(personalQuery);
          const allWorkouts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Filter by date range
          return allWorkouts.filter(w => {
            const workoutDate = (w as { date?: Timestamp }).date?.toDate?.();
            if (!workoutDate) return false;
            return workoutDate >= startDate && workoutDate <= endDate;
          });
        } catch {
          return [];
        }
      };

      // Calculate date ranges
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);

      // Fetch workouts based on suggestion type
      let recentWorkouts: ScheduledWorkout[] = [];
      let upcomingWorkouts: ScheduledWorkout[] = [];
      let recentPersonalWorkouts: unknown[] = [];
      let upcomingPersonalWorkouts: unknown[] = [];

      // Always fetch last 3 days for context
      recentWorkouts = await fetchWorkoutsForRange(threeDaysAgo, new Date(today.getTime() - 1));
      recentPersonalWorkouts = await fetchPersonalWorkoutsForRange(threeDaysAgo, new Date(today.getTime() - 1));

      if (type === "today") {
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        upcomingWorkouts = await fetchWorkoutsForRange(today, todayEnd);
        upcomingPersonalWorkouts = await fetchPersonalWorkoutsForRange(today, todayEnd);
      } else if (type === "tomorrow") {
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);
        upcomingWorkouts = await fetchWorkoutsForRange(tomorrow, tomorrowEnd);
        upcomingPersonalWorkouts = await fetchPersonalWorkoutsForRange(tomorrow, tomorrowEnd);
      } else if (type === "week") {
        upcomingWorkouts = await fetchWorkoutsForRange(today, weekEnd);
        upcomingPersonalWorkouts = await fetchPersonalWorkoutsForRange(today, weekEnd);
      }

      // Build workout context strings
      let recentWorkoutContext = "";
      if (recentWorkouts.length > 0 || recentPersonalWorkouts.length > 0) {
        recentWorkoutContext = "\nLAST 3 DAYS WORKOUTS:\n";
        recentWorkouts.forEach(w => {
          const workoutDate = w.date?.toDate?.();
          if (workoutDate) {
            recentWorkoutContext += `${formatDate(workoutDate)}:\n${describeWorkout(w)}\n\n`;
          }
        });
        recentPersonalWorkouts.forEach(w => {
          const pw = w as { date?: Timestamp; components?: WorkoutComponent[] };
          const workoutDate = pw.date?.toDate?.();
          if (workoutDate) {
            recentWorkoutContext += `${formatDate(workoutDate)} (Personal):\n${describeWorkout(pw)}\n\n`;
          }
        });
      }

      let upcomingWorkoutContext = "";
      if (upcomingWorkouts.length > 0 || upcomingPersonalWorkouts.length > 0) {
        const label = type === "today" ? "TODAY'S WORKOUT" : type === "tomorrow" ? "TOMORROW'S WORKOUT" : "THIS WEEK'S WORKOUTS";
        upcomingWorkoutContext = `\n${label}:\n`;
        upcomingWorkouts.forEach(w => {
          const workoutDate = w.date?.toDate?.();
          if (workoutDate) {
            upcomingWorkoutContext += `${formatDate(workoutDate)}:\n${describeWorkout(w)}\n\n`;
          }
        });
        upcomingPersonalWorkouts.forEach(w => {
          const pw = w as { date?: Timestamp; components?: WorkoutComponent[] };
          const workoutDate = pw.date?.toDate?.();
          if (workoutDate) {
            upcomingWorkoutContext += `${formatDate(workoutDate)} (Personal):\n${describeWorkout(pw)}\n\n`;
          }
        });
      }

      let prompt = "";

      if (type === "today") {
        prompt = `You are a CrossFit coach. Give brief, actionable advice for TODAY (${todayName}).

${userContext ? `ATHLETE INFO:\n${userContext}\n` : ""}${recentWorkoutContext}${upcomingWorkoutContext || "No workout scheduled for today."}

Based on what they've done recently and what's coming up today, in 2-3 sentences tell them:
1. What they should focus on today (considering recent training load)
2. One specific tip for today's workout or recovery

Be direct and motivating. Reference specific workouts if relevant.`;
      } else if (type === "tomorrow") {
        const tomorrowDate = new Date(today);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowName = dayNames[tomorrowDate.getDay()];

        prompt = `You are a CrossFit coach. Give brief advice about TOMORROW (${tomorrowName}).

${userContext ? `ATHLETE INFO:\n${userContext}\n` : ""}${recentWorkoutContext}${upcomingWorkoutContext || "No workout scheduled for tomorrow yet."}

Based on recent training and tomorrow's workout, in 2-3 sentences tell them:
1. How to prepare for tomorrow's specific workout
2. Recovery or nutrition tips for tonight based on what's coming

Be specific and actionable. Reference the actual workout if one is scheduled.`;
      } else if (type === "week") {
        prompt = `You are a CrossFit coach planning the athlete's week (starting ${todayName}).

${userContext ? `ATHLETE INFO:\n${userContext}\n` : ""}${recentWorkoutContext}${upcomingWorkoutContext || "No workouts scheduled this week yet."}

Looking at their recent training and the week ahead, in 3-4 sentences give them:
1. What to focus on this week based on the scheduled workouts
2. How to balance the training load and recovery
3. One specific goal to hit by week's end

Be motivating and reference specific upcoming workouts.`;
      }

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-4-latest",
          messages: [
            { role: "system", content: "You are a supportive CrossFit coach giving quick, actionable advice. Keep responses brief and motivating. Reference specific workouts when available." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 400
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No response from AI");
      }

      setSuggestionResponse(text);
    } catch (err) {
      console.error("Error getting suggestion:", err);
      setSuggestionResponse("Sorry, couldn't get advice right now. Try again!");
    }

    setIsSuggestionLoading(false);
  };

  const clearSuggestion = () => {
    setSuggestionType(null);
    setSuggestionResponse(null);
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

          {/* Quick Suggestion Buttons */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/70">Quick Advice</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSuggestion("today")}
                disabled={isSuggestionLoading}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  suggestionType === "today"
                    ? "bg-white text-purple-600"
                    : "bg-white/10 hover:bg-white/20 text-white"
                } disabled:opacity-50`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
                Today
              </button>
              <button
                onClick={() => handleSuggestion("tomorrow")}
                disabled={isSuggestionLoading}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  suggestionType === "tomorrow"
                    ? "bg-white text-purple-600"
                    : "bg-white/10 hover:bg-white/20 text-white"
                } disabled:opacity-50`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Tomorrow
              </button>
              <button
                onClick={() => handleSuggestion("week")}
                disabled={isSuggestionLoading}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  suggestionType === "week"
                    ? "bg-white text-purple-600"
                    : "bg-white/10 hover:bg-white/20 text-white"
                } disabled:opacity-50`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                This Week
              </button>
            </div>

            {/* Suggestion Response */}
            {(suggestionType || isSuggestionLoading) && (
              <div className="bg-white/10 rounded-lg p-3 mt-2">
                {isSuggestionLoading ? (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Thinking...
                  </div>
                ) : suggestionResponse ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/70 uppercase">
                        {suggestionType === "today" ? "Today's Focus" : suggestionType === "tomorrow" ? "Tomorrow's Prep" : "Weekly Plan"}
                      </span>
                      <button
                        onClick={clearSuggestion}
                        className="text-white/50 hover:text-white/80 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-line">{suggestionResponse}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

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
          {hasWorkoutToAnalyze ? (
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="font-medium text-yellow-300 text-sm">Your Personalized Plan</span>
                    </div>
                    {isSuperAdmin && (
                      <button
                        onClick={getPersonalizedAdvice}
                        disabled={isLoading}
                        className="text-xs bg-red-500/20 text-red-200 hover:bg-red-500/30 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                        title="Super Admin: Force regenerate advice"
                      >
                        {isLoading ? (
                          <div className="w-3 h-3 border border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        Admin Regenerate
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-white/90 whitespace-pre-line prose prose-sm prose-invert max-w-none">
                    {aiAdvice.split('\n').map((line, i) => {
                      // Make headers bold
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={i} className="font-bold text-white mt-3 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                      }
                      return line ? <p key={i} className="mt-1">{line}</p> : null;
                    })}
                  </div>
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
