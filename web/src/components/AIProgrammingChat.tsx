"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, limit, Timestamp, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AIProgrammingSession, AIChatMessage, AIGeneratedDay, AIProgrammingPreferences, AITrainerSubscription, TrainingEvent, TrainingEventType, WeekdayKey, AICoachPreferences } from "@/lib/types";
import { getAllSkills, getAllLifts, getAllWods } from "@/lib/workoutData";
import { chatCompletion } from "@/lib/ai";
import AITrainerPaywall from "./AITrainerPaywall";

// Get preset workout names for the AI prompt
const getPresetSkillNames = () => getAllSkills().map(s => s.name);
const getPresetLiftNames = () => getAllLifts().map(l => l.name);
const getPresetWodNames = () => getAllWods().map(w => w.name);

// Default preferences
const defaultPreferences: Omit<AIProgrammingPreferences, "userId" | "updatedAt"> = {
  philosophy: "",
  equipment: "",
  events: [],
  weeklySchedule: {},
  longRunDay: "",
  restDaysPerWeek: 0,
  workoutDuration: "varied",
  benchmarkFrequency: "sometimes",
  programmingStyle: "",
  additionalRules: "",
};

const WEEKDAYS: { key: WeekdayKey; label: string; full: string }[] = [
  { key: "monday", label: "Mon", full: "Monday" },
  { key: "tuesday", label: "Tue", full: "Tuesday" },
  { key: "wednesday", label: "Wed", full: "Wednesday" },
  { key: "thursday", label: "Thu", full: "Thursday" },
  { key: "friday", label: "Fri", full: "Friday" },
  { key: "saturday", label: "Sat", full: "Saturday" },
  { key: "sunday", label: "Sun", full: "Sunday" },
];

const RACE_DISTANCES = ["5K", "10K", "Half Marathon", "Marathon", "Ultra", "Other distance"];

// Outline of a long-range training plan (generated week by week)
interface ProgramOutlineWeek {
  weekNumber: number;
  startDate: string;
  focus: string;
  details?: string;
}

interface ProgramOutline {
  startDate: string;
  endDate: string;
  weeks: ProgramOutlineWeek[];
}

// Strip markdown code fences from an AI JSON response
function cleanJsonText(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

// Keep only the most recent generated program in the saved session so long
// programs stay well under Firestore's 1MB document limit
function stripOldWorkouts(messages: AIChatMessage[]): AIChatMessage[] {
  const lastWithWorkouts = [...messages].reverse().find(m => m.generatedWorkouts && m.generatedWorkouts.length > 0);
  return messages.map(m => {
    if (m === lastWithWorkouts || !m.generatedWorkouts) return m;
    const rest = { ...m };
    delete rest.generatedWorkouts;
    return rest;
  });
}

interface AIProgrammingChatProps {
  userId: string;
  userEmail?: string;
  onPublish?: () => void;
  subscription?: AITrainerSubscription;
  // The athlete's profile from their AI Coach settings (goals, injuries, experience)
  athleteProfile?: AICoachPreferences;
  // Deep-link support: open a specific session with a pre-filled request (e.g., regenerate a day)
  initialSessionId?: string;
  initialPrompt?: string;
}

// Build the athlete-profile prompt section (goals, injuries, experience)
function buildProfileSection(athleteProfile?: AICoachPreferences): string {
  if (!athleteProfile) return "";
  const lines: string[] = [];
  if (athleteProfile.goals) lines.push(`- Goals: ${athleteProfile.goals}`);
  if (athleteProfile.injuries) lines.push(`- INJURIES/LIMITATIONS (CRITICAL - NEVER program movements that could aggravate these; always substitute safe alternatives): ${athleteProfile.injuries}`);
  if (athleteProfile.experienceLevel) lines.push(`- Experience level: ${athleteProfile.experienceLevel}`);
  if (athleteProfile.focusAreas && athleteProfile.focusAreas.length > 0) lines.push(`- Focus areas: ${athleteProfile.focusAreas.join(", ")}`);
  return lines.length > 0 ? `\nATHLETE PROFILE:\n${lines.join("\n")}\n` : "";
}

function buildPreferencesSection(preferences?: Omit<AIProgrammingPreferences, "userId" | "updatedAt">): string {
  // Build athlete preferences section
  let athletePreferencesSection = "";
  if (preferences) {
    const prefParts: string[] = [];

    if (preferences.philosophy) {
      prefParts.push(`Training Philosophy/Goals: ${preferences.philosophy}`);
    }

    if (preferences.equipment) {
      prefParts.push(`Available Equipment (garage/home gym): ${preferences.equipment}\nIMPORTANT: ONLY program movements that can be done with this equipment. Substitute anything that requires equipment they don't have.`);
    }

    const eventsWithDates = (preferences.events || []).filter(e => e.date);
    if (eventsWithDates.length > 0) {
      const eventLines = eventsWithDates.map(e => {
        const label = e.type === "running_race"
          ? `Running race${e.detail ? ` (${e.detail})` : ""}`
          : e.type === "crossfit_comp"
          ? "CrossFit competition"
          : `Event${e.detail ? ` (${e.detail})` : ""}`;
        return `- ${label}${e.name ? `: "${e.name}"` : ""} on ${e.date}`;
      });
      const hasRace = eventsWithDates.some(e => e.type === "running_race");
      const longRunLine = hasRace && preferences.longRunDay
        ? `\n- Schedule the weekly LONG RUN on ${preferences.longRunDay.charAt(0).toUpperCase() + preferences.longRunDay.slice(1)} every week.`
        : "";
      prefParts.push(`EVENTS THE ATHLETE IS TRAINING FOR (CRITICAL - build the entire plan around these):\n${eventLines.join("\n")}\n- Structure phases (base -> build -> peak -> taper) around each event and put the event day itself on the calendar.${hasRace ? "\n- The running race REQUIRES real run training as standalone workouts: a weekly long run that builds progressively, easy runs, and race-pace work, each with distance and pacing guidance." : ""}${longRunLine}`);
    }

    const schedule = preferences.weeklySchedule || {};
    const scheduleLines: string[] = [];
    const dayNames: Record<string, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };
    for (const key of Object.keys(dayNames)) {
      const setting = schedule[key as keyof typeof schedule];
      if (!setting) continue;
      if (setting.mode === "open") {
        if (setting.maxMinutes && setting.maxMinutes > 0) {
          scheduleLines.push(`- ${dayNames[key]}: total training time (including warmup) must stay under ${setting.maxMinutes} minutes`);
        }
        continue;
      }
      if (setting.mode === "rest") {
        scheduleLines.push(`- ${dayNames[key]}: COMPLETE REST DAY every week - always program rest`);
      } else {
        const desc = setting.classDescription || "a class at their gym";
        if ((setting.classAttendance || "always") === "optional") {
          const timeBudget = setting.maxMinutes && setting.maxMinutes > 0
            ? ` If you program training instead of the class, the full session (including warmup) must stay under ${setting.maxMinutes} minutes.`
            : "";
          scheduleLines.push(`- ${dayNames[key]}: CLASS AVAILABLE - ${desc}. YOU decide each week and COMMIT to exactly one prescription for this day: the class, a specific programmed workout, or rest. NEVER write "optional" or "attend or rest - your call" - the athlete wants to be told exactly what to do. When prescribing the class, add ONE component noting it.${timeBudget}`);
        } else {
          scheduleLines.push(`- ${dayNames[key]}: FIXED CLASS every week - ${desc}. Do NOT program a workout for this day; add ONE component noting the class (with intensity guidance during taper weeks).`);
        }
      }
    }
    if (scheduleLines.length > 0) {
      prefParts.push(`WEEKLY SCHEDULE (NON-NEGOTIABLE - applies to every single week):\n${scheduleLines.join("\n")}\nDays not listed above (and days marked "Train") are AVAILABLE for training - they are NOT all mandatory training days.\nPRECEDENCE: These structured schedule settings are the athlete's CURRENT choices. If anything in the free-text preferences, athlete profile, or earlier conversation conflicts with them (e.g., older statements about which days to train or attend classes), the structured settings above WIN.`);
    }

    const explicitRestDays = Object.values(schedule).filter(d => d?.mode === "rest").length;
    const restTarget = preferences.restDaysPerWeek || 0;
    if (restTarget > 0) {
      const remainder = Math.max(0, restTarget - explicitRestDays);
      prefParts.push(`REST DAYS: The athlete wants ${restTarget} full rest day${restTarget > 1 ? "s" : ""} EVERY week.${explicitRestDays > 0 ? ` ${explicitRestDays} ${explicitRestDays > 1 ? "are" : "is"} fixed in the weekly schedule above.` : ""}${remainder > 0 ? ` Place the other ${remainder} on whichever available day${remainder > 1 ? "s" : ""} best support${remainder > 1 ? "" : "s"} recovery (typically after the hardest sessions).` : ""}`);
    } else {
      prefParts.push(`REST DAYS: Include at least 1 (usually 2) FULL rest days every week unless the athlete explicitly asks for more training. Never program 7 straight training days.`);
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
      athletePreferencesSection = `
ATHLETE PREFERENCES (IMPORTANT - Follow these rules):
${prefParts.join("\n")}

`;
    }
  }
  return athletePreferencesSection;
}

