"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, getDoc, orderBy, Timestamp, serverTimestamp, deleteDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { AIProgrammingSession, AIChatMessage, AIGeneratedDay, WorkoutGroup, WorkoutComponent, AIProgrammingPreferences, AITrainerSubscription, ScheduledTimeSlot } from "@/lib/types";
import { getAllSkills, getAllLifts, getAllWods } from "@/lib/workoutData";
import AITrainerPaywall from "./AITrainerPaywall";

// Get preset workout names for the AI prompt
const getPresetSkillNames = () => getAllSkills().map(s => s.name);
const getPresetLiftNames = () => getAllLifts().map(l => l.name);
const getPresetWodNames = () => getAllWods().map(w => w.name);

// Default preferences
const defaultPreferences: Omit<AIProgrammingPreferences, "gymId" | "updatedAt"> = {
  philosophy: "",
  workoutDuration: "varied",
  benchmarkFrequency: "sometimes",
  programmingStyle: "",
  additionalRules: "",
};

interface AIProgrammingChatProps {
  gymId: string;
  userId: string;
  userEmail?: string;
  groups: WorkoutGroup[];
  onPublish?: () => void;
  subscription?: AITrainerSubscription;
}

const getSystemPrompt = (preferences?: Omit<AIProgrammingPreferences, "gymId" | "updatedAt">, recentlyUsedWorkouts?: string[]) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });

  // Determine current season
  const month = today.getMonth();
  let season = "Winter";
  if (month >= 2 && month <= 4) season = "Spring";
  else if (month >= 5 && month <= 7) season = "Summer";
  else if (month >= 8 && month <= 10) season = "Fall";

  // Get preset workout names
  const skillNames = getPresetSkillNames();
  const liftNames = getPresetLiftNames();
  const wodNames = getPresetWodNames();

  // Build gym preferences section
  let gymPreferencesSection = "";
  if (preferences) {
    const prefParts: string[] = [];

    if (preferences.philosophy) {
      prefParts.push(`Gym Philosophy: ${preferences.philosophy}`);
    }

    if (preferences.workoutDuration && preferences.workoutDuration !== "varied") {
      const durationMap = {
        short: "shorter workouts (under 15 minutes)",
        medium: "medium-length workouts (15-25 minutes)",
        long: "longer workouts (25+ minutes)",
        varied: "varied workout lengths"
      };
      prefParts.push(`Workout Duration Preference: ${durationMap[preferences.workoutDuration]}`);
    }

    if (preferences.benchmarkFrequency) {
      const freqMap = {
        often: "Program benchmark WODs frequently (1-2 per week)",
        sometimes: "Program benchmark WODs occasionally (1-2 per month)",
        rarely: "Rarely program benchmark WODs - prefer custom workouts"
      };
      prefParts.push(`Benchmark Frequency: ${freqMap[preferences.benchmarkFrequency]}`);
    }

    if (preferences.programmingStyle) {
      prefParts.push(`Programming Style Inspiration: ${preferences.programmingStyle}`);
    }

    if (preferences.additionalRules) {
      prefParts.push(`Additional Rules/Preferences: ${preferences.additionalRules}`);
    }

    if (prefParts.length > 0) {
      gymPreferencesSection = `
GYM OWNER PREFERENCES (IMPORTANT - Follow these rules):
${prefParts.join("\n")}

`;
    }
  }

  // Build recently used workouts section
  let recentlyUsedSection = "";
  if (recentlyUsedWorkouts && recentlyUsedWorkouts.length > 0) {
    recentlyUsedSection = `
CRITICAL - AVOID THESE WORKOUTS (Used in the last 6 months):
The following workouts have been programmed recently and MUST NOT be repeated for at least 6 months:
${recentlyUsedWorkouts.join(", ")}

DO NOT use any of the above workout names. Create NEW, unique workouts instead. This is very important for keeping programming fresh and varied.

`;
  }

  return `You are a CrossFit programming assistant helping gym owners and coaches create workout programming.
${gymPreferencesSection}${recentlyUsedSection}IMPORTANT: Today's date is ${todayStr} (${dayOfWeek}). Current month: ${monthName}. Current season: ${season}.
When generating workouts, start from today or the next upcoming day. Use real, current dates.

When generating workouts, you MUST respond with valid JSON in this exact format:
{
  "message": "Your conversational response here explaining the program",
  "workouts": [
    {
      "date": "${todayStr}",
      "dayOfWeek": "${dayOfWeek}",
      "isRestDay": false,
      "components": [
        {
          "type": "warmup",
          "title": "General Warm-up",
          "description": "3 rounds:\\n10 air squats\\n10 push-ups\\n200m run",
          "notes": "Focus on mobility and increasing heart rate gradually"
        },
        {
          "type": "lift",
          "title": "Back Squat",
          "description": "5x5 @ 75% 1RM\\nRest 2-3 min between sets",
          "notes": "Stimulus: Build strength with moderate load. Focus on depth and control.\\nScaling: Reduce weight if form breaks down. Beginners use goblet squats."
        },
        {
          "type": "skill",
          "title": "Toes-to-Bar",
          "description": "3 sets of 8-10 reps (or max effort)\\nRest 90 sec between sets\\n\\nDrill Work:\\n- 10 kip swings (focus on hollow/arch)\\n- 10 knees-to-chest\\n- 5 slow toes-to-bar with pause at top",
          "notes": "Stimulus: Skill development, focus on rhythm and efficiency.\\nScaling: Knees-to-Elbow if can't reach toes. Hanging Knee Raises if still developing kip. V-ups on floor if grip is limiting.\\nIntent: Quality over quantity - stop if form breaks down.\\nProgression: Master kip swing first, then knees-to-chest, then full TTB."
        },
        {
          "type": "wod",
          "title": "Fran",
          "description": "21-15-9\\nThrusters (95/65)\\nPull-ups",
          "scoringType": "fortime",
          "notes": "Stimulus: Fast and intense, aim for sub-10 minutes.\\nRx: Thrusters (95/65), Kipping Pull-ups\\nScaled: Thrusters (65/45), Ring Rows or Banded Pull-ups\\nFoundations: Thrusters (45/35), Ring Rows\\n\\nScoring: Using scaled weights? Log as Scaled. Using less than scaled or ring rows? Log as Foundations.\\nIntent: Sprint effort, unbroken if possible."
        }
      ]
    }
  ]
}

Component types: "warmup", "lift", "wod", "skill", "cooldown"
Scoring types for WODs: "fortime", "amrap", "emom"

IMPORTANT - PRESET WORKOUTS:
For SKILL components, you MUST ONLY use these preset skill names (do not make up new skills):
${skillNames.join(", ")}

For LIFT components, you MUST ONLY use these preset lift names (do not make up new lifts):
${liftNames.join(", ")}

For WOD components, these are the existing benchmark WODs - you may use these OR create custom themed WODs:
${wodNames.join(", ")}

CREATIVE WOD NAMING:
When creating custom WODs (not benchmarks), be CREATIVE and FUN with names! Use themes based on:
- Current season (${season}): e.g., "Snowstorm", "Summer Sizzle", "Autumn Assault", "Spring Awakening"
- Holidays/events: e.g., "Turkey Burner", "Independence Day Grind", "New Year's Resolution"
- Weather/nature: e.g., "Thunderstorm", "Avalanche", "Heat Wave", "Blizzard"
- Action/intensity: e.g., "The Gauntlet", "Relentless", "Dark Horse", "Redemption"
- Fun themes: e.g., "Monday Mayhem", "Hump Day Hustle", "Friday Finisher", "Weekend Warrior"
- User-requested themes: If the user mentions a theme, event, or preference, incorporate it!

Examples of creative names: "December Destroyer", "Frostbite", "Firebreather", "The Crucible", "Midnight Oil", "Iron Will", "Beast Mode", "No Mercy Monday"

Guidelines:
- Create varied, balanced programming
- Include proper warm-ups and skill work
- Program appropriate rest days (typically 2 per week)
- Scale difficulty based on the gym's level
- Use standard CrossFit movements and terminology
- Keep descriptions clear and concise
- Use newlines (\\n) for formatting within descriptions
- ALWAYS use real dates starting from ${todayStr} and going forward

IMPORTANT - SKILL WORK REQUIREMENTS:
For SKILL components, NEVER just say "10 minutes of practice" or generic time domains. Instead, ALWAYS include:
1. Specific sets/reps (e.g., "3 sets of 8-10 reps")
2. Drill work with clear exercises (e.g., "10 kip swings, 10 knees-to-chest")
3. Rest periods between sets
4. The description should teach HOW to develop the skill, not just tell them to practice

The notes field for skills MUST include:
- Scaling: 2-3 progressions for different ability levels
- Progression: The path from beginner to mastery
- Intent: What athletes should focus on (quality, rhythm, efficiency, etc.)

- ALWAYS include a "notes" field for each component with:
  * Stimulus: The intended feel/intensity (e.g., "fast and light", "heavy grind")
  * Scaling: Options for different fitness levels
  * Intent: What athletes should focus on or aim for
  * Any other coaching cues or tips
- For skills and lifts, ONLY use the preset names listed above
- For WODs, use benchmark WODs when appropriate, but get CREATIVE with custom WOD names using themes!
- Pay attention to any themes, preferences, or special requests from the user

IMPORTANT - WOD SCALING AND SCORING CATEGORIES:
For ALL WOD components, you MUST include THREE scaling levels in the notes:
1. Rx (prescribed): The standard weights and movements
2. Scaled: Lighter weights or easier movement variations
3. Foundations: Lightest weights or most accessible modifications

ALWAYS include scoring guidance like:
"Scoring: Using Rx weights? Log as Rx. Using scaled weights? Log as Scaled. Using less than scaled weights or significant modifications? Log as Foundations."

Example scaling formats:
- Barbell movements: "Rx: 135/95, Scaled: 95/65, Foundations: 65/45 or empty bar"
- Kettlebell: "Rx: 53/35, Scaled: 35/26, Foundations: 26/18"
- Pull-ups: "Rx: Kipping Pull-ups, Scaled: Banded Pull-ups, Foundations: Ring Rows"
- Box Jumps: "Rx: 24/20, Scaled: 20/16, Foundations: Step-ups"
- Wall Balls: "Rx: 20/14 to 10/9ft, Scaled: 14/10, Foundations: 10/6 to 9ft"

If the user is just chatting or asking questions (not requesting workouts), respond with just:
{
  "message": "Your response here",
  "workouts": []
}

IMPORTANT: Always respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;
};

// Helper to remove undefined values from objects (Firestore doesn't accept undefined)
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)) as T;
  }
  if (typeof obj === 'object') {
    // Don't modify Firestore Timestamps or other special objects
    if (obj instanceof Timestamp || (obj as Record<string, unknown>).toDate !== undefined) {
      return obj;
    }
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export default function AIProgrammingChat({ gymId, userId, userEmail, groups, onPublish, subscription }: AIProgrammingChatProps) {
  // Check if user has an active AI subscription
  const hasActiveSubscription = subscription &&
    (subscription.status === "active" || subscription.status === "trialing");
  const [sessions, setSessions] = useState<AIProgrammingSession[]>([]);
  const [activeSession, setActiveSession] = useState<AIProgrammingSession | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(true);

  // Programming preferences state
  const [preferences, setPreferences] = useState<Omit<AIProgrammingPreferences, "gymId" | "updatedAt">>(defaultPreferences);
  const [showSettings, setShowSettings] = useState(false);
  const [preferencesDocId, setPreferencesDocId] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Cancel subscription state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Recently used workouts (last 6 months) - to avoid repetition
  const [recentlyUsedWorkouts, setRecentlyUsedWorkouts] = useState<string[]>([]);

  // Load recently used workouts from the last 6 months
  useEffect(() => {
    const loadRecentWorkouts = async () => {
      if (!gymId) return;

      try {
        // Get date 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Query all scheduled workouts for this gym (filter by date client-side to avoid index requirement)
        const workoutsQuery = query(
          collection(db, "scheduledWorkouts"),
          where("gymId", "==", gymId)
        );
        const snapshot = await getDocs(workoutsQuery);

        // Extract unique workout names from components
        const usedWorkouts = new Set<string>();

        snapshot.docs.forEach(doc => {
          const data = doc.data();

          // Check if workout is within last 6 months
          const workoutDate = data.date?.toDate?.();
          if (!workoutDate || workoutDate < sixMonthsAgo) return;

          // Add the main workout title if it exists
          if (data.wodTitle && !data.wodTitle.includes("Programming")) {
            usedWorkouts.add(data.wodTitle);
          }
          // Extract component titles (WODs, lifts, skills)
          if (data.components && Array.isArray(data.components)) {
            data.components.forEach((comp: { type?: string; title?: string }) => {
              if (comp.title && comp.type === "wod") {
                // Only track WOD names to avoid repetition
                usedWorkouts.add(comp.title);
              }
            });
          }
        });

        setRecentlyUsedWorkouts(Array.from(usedWorkouts));
      } catch (err) {
        console.error("Error loading recent workouts:", err);
      }
    };

    loadRecentWorkouts();
  }, [gymId]);

  // Load existing sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionsQuery = query(
          collection(db, "aiProgrammingSessions"),
          where("gymId", "==", gymId),
          orderBy("updatedAt", "desc")
        );
        const snapshot = await getDocs(sessionsQuery);
        const loadedSessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AIProgrammingSession[];
        setSessions(loadedSessions);

        // Auto-select first active session
        const activeOne = loadedSessions.find(s => s.status === "active");
        if (activeOne) {
          setActiveSession(activeOne);
        }
      } catch (err) {
        console.error("Error loading sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, [gymId]);

  // Load programming preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefsQuery = query(
          collection(db, "aiProgrammingPreferences"),
          where("gymId", "==", gymId)
        );
        const snapshot = await getDocs(prefsQuery);
        if (!snapshot.empty) {
          const prefDoc = snapshot.docs[0];
          const prefData = prefDoc.data();
          setPreferencesDocId(prefDoc.id);
          setPreferences({
            philosophy: prefData.philosophy || "",
            workoutDuration: prefData.workoutDuration || "varied",
            benchmarkFrequency: prefData.benchmarkFrequency || "sometimes",
            programmingStyle: prefData.programmingStyle || "",
            additionalRules: prefData.additionalRules || "",
          });
        }
      } catch (err) {
        console.error("Error loading preferences:", err);
      }
    };
    loadPreferences();
  }, [gymId]);

  // Save preferences
  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      const prefData = {
        gymId,
        ...preferences,
        updatedAt: serverTimestamp(),
      };

      if (preferencesDocId) {
        await updateDoc(doc(db, "aiProgrammingPreferences", preferencesDocId), prefData);
      } else {
        const docRef = await addDoc(collection(db, "aiProgrammingPreferences"), prefData);
        setPreferencesDocId(docRef.id);
      }
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError("Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!userId) return;

    setIsCanceling(true);
    try {
      // For gym owners, update the gym's subscription
      if (gymId) {
        const gymDoc = await getDoc(doc(db, "gyms", gymId));
        if (gymDoc.exists()) {
          const gymData = gymDoc.data();
          const currentPeriodEnd = gymData.subscription?.currentPeriodEnd || Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

          await updateDoc(doc(db, "gyms", gymId), {
            "subscription.aiProgrammerEndsAt": currentPeriodEnd,
          });
          setShowCancelModal(false);
          window.location.reload();
          return;
        }
      }

      // Fallback: Update user's individual subscription
      const endDate = subscription?.trialEndsAt || subscription?.endDate || Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      await updateDoc(doc(db, "users", userId), {
        "aiProgrammingSubscription.status": "canceled",
        "aiProgrammingSubscription.endDate": endDate,
      });
      setShowCancelModal(false);
      window.location.reload();
    } catch (err) {
      console.error("Error canceling subscription:", err);
      setError("Failed to cancel subscription. Please try again.");
    } finally {
      setIsCanceling(false);
    }
  };

  const createNewSession = async () => {
    // Generate unique name with count
    const todayStr = new Date().toLocaleDateString();
    const existingToday = sessions.filter(s => s.title.startsWith(`Program ${todayStr}`)).length;
    const uniqueTitle = existingToday > 0
      ? `Program ${todayStr} #${existingToday + 1}`
      : `Program ${todayStr}`;

    const newSession: Omit<AIProgrammingSession, "id"> = {
      gymId,
      createdBy: userId,
      title: uniqueTitle,
      status: "active",
      messages: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "aiProgrammingSessions"), newSession);
      const session = { id: docRef.id, ...newSession };
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
    } catch (err) {
      console.error("Error creating session:", err);
      setError("Failed to create new session");
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
        title: newTitle.trim(),
        updatedAt: Timestamp.now(),
      });

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: newTitle.trim() } : s
      ));

      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: newTitle.trim() } : null);
      }

      setEditingSessionId(null);
      setEditingTitle("");
    } catch (err) {
      console.error("Error updating session title:", err);
    }
  };

  const deletePublishedWorkouts = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete all workouts from this program? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Find all scheduled workouts created by this session
      // We'll match by createdBy (userId) and date range from the session's workouts
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      // Get all workouts for this gym
      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("gymId", "==", gymId),
        where("createdBy", "==", userId)
      );
      const snapshot = await getDocs(workoutsQuery);

      // Get the generated workouts from this session to match dates
      const generatedDates = new Set<string>();
      session.messages.forEach(msg => {
        if (msg.generatedWorkouts) {
          msg.generatedWorkouts.forEach(w => {
            if (w.date) generatedDates.add(w.date);
          });
        }
      });

      // Delete matching workouts
      let deletedCount = 0;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const workoutDate = data.date?.toDate();
        if (workoutDate) {
          const dateStr = workoutDate.toISOString().split('T')[0];
          // Check if this workout's date matches one of the generated dates
          // or if the wodTitle contains "Programming" (AI-generated pattern)
          if (generatedDates.has(dateStr) || data.wodTitle?.includes("Programming")) {
            await deleteDoc(doc(db, "scheduledWorkouts", docSnap.id));
            deletedCount++;
          }
        }
      }

      // Update session status back to active
      await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
        status: "active",
        updatedAt: Timestamp.now(),
      });

      // Update local state
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, status: "active" } : s
      ));

      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, status: "active" } : null);
      }

      onPublish?.(); // Refresh the calendar
      alert(`Deleted ${deletedCount} workouts from the calendar.`);
    } catch (err) {
      console.error("Error deleting workouts:", err);
      setError("Failed to delete workouts");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this program? If published, workouts will also be deleted.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const session = sessions.find(s => s.id === sessionId);

      // If session was published, delete the workouts first
      if (session?.status === "published") {
        const workoutsQuery = query(
          collection(db, "scheduledWorkouts"),
          where("gymId", "==", gymId),
          where("createdBy", "==", userId)
        );
        const snapshot = await getDocs(workoutsQuery);

        // Get the generated dates from this session
        const generatedDates = new Set<string>();
        session.messages.forEach(msg => {
          if (msg.generatedWorkouts) {
            msg.generatedWorkouts.forEach(w => {
              if (w.date) generatedDates.add(w.date);
            });
          }
        });

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const workoutDate = data.date?.toDate();
          if (workoutDate) {
            const dateStr = workoutDate.toISOString().split('T')[0];
            if (generatedDates.has(dateStr) || data.wodTitle?.includes("Programming")) {
              await deleteDoc(doc(db, "scheduledWorkouts", docSnap.id));
            }
          }
        }
      }

      // Delete the session itself
      await deleteDoc(doc(db, "aiProgrammingSessions", sessionId));

      // Update local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }

      onPublish?.(); // Refresh the calendar
    } catch (err) {
      console.error("Error deleting session:", err);
      setError("Failed to delete program");
    } finally {
      setIsDeleting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Timestamp.now(),
    };

    // Add user message to UI immediately
    const updatedMessages = [...activeSession.messages, userMessage];
    setActiveSession(prev => prev ? { ...prev, messages: updatedMessages } : null);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Initialize Google AI
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured. Add NEXT_PUBLIC_GEMINI_API_KEY to your environment.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Build conversation history for context
      const conversationHistory = updatedMessages.map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      ).join("\n\n");

      const prompt = `${getSystemPrompt(preferences, recentlyUsedWorkouts)}\n\nConversation so far:\n${conversationHistory}\n\nRespond to the user's latest message. Remember to output valid JSON only.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      let parsedResponse: { message: string; workouts: AIGeneratedDay[] };
      try {
        // Clean up the response - remove any markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith("```")) {
          cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        const parsed = JSON.parse(cleanedText);

        // Handle different response formats from AI
        if (Array.isArray(parsed)) {
          // AI returned just an array of workouts
          parsedResponse = {
            message: `I've generated ${parsed.length} days of programming for you. Click "Preview & Publish" to review and add them to your calendar.`,
            workouts: parsed
          };
        } else if (parsed.workouts && Array.isArray(parsed.workouts)) {
          // Expected format with message and workouts
          parsedResponse = {
            message: parsed.message || `Here's your ${parsed.workouts.length}-day program! Review the workouts below and click "Preview & Publish" when ready.`,
            workouts: parsed.workouts
          };
        } else if (parsed.message) {
          // Just a message, no workouts
          parsedResponse = {
            message: parsed.message,
            workouts: []
          };
        } else {
          // Unknown format, show as message
          parsedResponse = {
            message: text,
            workouts: []
          };
        }
      } catch {
        // If JSON parsing fails, treat as plain message
        parsedResponse = {
          message: text,
          workouts: []
        };
      }

      const assistantMessage: AIChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: parsedResponse.message,
        timestamp: Timestamp.now(),
      };

      // Only add generatedWorkouts if there are workouts
      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        assistantMessage.generatedWorkouts = parsedResponse.workouts;
      }

      const finalMessages = [...updatedMessages, assistantMessage];

      // Prepare update data - filter out any undefined values
      const updateData: Record<string, unknown> = {
        messages: finalMessages,
        updatedAt: Timestamp.now(),
      };

      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        updateData.programWeeks = Math.ceil(parsedResponse.workouts.length / 7);
      }

      // Update session in Firestore
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), updateData);

      setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to get AI response. Make sure Vertex AI API is enabled.");
    } finally {
      setIsLoading(false);
    }
  };

  const getAllGeneratedWorkouts = (): AIGeneratedDay[] => {
    if (!activeSession) return [];

    // Get the most recent message with workouts
    for (let i = activeSession.messages.length - 1; i >= 0; i--) {
      const msg = activeSession.messages[i];
      if (msg.generatedWorkouts && msg.generatedWorkouts.length > 0) {
        return msg.generatedWorkouts;
      }
    }
    return [];
  };

  const publishToCalendar = async () => {
    if (!activeSession || selectedGroups.length === 0) return;

    const workouts = getAllGeneratedWorkouts();
    if (workouts.length === 0) return;

    // Validate required fields
    if (!gymId || !userId) {
      setError("Missing gym or user information");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      // Create scheduled workouts for each day
      for (const day of workouts) {
        if (day.isRestDay) continue;
        if (!day.components || day.components.length === 0) continue;

        // Build components array - include notes and scoringType if present
        const cleanComponents: Array<{id: string; type: string; title: string; description: string; notes?: string; scoringType?: string}> = [];

        for (let idx = 0; idx < day.components.length; idx++) {
          const comp = day.components[idx];
          if (!comp || !comp.type || !comp.title) continue;

          // Build component with required fields
          const component: {id: string; type: string; title: string; description: string; notes?: string; scoringType?: string} = {
            id: String(`comp-${idx}`),
            type: String(comp.type || "wod"),
            title: String(comp.title || "Workout"),
            description: String(comp.description || ""),
          };

          // Add notes if present
          if (comp.notes) {
            component.notes = String(comp.notes);
          }

          // Add scoringType for WOD components (fortime, amrap, emom)
          if (comp.type === "wod" && comp.scoringType) {
            component.scoringType = String(comp.scoringType);
          }

          cleanComponents.push(component);
        }

        // Skip if no valid components
        if (cleanComponents.length === 0) continue;

        // Build workout date
        const workoutDate = new Date(day.date);
        if (isNaN(workoutDate.getTime())) continue; // Skip invalid dates

        // Generate time slots from selected groups' default time slots
        const groupsToUse = groups.filter(g => selectedGroups.includes(g.id));
        const timeSlots: ScheduledTimeSlot[] = [];
        const seenTimes = new Set<string>();

        groupsToUse.forEach((group) => {
          if (group.defaultTimeSlots?.length > 0) {
            group.defaultTimeSlots.forEach((slot: { hour: number; minute: number; capacity?: number }) => {
              const hour = typeof slot.hour === 'number' ? slot.hour : parseInt(slot.hour as unknown as string) || 0;
              const minute = typeof slot.minute === 'number' ? slot.minute : parseInt(slot.minute as unknown as string) || 0;
              const timeKey = `${hour}:${minute}`;
              if (!seenTimes.has(timeKey)) {
                seenTimes.add(timeKey);
                timeSlots.push({
                  id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  hour: hour,
                  minute: minute,
                  capacity: slot.capacity || 20,
                  signups: [],
                });
              }
            });
          }
        });

        // Sort time slots by time
        timeSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

        // Create document
        await addDoc(collection(db, "scheduledWorkouts"), {
          gymId: String(gymId),
          wodTitle: String(`${day.dayOfWeek || "Day"} Programming`),
          wodDescription: String(cleanComponents.map(c => c.title).join(", ")),
          workoutType: "wod",
          groupIds: selectedGroups.map(g => String(g)),
          createdBy: String(userId),
          recurrenceType: "none",
          components: cleanComponents,
          hideDetails: false,
          date: Timestamp.fromDate(workoutDate),
          createdAt: serverTimestamp(),
          timeSlots,
        });
      }

      // Update session status
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), {
        status: "published",
        targetGroupIds: selectedGroups,
        updatedAt: Timestamp.now(),
      });

      setActiveSession(prev => prev ? { ...prev, status: "published" } : null);
      setShowPreview(false);
      onPublish?.();
      alert("Programming published successfully!");
    } catch (err) {
      console.error("PUBLISH_ERROR_V2:", err);
      setError("Failed to publish programming");
    } finally {
      setIsPublishing(false);
    }
  };

  const generatedWorkouts = getAllGeneratedWorkouts();

  if (loadingSessions) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading AI Programming...</p>
      </div>
    );
  }

  // Show paywall if user doesn't have an active subscription
  if (!hasActiveSubscription) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <AITrainerPaywall userEmail={userEmail} variant="coach" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Programming Assistant</h2>
              <p className="text-white/80 text-sm">Generate months of workouts with AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              title="AI Programming Preferences"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New Program
            </button>
          </div>
        </div>

        {/* Subscription Status Bar */}
        {subscription && (
          <div className="px-4 py-2 bg-white/10 flex items-center justify-between text-xs">
            <span className="text-white/80">
              {subscription.status === "canceled" && subscription.endDate ? (
                <>Access ends {subscription.endDate?.toDate?.().toLocaleDateString() || "soon"}</>
              ) : subscription.status === "trialing" ? (
                <>Trial ends {subscription.trialEndsAt?.toDate?.().toLocaleDateString() || "soon"}</>
              ) : (
                <>Subscription active</>
              )}
            </span>
            {subscription.status === "canceled" ? (
              <button
                onClick={() => window.location.href = "/subscribe?variant=coach"}
                className="text-green-200 hover:text-green-100 hover:underline"
              >
                Resubscribe
              </button>
            ) : (
              <button
                onClick={() => setShowCancelModal(true)}
                className="text-red-200 hover:text-red-100 hover:underline"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex gap-2 p-3 border-b border-gray-200 overflow-x-auto bg-gray-50">
          {sessions.slice(0, 5).map(session => (
            <div key={session.id} className="relative group flex items-center gap-1">
              {editingSessionId === session.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => updateSessionTitle(session.id, editingTitle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateSessionTitle(session.id, editingTitle);
                    if (e.key === "Escape") {
                      setEditingSessionId(null);
                      setEditingTitle("");
                    }
                  }}
                  autoFocus
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-900 bg-white border-2 border-purple-500 focus:outline-none min-w-[120px]"
                />
              ) : (
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveSession(session)}
                    className={`px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                      activeSession?.id === session.id
                        ? "bg-purple-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {session.title}
                    {session.status === "published" && (
                      <span className="ml-2 text-xs opacity-70">✓</span>
                    )}
                  </button>
                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(session.id);
                      setEditingTitle(session.title);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 border-l border-gray-200 transition-colors"
                    title="Rename program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border-l border-gray-200 transition-colors disabled:opacity-50"
                    title="Delete program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chat Area */}
      {activeSession ? (
        <>
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {activeSession.messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your Programming</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                  Tell me about your gym and what kind of programming you need. For example:
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>"Generate 4 weeks of CrossFit programming for intermediate athletes"</p>
                  <p>"Create a strength-focused program with Olympic lifting"</p>
                  <p>"I need 8 weeks of programming with 2 rest days per week"</p>
                </div>
              </div>
            ) : (
              activeSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Show generated workouts preview */}
                    {message.generatedWorkouts && message.generatedWorkouts.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Generated {message.generatedWorkouts.length} days of programming
                          </span>
                          <button
                            onClick={() => setShowPreview(true)}
                            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                          >
                            Preview & Publish
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {message.generatedWorkouts.slice(0, 14).map((day, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded text-center text-xs ${
                                day.isRestDay
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {day.dayOfWeek.slice(0, 3)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Describe the programming you need..."
                disabled={isLoading || activeSession.status === "published"}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || activeSession.status === "published"}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
            {activeSession.status === "published" && (
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-gray-500">
                  This program has been published.
                </p>
                <button
                  onClick={() => deletePublishedWorkouts(activeSession.id)}
                  disabled={isDeleting}
                  className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Unpublish & Delete Workouts"}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Program</h3>
          <p className="text-gray-500 text-sm mb-4">
            Start a new AI-powered programming session
          </p>
          <button
            onClick={createNewSession}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create New Program
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && generatedWorkouts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Preview Programming</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedWorkouts.map((day, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${
                      day.isRestDay
                        ? "bg-gray-50 border-gray-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900">{day.dayOfWeek}</span>
                      <span className="text-sm text-gray-500">{day.date}</span>
                    </div>
                    {day.isRestDay ? (
                      <p className="text-gray-500 text-sm">Rest Day</p>
                    ) : (
                      <div className="space-y-2">
                        {day.components.map((comp, compIdx) => (
                          <div key={compIdx} className="text-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                comp.type === "warmup" ? "bg-yellow-100 text-yellow-700" :
                                comp.type === "wod" ? "bg-orange-100 text-orange-700" :
                                comp.type === "lift" ? "bg-purple-100 text-purple-700" :
                                comp.type === "skill" ? "bg-green-100 text-green-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                                {comp.type.toUpperCase()}
                              </span>
                              {comp.type === "wod" && comp.scoringType && (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  comp.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                                  comp.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                  comp.scoringType === "emom" ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {comp.scoringType === "fortime" ? "For Time" : comp.scoringType.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900">{comp.title}</p>
                            <p className="text-gray-600 text-xs whitespace-pre-line">{comp.description}</p>
                            {comp.notes && (
                              <div className="mt-1 p-1.5 bg-gray-50 rounded border-l-2 border-gray-300">
                                <p className="text-gray-500 text-xs whitespace-pre-line italic">{comp.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publish to Groups
                </label>
                <div className="flex flex-wrap gap-2">
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroups(prev =>
                          prev.includes(group.id)
                            ? prev.filter(id => id !== group.id)
                            : [...prev, group.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedGroups.includes(group.id)
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={publishToCalendar}
                  disabled={selectedGroups.length === 0 || isPublishing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? "Publishing..." : `Publish ${generatedWorkouts.filter(d => !d.isRestDay).length} Workouts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-xl">
              <h3 className="text-lg font-semibold text-white">AI Programming Preferences</h3>
              <p className="text-white/80 text-sm">Set rules and philosophy for the AI to follow</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Gym Philosophy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gym Philosophy
                </label>
                <textarea
                  value={preferences.philosophy}
                  onChange={(e) => setPreferences(prev => ({ ...prev, philosophy: e.target.value }))}
                  placeholder="e.g., We focus on functional fitness for all levels. We emphasize proper form over heavy weights. Our members enjoy longer, challenging workouts..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Workout Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Workout Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "short", label: "Short", desc: "<15 min" },
                    { value: "medium", label: "Medium", desc: "15-25 min" },
                    { value: "long", label: "Long", desc: "25+ min" },
                    { value: "varied", label: "Varied", desc: "Mix it up" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(prev => ({ ...prev, workoutDuration: opt.value as AIProgrammingPreferences["workoutDuration"] }))}
                      className={`p-2 rounded-lg text-center transition-colors ${
                        preferences.workoutDuration === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Benchmark Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benchmark WOD Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "often", label: "Often", desc: "1-2/week" },
                    { value: "sometimes", label: "Sometimes", desc: "1-2/month" },
                    { value: "rarely", label: "Rarely", desc: "Custom only" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(prev => ({ ...prev, benchmarkFrequency: opt.value as AIProgrammingPreferences["benchmarkFrequency"] }))}
                      className={`p-2 rounded-lg text-center transition-colors ${
                        preferences.benchmarkFrequency === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Programming Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Programming Style Inspiration
                </label>
                <input
                  type="text"
                  value={preferences.programmingStyle}
                  onChange={(e) => setPreferences(prev => ({ ...prev, programmingStyle: e.target.value }))}
                  placeholder="e.g., Mayhem, CompTrain, HWPO, CrossFit Main Site, Custom..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">The AI will try to match this programming style</p>
              </div>

              {/* Additional Rules */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Rules or Preferences
                </label>
                <textarea
                  value={preferences.additionalRules}
                  onChange={(e) => setPreferences(prev => ({ ...prev, additionalRules: e.target.value }))}
                  placeholder="e.g., Always include a strength component. No running on Mondays. Include skill work at least 2x per week. Avoid programming heavy deadlifts and back squats on consecutive days..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={savePreferences}
                disabled={savingPreferences}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPreferences ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Cancel AI Programming?
              </h3>
              <p className="text-gray-600 text-sm text-center mb-6">
                Are you sure you want to cancel your AI Programming subscription? You&apos;ll lose access to the AI programming assistant at the end of your current billing period.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={isCanceling}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCanceling ? "Canceling..." : "Yes, Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