const getSystemPrompt = (preferences?: Omit<AIProgrammingPreferences, "userId" | "updatedAt">, recentlyUsedWorkouts?: string[]) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });

  // Calculate upcoming dates for each day of the week
  const getNextDayDate = (targetDay: number) => {
    const date = new Date(today);
    const currentDay = date.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7; // If the day has passed this week, get next week's
    date.setDate(date.getDate() + daysUntil);
    return date.toISOString().split('T')[0];
  };

  const upcomingDates = {
    Sunday: getNextDayDate(0),
    Monday: getNextDayDate(1),
    Tuesday: getNextDayDate(2),
    Wednesday: getNextDayDate(3),
    Thursday: getNextDayDate(4),
    Friday: getNextDayDate(5),
    Saturday: getNextDayDate(6),
  };

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

  const athletePreferencesSection = buildPreferencesSection(preferences);

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

  return `You are a personal CrossFit coach creating workout programming for an individual athlete training in their garage or home gym. You ARE their coach - be direct, encouraging, and specific.
${athletePreferencesSection}${recentlyUsedSection}IMPORTANT DATE INFORMATION:
- Today's date is ${todayStr} (${dayOfWeek})
- Current month: ${monthName}
- Current season: ${season}

UPCOMING DATES FOR EACH DAY OF THE WEEK (use these EXACT dates):
- Sunday: ${upcomingDates.Sunday}
- Monday: ${upcomingDates.Monday}
- Tuesday: ${upcomingDates.Tuesday}
- Wednesday: ${upcomingDates.Wednesday}
- Thursday: ${upcomingDates.Thursday}
- Friday: ${upcomingDates.Friday}
- Saturday: ${upcomingDates.Saturday}

When the user asks for a specific day (e.g., "Wednesday"), use the corresponding date from above.
When generating multiple days, use the correct date for each day requested.

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
          "notes": "Focus on mobility and increasing heart rate gradually. No rest between movements."
        },
        {
          "type": "lift",
          "title": "Back Squat",
          "description": "Build to a heavy set of 5, then:\\n3 x 5 @ 80-85% of today's heavy set\\nRest 2-3 min between sets",
          "notes": "STIMULUS: Build strength with moderate-heavy load. Should feel challenging but controlled.\\n\\nGOAL: Improve 5-rep max capacity. Focus on depth, bracing, and bar speed.\\n\\nSCALED: Reduce weight 10-20% if form breaks down or if newer to back squatting.\\n\\nFOUNDATIONS: Goblet squat with dumbbell/kettlebell. Focus on depth and core stability. 3 x 8-10 reps."
        },
        {
          "type": "skill",
          "title": "Toes-to-Bar",
          "description": "Every 90 sec for 6 rounds:\\n5-8 Toes-to-Bar (or progression)\\n\\nDrill Work (before sets):\\n- 10 kip swings (hollow to arch)\\n- 5 slow knees-to-chest\\n- 5 controlled leg raises",
          "notes": "STIMULUS: Skill development - focus on rhythm, timing, and efficiency, not fatigue.\\n\\nGOAL: Build capacity and consistency in the kipping pattern. Quality over quantity.\\n\\nSCALED: Knees-to-Elbows (same rep scheme). Focus on full extension at bottom.\\n\\nFOUNDATIONS: Hanging knee raises or V-ups on floor. 6 rounds of 8-10 reps.\\n\\nPROGRESSION TIP: Master the kip swing timing before adding leg lift."
        },
        {
          "type": "wod",
          "title": "Fran",
          "description": "21-15-9 For Time:\\nThrusters\\nPull-ups\\n\\nTime Cap: 10 minutes",
          "scoringType": "fortime",
          "notes": "STIMULUS: Sprint effort. This should feel intense from the first rep. Heart rate high, breathing hard.\\n\\nGOAL: Sub-5 elite, sub-7 competitive, sub-10 fitness. Aim for large sets or unbroken if possible.\\n\\nRx: Thrusters 95/65 lb, Kipping Pull-ups\\n\\nSCALED: Thrusters 65/45 lb, Banded Pull-ups or Jumping Pull-ups\\n- For athletes who can do pull-ups but not 45 total\\n- For athletes building toward Rx weights\\n\\nFOUNDATIONS: Thrusters 45/35 lb (or dumbbells 20/15), Ring Rows\\n- For newer athletes still building capacity\\n- Focus on moving well, not moving fast\\n\\nSCORING: Record time and note Rx/Scaled/Foundations. If you modified further, note in comments."
        },
        {
          "type": "cooldown",
          "title": "Recovery",
          "description": "2 rounds:\\n1 min couch stretch each leg\\n1 min pigeon pose each side\\n10 slow cat-cows",
          "notes": "Take your time. Breathe deeply. This is recovery, not a workout."
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
- EVERY day gets ONE definitive prescription: a workout, a class, or rest. NEVER program "optional" sessions or attend-or-skip choices - decide for the athlete
- "skill" components are ONLY for low-fatigue technique development (e.g., double-under practice, handstand/muscle-up progressions, kipping drills). Conditioning EMOMs/AMRAPs are "wod" even when built around one movement - an EMOM of wall balls is a WOD, not skill work
- Train the athlete's stated weaknesses 1-2x per week using VARIED approaches - do NOT insert the same movement into every session
- Include proper warm-ups and skill work
- Program appropriate rest days (typically 2 per week)
- Scale difficulty based on the athlete's level
- Assume a garage/home gym setup: no fancy machines unless the athlete lists them
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
- If the athlete attends a class elsewhere on fixed days (e.g., an Olympic lifting class at their gym), do NOT program a workout for that day - include ONE component describing the class (e.g., type "lift", title "Olympic Lifting Class") with brief notes; class components are exempt from the preset-name rule

IMPORTANT - STIMULUS, GOALS, AND SCALING:
Every workout component MUST have detailed notes with:

1. STIMULUS: What should this feel like? (sprint effort, grinding pace, controlled movement, etc.)
   - Be specific: "Heart rate should stay elevated", "Should feel heavy but controlled", "Breathing hard but recoverable"

2. GOAL: What is this workout trying to achieve?
   - Time targets for For Time workouts (elite/competitive/fitness ranges)
   - Rep targets for AMRAPs
   - Intensity expectations
   - What the athlete should focus on (unbroken sets, pacing, technique, etc.)

3. THREE SCALING LEVELS with clear guidance:
   a) Rx (prescribed): Standard weights and movements with specific expectations
   b) SCALED: Lighter weights OR easier movement variations
      - Include WHO should scale: "For athletes building toward Rx" or "If you can't do 15+ unbroken"
      - Be specific about modifications: exact weights, band colors, etc.
   c) FOUNDATIONS (Beginner): Most accessible option
      - For newer athletes or those with limitations
      - Focus should be on movement quality, not intensity
      - Include alternative equipment if needed (dumbbells instead of barbell)

SCALING WEIGHT EXAMPLES:
- Barbell Clean/Snatch: "Rx: 135/95, Scaled: 95/65, Foundations: 65/45 or PVC/empty bar"
- Thrusters: "Rx: 95/65, Scaled: 65/45, Foundations: 45/35 or DB 20/15"
- Deadlift: "Rx: 225/155, Scaled: 155/105, Foundations: 95/65"
- Kettlebell Swings: "Rx: 53/35, Scaled: 35/26, Foundations: 26/18"
- Wall Balls: "Rx: 20/14 to 10/9ft, Scaled: 14/10 to 9ft, Foundations: 10/6 to 9ft"

SCALING MOVEMENT EXAMPLES:
- Pull-ups: "Rx: Kipping, Scaled: Banded (green/blue) or Jumping, Foundations: Ring Rows"
- Muscle-ups: "Rx: Bar/Ring MU, Scaled: C2B + Dips, Foundations: Pull-ups + Push-ups"
- Handstand Push-ups: "Rx: Strict/Kipping, Scaled: Pike Push-ups (box), Foundations: DB Strict Press"
- Box Jumps: "Rx: 24/20 jump, Scaled: 20/16 jump, Foundations: Step-ups any height"
- Double-Unders: "Rx: DUs, Scaled: 2:1 Singles, Foundations: 3:1 Singles or Penguin Jumps"
- Toes-to-Bar: "Rx: TTB, Scaled: Knees-to-Elbows, Foundations: Hanging Knee Raises or V-ups"

LONG-RANGE PROGRAMS (more than 2 weeks):
If the user asks for programming spanning MORE than 14 days (e.g., "program every day until my marathon", "12 weeks of training"), DO NOT generate the days directly. Instead respond with a week-by-week training plan outline in this exact JSON format:
{
  "message": "Explain the overall plan: the phases, the standard weekly structure, how you're building toward their events, and where the rest days are",
  "outline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "weeks": [
      {
        "weekNumber": 1,
        "startDate": "YYYY-MM-DD",
        "focus": "Base building",
        "details": "Which days run/lift/WOD/rest, key sessions, volume targets, fixed commitments like gym classes, and any event that falls in this week"
      }
    ]
  }
}
- startDate is the first training day (today unless they say otherwise); endDate is the final day of the plan (e.g., race day).
- Include one entry per week covering the ENTIRE requested date range - never stop early.
- Build proper phases around any events the user mentions (base -> build -> peak -> taper -> event -> recovery).
- Restate the athlete's fixed weekly commitments (classes on specific days) and their rest days in EVERY week's details.
The app will then ask you for each week's daily workouts one at a time.

If the user is just chatting or asking questions (not requesting workouts), respond with just:
{
  "message": "Your response here",
  "workouts": []
}

IMPORTANT: Always respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;
};

export default function AIProgrammingChat({ userId, userEmail, onPublish, subscription, athleteProfile, initialSessionId, initialPrompt }: AIProgrammingChatProps) {
  // Check if user has an active AI subscription
  const hasActiveSubscription = subscription &&
    (subscription.status === "active" || subscription.status === "trialing");
  const [sessions, setSessions] = useState<AIProgrammingSession[]>([]);
  const [activeSession, setActiveSession] = useState<AIProgrammingSession | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Programming preferences state
  const [preferences, setPreferences] = useState<Omit<AIProgrammingPreferences, "userId" | "updatedAt">>(defaultPreferences);
  const [showSettings, setShowSettings] = useState(false);
  const [preferencesDocId, setPreferencesDocId] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Recently used workouts (last 6 months) - to avoid repetition
  const [recentlyUsedWorkouts, setRecentlyUsedWorkouts] = useState<string[]>([]);

  // Progress while generating a multi-week program
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);

  // Athlete data pulled from their training log (PRs, recent results, existing calendar)
  const [athleteContext, setAthleteContext] = useState<string>("");

  useEffect(() => {
    const loadAthleteContext = async () => {
      if (!userId) return;
      try {
        const parts: string[] = [];

        // Lift PRs (best weight per lift + rep count)
        const liftSnap = await getDocs(query(collection(db, "liftResults"), where("userId", "==", userId), limit(150)));
        const bests = new Map<string, number>();
        liftSnap.docs.forEach(d => {
          const x = d.data();
          if (x.liftTitle && x.weight) {
            const k = `${x.liftTitle}|${x.reps || 1}`;
            if ((bests.get(k) || 0) < x.weight) bests.set(k, x.weight);
          }
        });
        if (bests.size > 0) {
          const lines = Array.from(bests.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([k, w]) => {
              const [title, reps] = k.split("|");
              return `- ${title}: ${w}lb (${reps}RM)`;
            });
          parts.push(`LIFT PRs - use these to prescribe REAL weights for percentage work (e.g., "165lb - that's 70% of your 235lb 1RM"):\n${lines.join("\n")}`);
        }

        // Recent WOD results
        const wodSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", userId), limit(100)));
        const logs = wodSnap.docs.map(d => d.data())
          .filter(x => x.wodTitle)
          .sort((a, b) => (b.completedDate?.toMillis?.() || 0) - (a.completedDate?.toMillis?.() || 0))
          .slice(0, 10);
        if (logs.length > 0) {
          const lines = logs.map(x => {
            let res = "";
            if (x.timeInSeconds) {
              const m = Math.floor(x.timeInSeconds / 60);
              const sec = x.timeInSeconds % 60;
              res = `${m}:${String(sec).padStart(2, "0")}`;
            } else if (x.rounds !== undefined && x.rounds !== null) {
              res = `${x.rounds}+${x.reps || 0} rounds`;
            }
            return `- ${x.wodTitle}${res ? `: ${res}` : ""}`;
          });
          parts.push(`RECENT WOD RESULTS - calibrate intensity, pacing targets, and volume to this athlete:\n${lines.join("\n")}`);
        }

        // Workouts already on the calendar (next ~60 days)
        const pwSnap = await getDocs(query(collection(db, "personalWorkouts"), where("userId", "==", userId)));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const horizon = new Date(today);
        horizon.setDate(horizon.getDate() + 60);
        const upcoming = pwSnap.docs.map(d => d.data())
          .filter(x => {
            const dt = x.date?.toDate?.();
            return dt && dt >= today && dt <= horizon;
          })
          .sort((a, b) => (a.date?.toMillis?.() || 0) - (b.date?.toMillis?.() || 0))
          .slice(0, 45);
        if (upcoming.length > 0) {
          const lines = upcoming.map(x => {
            const ds = x.dateString || x.date?.toDate?.()?.toISOString?.().split("T")[0];
            const titles = (x.components || []).map((c: { title?: string }) => c.title).filter(Boolean).join(", ");
            return `- ${ds}: ${titles || "workout"}${x.aiSessionId ? " (AI plan)" : ""}`;
          });
          parts.push(`WORKOUTS ALREADY ON THE ATHLETE'S CALENDAR - account for these when planning; publishing a new AI plan REPLACES AI-planned workouts on the same dates, but manually-added workouts stay:\n${lines.join("\n")}`);
        }

        setAthleteContext(parts.length > 0 ? `\nATHLETE DATA (from their training log):\n\n${parts.join("\n\n")}\n` : "");
      } catch (err) {
        console.error("Error loading athlete context:", err);
      }
    };
    loadAthleteContext();
  }, [userId]);

  // Combined athlete block injected into every prompt
  const athleteBlock = buildProfileSection(athleteProfile) + athleteContext;

  // Load recently used workouts from the last 6 months of the athlete's calendar
  useEffect(() => {
    const loadRecentWorkouts = async () => {
      if (!userId) return;

      try {
        // Get date 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Query the athlete's personal workouts (filter by date client-side to avoid index requirement)
        const workoutsQuery = query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId)
        );
        const snapshot = await getDocs(workoutsQuery);

        // Extract unique WOD names from components
        const usedWorkouts = new Set<string>();

        snapshot.docs.forEach(doc => {
          const data = doc.data();

          // Check if workout is within last 6 months
          const workoutDate = data.date?.toDate?.();
          if (!workoutDate || workoutDate < sixMonthsAgo) return;

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
  }, [userId]);

  // Load existing sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        // Query by userId only and sort client-side to avoid a composite index requirement
        const sessionsQuery = query(
          collection(db, "aiProgrammingSessions"),
          where("userId", "==", userId)
        );
        const snapshot = await getDocs(sessionsQuery);
        const loadedSessions = (snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AIProgrammingSession[]).sort((a, b) => {
          const dateA = a.updatedAt?.toDate?.()?.getTime() || 0;
          const dateB = b.updatedAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });
        setSessions(loadedSessions);

        // Deep link: open the requested session, otherwise the first active one
        const requested = initialSessionId ? loadedSessions.find(s => s.id === initialSessionId) : undefined;
        const activeOne = requested || loadedSessions.find(s => s.status === "active");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pre-fill the input when deep-linked (e.g., regenerate a day from the calendar)
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load programming preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefsQuery = query(
          collection(db, "aiProgrammingPreferences"),
          where("userId", "==", userId)
        );
        const snapshot = await getDocs(prefsQuery);
        if (!snapshot.empty) {
          const prefDoc = snapshot.docs[0];
          const prefData = prefDoc.data();
          setPreferencesDocId(prefDoc.id);
          setPreferences({
            philosophy: prefData.philosophy || "",
            equipment: prefData.equipment || "",
            events: prefData.events || [],
            weeklySchedule: prefData.weeklySchedule || {},
            longRunDay: prefData.longRunDay || "",
            restDaysPerWeek: prefData.restDaysPerWeek || 0,
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
  }, [userId]);

  // Save preferences
  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      const prefData = {
        userId,
        ...preferences,
        events: (preferences.events || []).map(e => ({
          id: e.id,
          type: e.type,
          name: e.name || "",
          date: e.date || "",
          detail: e.detail || "",
        })),
        weeklySchedule: Object.fromEntries(
          Object.entries(preferences.weeklySchedule || {}).map(([day, setting]) => [
            day,
            { mode: setting.mode, classDescription: setting.classDescription || "", classAttendance: setting.classAttendance || "always", maxMinutes: setting.maxMinutes || 0 },
          ])
        ),
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

  // Training event helpers
  const addEvent = () => {
    setPreferences(prev => ({
      ...prev,
      events: [
        ...(prev.events || []),
        { id: `ev_${Date.now()}`, type: "running_race" as TrainingEventType, name: "", date: "", detail: "Marathon" },
      ],
    }));
  };

  const updateEvent = (id: string, field: "type" | "name" | "date" | "detail", value: string) => {
    setPreferences(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === id ? { ...e, [field]: value } as TrainingEvent : e),
    }));
  };

  const removeEvent = (id: string) => {
    setPreferences(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== id),
    }));
  };

  // Weekly schedule helpers
  const updateScheduleDay = (day: WeekdayKey, mode: "open" | "class" | "rest") => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode,
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  const updateScheduleMinutes = (day: WeekdayKey, maxMinutes: number) => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: prev.weeklySchedule?.[day]?.mode || "open",
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes,
        },
      },
    }));
  };

  const updateScheduleAttendance = (day: WeekdayKey, classAttendance: "always" | "optional") => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: "class" as const,
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance,
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  const updateScheduleClass = (day: WeekdayKey, classDescription: string) => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: "class" as const,
          classDescription,
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  const createNewSession = async () => {
    // Generate unique name with count
    const todayStr = new Date().toLocaleDateString();
    const existingToday = sessions.filter(s => s.title.startsWith(`Program ${todayStr}`)).length;
    const uniqueTitle = existingToday > 0
      ? `Program ${todayStr} #${existingToday + 1}`
      : `Program ${todayStr}`;

    const newSession: Omit<AIProgrammingSession, "id"> = {
      userId,
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
    if (!confirm("Are you sure you want to remove all workouts from this program from your calendar? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Query workouts by aiSessionId to only delete workouts from THIS session
      const workoutsQuery = query(
        collection(db, "personalWorkouts"),
        where("userId", "==", userId),
        where("aiSessionId", "==", sessionId)
      );
      const snapshot = await getDocs(workoutsQuery);

      // Delete all workouts from this session
      let deletedCount = 0;
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, "personalWorkouts", docSnap.id));
        deletedCount++;
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
      alert(`Removed ${deletedCount} workouts from your calendar.`);
    } catch (err) {
      console.error("Error deleting workouts:", err);
      setError("Failed to delete workouts");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this program? If published, workouts will also be removed from your calendar.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const session = sessions.find(s => s.id === sessionId);

      // If session was published, delete the workouts first
      if (session?.status === "published") {
        // Query workouts by aiSessionId to only delete workouts from THIS session
        const workoutsQuery = query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId),
          where("aiSessionId", "==", sessionId)
        );
        const snapshot = await getDocs(workoutsQuery);

        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, "personalWorkouts", docSnap.id));
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
      // Build conversation history for context
      const conversationHistory = updatedMessages.map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      ).join("\n\n");

      const prompt = `${getSystemPrompt(preferences, recentlyUsedWorkouts)}\n${athleteBlock}\nConversation so far:\n${conversationHistory}\n\nRespond to the user's latest message. Remember to output valid JSON only.`;

      // Call xAI/Grok API (fast model with automatic fallback)
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are an expert CrossFit programming coach. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      });

      if (!text) {
        throw new Error("No response from AI");
      }

      // Parse the JSON response
      let parsedResponse: { message: string; workouts: AIGeneratedDay[] };
      try {
        const parsed = JSON.parse(cleanJsonText(text));

        // Long-range program: the AI returned a week-by-week outline.
        // Generate the actual days one week at a time so nothing gets cut short.
        if (parsed.outline && Array.isArray(parsed.outline.weeks) && parsed.outline.weeks.length > 0) {
          await generateFullProgram(
            activeSession.id,
            parsed.message || "Here's your training plan.",
            parsed.outline as ProgramOutline,
            conversationHistory,
            updatedMessages
          );
          return;
        }

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
        messages: stripOldWorkouts(finalMessages),
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
      setError(err instanceof Error ? err.message : "Failed to get AI response.");
    } finally {
      setIsLoading(false);
    }
  };

  // Build the prompt that generates one specific week of a long-range plan
  const buildWeekPrompt = (
    outline: ProgramOutline,
    week: ProgramOutlineWeek,
    conversationHistory: string,
    previousDays: AIGeneratedDay[]
  ): string => {
    const skillNames = getPresetSkillNames();
    const liftNames = getPresetLiftNames();

    const usedWodTitles = new Set<string>(recentlyUsedWorkouts);
    previousDays.forEach(day => day.components?.forEach(c => {
      if (c.type === "wod" && c.title) usedWodTitles.add(c.title);
    }));

    const outlineSummary = outline.weeks
      .map(w => `Week ${w.weekNumber} (starting ${w.startDate}): ${w.focus}${w.details ? ` - ${w.details}` : ""}`)
      .join("\n");

    const lastDays = previousDays.slice(-7)
      .map(d => `${d.date} (${d.dayOfWeek}): ${d.isRestDay ? "REST" : d.components?.map(c => c.title).join(", ")}`)
      .join("\n");

    return `You are a personal CrossFit + endurance coach generating ONE WEEK of daily workouts inside a longer training plan for an athlete in their garage/home gym.
${buildPreferencesSection(preferences)}${athleteBlock}
THE ATHLETE'S REQUEST AND CONTEXT (conversation so far):
${conversationHistory}

FULL PLAN OUTLINE (runs ${outline.startDate} to ${outline.endDate}):
${outlineSummary}

YOU ARE NOW GENERATING WEEK ${week.weekNumber}, which starts on ${week.startDate}.
Focus for this week: ${week.focus}
${week.details ? `Details: ${week.details}` : ""}
${lastDays ? `\nDAYS ALREADY PROGRAMMED JUST BEFORE THIS WEEK (for continuity):\n${lastDays}` : ""}

Respond with valid JSON in this exact format:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": "Monday",
      "isRestDay": false,
      "components": [
        { "type": "wod", "title": "...", "description": "...", "scoringType": "fortime", "notes": "..." }
      ]
    }
  ]
}

RULES:
- Cover EVERY calendar day of this week starting ${week.startDate} (7 consecutive days, or fewer if the plan's end date ${outline.endDate} falls within this week). Use correct real dates and matching day names.
- Rest days: set isRestDay to true with components [] (or one light "cooldown" mobility component if the plan calls for active recovery).
- EVERY day gets ONE definitive prescription: a workout, a class, or rest. NEVER write "optional" sessions or attend-or-skip choices - decide for the athlete.
- "skill" components are ONLY low-fatigue technique work (progressions, drills). Conditioning EMOMs/AMRAPs are "wod" even when built around one movement.
- Train the athlete's stated weaknesses 1-2x per week with varied approaches - never the same movement in every session.
- Class-day components: use the most fitting type (usually "lift" for a lifting class) and omit scoringType.
- Days with an external class (e.g., Olympic lifting class at their gym): ONE component describing the class with brief notes - do not program extra work unless the plan says so.
- Running sessions: use a "wod" component with the run as the description (distance, pace guidance, structure).
- Component types: "warmup", "lift", "wod", "skill", "cooldown". WOD scoringType: "fortime", "amrap", "emom".
- For prescribed SKILL components use only these names: ${skillNames.join(", ")}
- For prescribed LIFT components use only these names (class-day components are exempt): ${liftNames.join(", ")}
- DO NOT reuse these WOD names: ${Array.from(usedWodTitles).slice(-80).join(", ") || "none yet"}
- Keep notes concise: under 60 words per component (stimulus, scaling, intent).
- Only program equipment the athlete actually has.
- Respond with pure JSON only - no markdown fences, no extra text.`;
  };

  // Generate a multi-week program: one API call per week, assembled into a single plan
  const generateFullProgram = async (
    sessionId: string,
    planMessage: string,
    outline: ProgramOutline,
    conversationHistory: string,
    updatedMessages: AIChatMessage[]
  ) => {
    const weeks = (outline.weeks || []).slice(0, 20);
    const allDays: AIGeneratedDay[] = [];
    const failedWeeks: number[] = [];

    for (let i = 0; i < weeks.length; i++) {
      setGenerationProgress({ current: i + 1, total: weeks.length });

      let days: AIGeneratedDay[] | null = null;
      for (let attempt = 0; attempt < 2 && !days; attempt++) {
        try {
          const text = await chatCompletion({
            messages: [
              { role: "system", content: "You are an expert CrossFit and endurance programming coach. Always respond with valid JSON only." },
              { role: "user", content: buildWeekPrompt(outline, weeks[i], conversationHistory, allDays) }
            ],
            temperature: 0.6,
          });
          const parsed = JSON.parse(cleanJsonText(text));
          const arr = Array.isArray(parsed) ? parsed : (parsed.days || parsed.workouts);
          if (Array.isArray(arr) && arr.length > 0) {
            days = arr as AIGeneratedDay[];
          }
        } catch (err) {
          console.error(`Error generating week ${weeks[i].weekNumber} (attempt ${attempt + 1}):`, err);
        }
      }

      if (days) {
        allDays.push(...days);
      } else {
        failedWeeks.push(weeks[i].weekNumber);
      }
    }

    setGenerationProgress(null);

    let finalText = `${planMessage}\n\nI built out ${allDays.length} days of programming across ${weeks.length} weeks. Hit "Preview & Publish" to review the full plan and add it to your calendar.`;
    if (outline.weeks.length > 20) {
      finalText += `\n\n(I capped this at the first 20 weeks - ask me to continue from week 21 when you get there.)`;
    }
    if (failedWeeks.length > 0) {
      finalText += `\n\n(Heads up: week${failedWeeks.length > 1 ? "s" : ""} ${failedWeeks.join(", ")} failed to generate - ask me to fill ${failedWeeks.length > 1 ? "them" : "it"} in.)`;
    }

    const assistantMessage: AIChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: finalText,
      timestamp: Timestamp.now(),
    };
    if (allDays.length > 0) {
      assistantMessage.generatedWorkouts = allDays;
    }

    const finalMessages = [...updatedMessages, assistantMessage];

    await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
      messages: stripOldWorkouts(finalMessages),
      programWeeks: weeks.length,
      updatedAt: Timestamp.now(),
    });

    setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
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
    if (!activeSession) return;

    const workouts = getAllGeneratedWorkouts();
    if (workouts.length === 0) return;

    if (!userId) {
      setError("Missing user information");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      // Replace any AI-planned workouts already sitting on the dates being published
      // (covers regenerating a day/week and re-publishing a program without duplicates)
      const targetDates = new Set<string>();
      workouts.forEach(day => {
        if (day.date && day.date.includes("-")) targetDates.add(day.date);
      });
      if (targetDates.size > 0) {
        const existingSnap = await getDocs(query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId)
        ));
        const toDelete = existingSnap.docs.filter(d => {
          const x = d.data();
          const ds = x.dateString || x.date?.toDate?.()?.toISOString?.().split("T")[0];
          return x.aiSessionId && ds && targetDates.has(ds);
        });
        let delBatch = writeBatch(db);
        let delPending = 0;
        for (const d of toDelete) {
          delBatch.delete(d.ref);
          delPending++;
          if (delPending >= 400) {
            await delBatch.commit();
            delBatch = writeBatch(db);
            delPending = 0;
          }
        }
        if (delPending > 0) {
          await delBatch.commit();
        }
      }

      // Write in batches so long programs (60-90+ days) publish in seconds
      let batch = writeBatch(db);
      let pending = 0;

      // Create a personal workout for each day
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

        // Build workout date - parse as local time to avoid timezone issues
        // When parsing "YYYY-MM-DD", JavaScript treats it as UTC which can shift the day
        // So we parse the components manually to ensure local time
        let workoutDate: Date;
        let dateString: string | null = null;
        if (day.date && day.date.includes('-')) {
          const [year, month, dayNum] = day.date.split('-').map(Number);
          workoutDate = new Date(year, month - 1, dayNum, 12, 0, 0); // noon local time
          dateString = day.date;
        } else {
          workoutDate = new Date(day.date);
        }
        if (isNaN(workoutDate.getTime())) continue; // Skip invalid dates

        // Create the workout on the athlete's personal calendar
        const workoutRef = doc(collection(db, "personalWorkouts"));
        batch.set(workoutRef, {
          userId: String(userId),
          date: Timestamp.fromDate(workoutDate),
          ...(dateString ? { dateString } : {}),
          components: cleanComponents,
          createdAt: serverTimestamp(),
          aiSessionId: activeSession.id, // Track which AI programming session created this workout
        });
        pending++;
        if (pending >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          pending = 0;
        }
      }

      if (pending > 0) {
        await batch.commit();
      }

      // Update session status
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), {
        status: "published",
        updatedAt: Timestamp.now(),
      });

      setActiveSession(prev => prev ? { ...prev, status: "published" } : null);
      setShowPreview(false);
      onPublish?.();
      alert("Programming added to your calendar!");
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
        <AITrainerPaywall userEmail={userEmail} />
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
              <h2 className="text-lg font-semibold text-white">Your AI Coach</h2>
              <p className="text-white/80 text-sm">Programming built for your garage gym</p>
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ask Your Coach for Programming</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                  Tell your AI coach about your goals, equipment, and schedule. For example:
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>&quot;Program my next week - I have a barbell, rings, and a rower&quot;</p>
                  <p>&quot;Program every day until my marathon on October 25 - I also have a comp on the 7th&quot;</p>
                  <p>&quot;I can train 4 days a week, 45 minutes max, build me a plan&quot;</p>
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
                              {(day.dayOfWeek || "").slice(0, 3)}
                            </div>
                          ))}
                        </div>
                        {message.generatedWorkouts.length > 14 && (
                          <p className="text-xs text-gray-500 mt-2">
                            + {message.generatedWorkouts.length - 14} more days - open Preview to see the full plan
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {generationProgress ? (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Building week {generationProgress.current} of {generationProgress.total}...
                        </p>
                        <p className="text-xs text-gray-400">Long programs are written one week at a time - hang tight</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  )}
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
                  This program has been added to your calendar.
                </p>
                <button
                  onClick={() => deletePublishedWorkouts(activeSession.id)}
                  disabled={isDeleting}
                  className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Removing..." : "Unpublish & Remove Workouts"}
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
            Ask your AI coach to build your next training block
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
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={publishToCalendar}
                  disabled={isPublishing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? "Adding..." : `Add ${generatedWorkouts.filter(d => !d.isRestDay).length} Workouts to My Calendar`}
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
              <p className="text-white/80 text-sm">Tell your coach about your setup and how you like to train</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Training Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What are you training for?
                </label>
                <p className="text-xs text-gray-500 mb-2">Add races and competitions - the AI builds phases and tapers around them and puts event day on your calendar</p>
                <div className="space-y-2">
                  {(preferences.events || []).map((ev) => (
                    <div key={ev.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={ev.type}
                          onChange={(e) => updateEvent(ev.id, "type", e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="running_race">🏃 Running race</option>
                          <option value="crossfit_comp">🏋️ CrossFit competition</option>
                          <option value="other">🎯 Other event</option>
                        </select>
                        <input
                          type="date"
                          value={ev.date}
                          onChange={(e) => updateEvent(ev.id, "date", e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        />
                        <button
                          onClick={() => removeEvent(ev.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove event"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ev.name}
                          onChange={(e) => updateEvent(ev.id, "name", e.target.value)}
                          placeholder={ev.type === "running_race" ? "Race name (optional)" : "Event name (optional)"}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        />
                        {ev.type === "running_race" ? (
                          <select
                            value={ev.detail || "Marathon"}
                            onChange={(e) => updateEvent(ev.id, "detail", e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          >
                            {RACE_DISTANCES.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={ev.detail || ""}
                            onChange={(e) => updateEvent(ev.id, "detail", e.target.value)}
                            placeholder="Details (optional)"
                            className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          />
                        )}
                      </div>
                      {ev.date && (
                        <p className="text-xs text-purple-600">
                          {(() => {
                            const days = Math.ceil((new Date(ev.date + "T12:00:00").getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                            if (days < 0) return "This event has passed";
                            if (days === 0) return "Today!";
                            return `${days} days away (${Math.floor(days / 7)} weeks)`;
                          })()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEvent}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  + Add race or competition
                </button>
              </div>

              {/* Weekly Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Weekly Schedule
                </label>
                <p className="text-xs text-gray-500 mb-2">Train = available to train (not required). Lock in class days, rest days, and optional time limits - the AI respects these in every week it writes</p>
                <div className="space-y-1.5">
                  {WEEKDAYS.map(({ key, label }) => {
                    const setting = preferences.weeklySchedule?.[key] || { mode: "open" as const };
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-10 text-sm font-medium text-gray-600 shrink-0">{label}</span>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shrink-0">
                          {([
                            { mode: "open" as const, text: "Train" },
                            { mode: "class" as const, text: "Class" },
                            { mode: "rest" as const, text: "Rest" },
                          ]).map(({ mode, text }) => (
                            <button
                              key={mode}
                              onClick={() => updateScheduleDay(key, mode)}
                              className={`px-2.5 py-1 font-medium transition-colors ${
                                setting.mode === mode
                                  ? mode === "rest"
                                    ? "bg-gray-600 text-white"
                                    : mode === "class"
                                    ? "bg-blue-600 text-white"
                                    : "bg-purple-600 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                        {setting.mode === "class" && (
                          <>
                            <input
                              type="text"
                              value={setting.classDescription || ""}
                              onChange={(e) => updateScheduleClass(key, e.target.value)}
                              placeholder="e.g., Oly class - snatch + back squat"
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                            />
                            <select
                              value={setting.classAttendance || "always"}
                              onChange={(e) => updateScheduleAttendance(key, e.target.value as "always" | "optional")}
                              title="Attend every week, or let the AI decide when it fits the plan"
                              className="px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white shrink-0"
                            >
                              <option value="always">Every week</option>
                              <option value="optional">AI decides</option>
                            </select>
                          </>
                        )}
                        {(setting.mode === "open" || (setting.mode === "class" && (setting.classAttendance || "always") === "optional")) && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={240}
                              value={setting.maxMinutes || ""}
                              onChange={(e) => updateScheduleMinutes(key, parseInt(e.target.value) || 0)}
                              placeholder="—"
                              title="Max session length in minutes (optional)"
                              className="w-14 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                            />
                            <span className="text-xs text-gray-400">min max</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rest days per week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Rest Days Each Week
                </label>
                <select
                  value={preferences.restDaysPerWeek || 0}
                  onChange={(e) => setPreferences(prev => ({ ...prev, restDaysPerWeek: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={0}>Let the AI decide (1-2 per week)</option>
                  <option value={1}>1 per week</option>
                  <option value={2}>2 per week</option>
                  <option value={3}>3 per week</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Days you marked Rest above count toward this; the AI places any extras on the smartest days</p>
              </div>

              {/* Long Run Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Long Run Day
                </label>
                <select
                  value={preferences.longRunDay || ""}
                  onChange={(e) => setPreferences(prev => ({ ...prev, longRunDay: e.target.value as AIProgrammingPreferences["longRunDay"] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Let the AI decide</option>
                  {WEEKDAYS.map(d => (
                    <option key={d.key} value={d.key}>{d.full}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Used when you&apos;re training for a running race - the weekly long run always lands here</p>
              </div>

              {/* Training Philosophy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Philosophy & Goals
                </label>
                <textarea
                  value={preferences.philosophy}
                  onChange={(e) => setPreferences(prev => ({ ...prev, philosophy: e.target.value }))}
                  placeholder="e.g., I want to build strength while keeping conditioning. Training for a local competition in the fall. Prefer quality over volume..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Equipment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Garage Gym Equipment
                </label>
                <textarea
                  value={preferences.equipment}
                  onChange={(e) => setPreferences(prev => ({ ...prev, equipment: e.target.value }))}
                  placeholder="e.g., Barbell + 300lb plates, squat rack, pull-up bar, one 53lb kettlebell, jump rope, rower. No dumbbells, no rings..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">The AI will only program movements you can actually do</p>
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
    </div>
  );
}
