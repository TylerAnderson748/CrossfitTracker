import { Timestamp } from "firebase/firestore";

// User roles (legacy roles may still exist on old user docs)
export type UserRole = "athlete" | "member" | "coach" | "owner" | "superAdmin";
export type Gender = "Male" | "Female";

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  gender?: Gender;
  createdAt: Timestamp;
  hideFromLeaderboards: boolean;
  // Set once the first-run welcome tour has been completed or dismissed
  onboardedAt?: Timestamp;
  // Oddo subscription (personalized scaling, advice, and programming)
  aiTrainerSubscription?: AITrainerSubscription;
  // Oddo preferences and goals
  aiCoachPreferences?: AICoachPreferences;
}

// Oddo user preferences
export interface AICoachPreferences {
  goals?: string; // User's fitness goals (free text)
  injuries?: string; // Current injuries or limitations
  experienceLevel?: "beginner" | "intermediate" | "advanced" | "competitor";
  focusAreas?: string[]; // e.g., ["strength", "cardio", "gymnastics", "olympic lifting"]
  updatedAt?: Timestamp;
}

// AI Trainer Subscription types
export type AISubscriptionTier = "free" | "pro" | "elite";

export interface AITrainerSubscription {
  tier: AISubscriptionTier;
  status: "active" | "canceled" | "past_due" | "trialing";
  startDate?: Timestamp;
  endDate?: Timestamp;
  trialEndsAt?: Timestamp;
  scheduledEndDate?: Timestamp;  // When subscription is scheduled to end (cancelled but still active)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// Stored account for multi-account switching
export interface StoredAccount {
  id: string;
  email: string;
  displayName?: string;
  password: string; // Stored for quick switching
}

// Workout types
export type WorkoutResultType = "time" | "rounds" | "weight" | "reps" | "other";

// WOD Scoring Types
export type WODScoringType = "fortime" | "emom" | "amrap";

export const wodScoringTypeLabels: Record<WODScoringType, string> = {
  fortime: "For Time",
  emom: "EMOM",
  amrap: "AMRAP",
};

// Guess a WOD's scoring type from its text when none was set explicitly
// (e.g. AI-generated plan components) so the logger offers the right
// score entry (rounds+reps for AMRAP, completion for EMOM, time otherwise)
export function inferScoringType(text: string): WODScoringType {
  const t = text.toLowerCase();
  if (/\bamrap\b|as many (rounds|reps)/.test(t)) return "amrap";
  if (/\be\d*mom\b|every (minute|\d+\s*(?:min|minutes|seconds|sec))/.test(t)) return "emom";
  return "fortime";
}

export const wodScoringTypeColors: Record<WODScoringType, { bg: string; text: string }> = {
  fortime: { bg: "bg-blue-500", text: "text-white" },
  emom: { bg: "bg-orange-500", text: "text-white" },
  amrap: { bg: "bg-green-500", text: "text-white" },
};

// Workout component types for programming
// ("cardio" is legacy - new programming uses the specific run/swim/bike types)
export type WorkoutComponentType =
  | "warmup" | "wod" | "lift" | "skill"
  | "run" | "swim" | "bike_mtb" | "bike_road" | "row"
  | "cardio" | "class" | "cooldown";

// The loggable cardio activities (miles + time)
export type CardioActivity = "run" | "swim" | "bike_mtb" | "bike_road" | "row";

export const cardioActivityLabels: Record<CardioActivity, string> = {
  run: "Run",
  swim: "Swim",
  bike_mtb: "MTB",
  bike_road: "Bike",
  row: "Row",
};

export const cardioActivityIcons: Record<CardioActivity, string> = {
  run: "🏃",
  swim: "🏊",
  bike_mtb: "🚵",
  bike_road: "🚴",
  row: "🚣",
};

// A logged cardio session (mileage and time for now)
export interface CardioLog {
  id: string;
  userId: string;
  activity: CardioActivity;
  miles: number;
  timeInSeconds: number;
  date: Timestamp;
  dateString?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: Timestamp;
}

// A logged class attendance ("I did it")
export interface ClassLog {
  id: string;
  userId: string;
  title: string; // e.g., "Olympic Lifting Class"
  date: Timestamp;
  dateString: string; // YYYY-MM-DD
  notes?: string;
  createdAt: Timestamp;
}

export interface WorkoutComponent {
  id: string;
  type: WorkoutComponentType;
  title: string;
  description: string;
  scoringType?: WODScoringType; // For WOD components: fortime, emom, amrap
  isPreset?: boolean; // True if this is a preset workout (locked fields)
  notes?: string; // Notes: stimulus, scaling options, intent, etc.
}

export const workoutComponentLabels: Record<WorkoutComponentType, string> = {
  warmup: "Warm Up",
  wod: "WOD",
  lift: "Lift",
  skill: "Skill Work",
  run: "Run",
  swim: "Swim",
  bike_mtb: "MTB",
  bike_road: "Bike",
  row: "Row",
  cardio: "Cardio",
  class: "Class",
  cooldown: "Cool Down",
};

export const workoutComponentColors: Record<WorkoutComponentType, { bg: string; text: string }> = {
  warmup: { bg: "bg-yellow-100", text: "text-yellow-700" },
  wod: { bg: "bg-orange-100", text: "text-orange-700" },
  lift: { bg: "bg-purple-100", text: "text-purple-700" },
  skill: { bg: "bg-green-100", text: "text-green-700" },
  run: { bg: "bg-red-100", text: "text-red-700" },
  swim: { bg: "bg-sky-100", text: "text-sky-700" },
  bike_mtb: { bg: "bg-lime-100", text: "text-lime-700" },
  bike_road: { bg: "bg-teal-100", text: "text-teal-700" },
  row: { bg: "bg-cyan-100", text: "text-cyan-700" },
  cardio: { bg: "bg-red-100", text: "text-red-700" },
  class: { bg: "bg-indigo-100", text: "text-indigo-700" },
  cooldown: { bg: "bg-blue-100", text: "text-blue-700" },
};

// Component types that log as a cardio session (with legacy "cardio" mapping to run)
export function cardioActivityForComponent(type: WorkoutComponentType, title?: string): CardioActivity | null {
  if (type === "run" || type === "swim" || type === "bike_mtb" || type === "bike_road" || type === "row") return type;
  if (type === "cardio" || (type === "wod" && title && /\b(run|jog|ruck)\b/i.test(title))) {
    if (title && /\bswim\b/i.test(title)) return "swim";
    if (title && /\brow(?:ing|er)?\b/i.test(title)) return "row";
    if (title && /\b(mtb|mountain)\b/i.test(title)) return "bike_mtb";
    if (title && /\b(bike|cycle|cycling)\b/i.test(title)) return "bike_road";
    return "run";
  }
  return null;
}

// WOD Categories
export type WODCategory = "RX" | "Scaled" | "Just For Fun";

// Category order for leaderboard (highest tier first)
export const categoryOrder: WODCategory[] = ["RX", "Scaled", "Just For Fun"];

export const categoryColors: Record<WODCategory, { bg: string; text: string; badge: string }> = {
  "RX": { bg: "bg-blue-500", text: "text-white", badge: "bg-blue-100 text-blue-700" },
  "Scaled": { bg: "bg-gray-500", text: "text-white", badge: "bg-gray-200 text-gray-700" },
  "Just For Fun": { bg: "bg-green-500", text: "text-white", badge: "bg-green-100 text-green-700" },
};

// A workout on the athlete's personal calendar (manual, scanned, or AI-generated)
// One saved lift-session log per workout day. Remembers which liftResults
// docs each component's log created, so re-opening the logger edits those
// entries in place instead of creating duplicates.
export interface SessionLiftLog {
  loggedAt: Timestamp;
  entries: Record<string, { liftResultId: string; weight: number; reps: number; isMax?: boolean }>;
}

export interface PersonalWorkout {
  id: string;
  userId: string;
  date: Timestamp;
  dateString?: string; // YYYY-MM-DD for reliable date comparison
  components: WorkoutComponent[];
  notes?: string;
  createdAt: Timestamp;
  // Set when this workout was published by an AI programming session
  aiSessionId?: string;
  // Set once the athlete logs their lifts for this day
  sessionLog?: SessionLiftLog;
  // Post-workout check-in ("how did it feel?") - Oddo uses this to tune
  // future programming and advice
  sessionFeedback?: {
    rating: "easy" | "right" | "hard";
    note?: string | null;
    at: Timestamp;
  };
}

export interface WorkoutLog {
  id: string;
  userId: string;
  wodTitle: string;
  wodDescription: string;
  workoutDate: Timestamp;
  completedDate: Timestamp;
  resultType: WorkoutResultType;
  timeInSeconds?: number;
  rounds?: number;
  reps?: number;
  weight?: number;
  notes: string;
  isPersonalRecord: boolean;
}

export interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  userGender?: Gender;
  workoutLogId: string;
  normalizedWorkoutName: string;
  originalWorkoutName: string;
  resultType: WorkoutResultType;
  timeInSeconds?: number;
  rounds?: number;
  reps?: number;
  weight?: number;
  category: WODCategory;
  completedDate: Timestamp;
  createdAt: Timestamp;
}

export interface LiftResult {
  id: string;
  userId: string;
  liftName: string;
  weight: number;
  reps: number;
  date: Timestamp;
  isPersonalRecord: boolean;
}

// Helper functions
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function normalizeWorkoutName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

export function formatResult(entry: LeaderboardEntry | WorkoutLog): string {
  if (entry.resultType === "time" && entry.timeInSeconds) {
    return formatTime(entry.timeInSeconds);
  }
  if (entry.resultType === "rounds" && entry.rounds) {
    return `${entry.rounds} rounds`;
  }
  if (entry.resultType === "reps" && entry.reps) {
    return `${entry.reps} reps`;
  }
  if (entry.resultType === "weight" && entry.weight) {
    return `${entry.weight} lbs`;
  }
  return "-";
}

export function getRelativeDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// =====================
// AI PROGRAMMING TYPES
// =====================

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp;
  // If assistant message contains generated workouts
  generatedWorkouts?: AIGeneratedDay[];
}

export interface AIProgrammingSession {
  id: string;
  userId: string;
  createdBy: string;
  title: string;
  status: "active" | "published" | "archived";
  messages: AIChatMessage[];
  // Generated program details
  programWeeks?: number;
  programStartDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AIGeneratedWorkout {
  type: WorkoutComponentType;
  title: string;
  description: string;
  scoringType?: WODScoringType;
  notes?: string; // Stimulus, scaling options, intent, etc.
}

export interface AIGeneratedDay {
  date: string; // ISO date string
  dayOfWeek: string;
  isRestDay: boolean;
  components: AIGeneratedWorkout[];
}

// A race or competition the athlete is training toward
export type TrainingEventType = "running_race" | "crossfit_comp" | "other";

export interface TrainingEvent {
  id: string;
  type: TrainingEventType;
  name: string;
  date: string; // YYYY-MM-DD
  detail?: string; // e.g., race distance ("Marathon", "5K") or notes
}

export type WeekdayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

// How a given weekday is handled every week
export interface ScheduleDaySetting {
  mode: "open" | "class" | "rest";
  classDescription?: string; // when mode === "class"
  classAttendance?: "always" | "optional"; // attend every week, or let the AI decide
  maxMinutes?: number; // optional time budget for training days (0 = no limit)
}

// What kind of programming the athlete wants
export type TrainingStyle = "crossfit" | "general";
// Where the athlete trains (drives equipment assumptions)
export type TrainingEnvironment = "home" | "commercial";

export interface AIProgrammingPreferences {
  userId: string;
  // CrossFit/mixed-modal vs conventional gym training (default crossfit)
  trainingStyle?: TrainingStyle;
  // Home/garage gym (equipment list is a hard constraint) vs commercial gym
  // with full standard equipment (default home)
  trainingEnvironment?: TrainingEnvironment;
  philosophy: string; // Free-form text describing the athlete's training philosophy
  equipment: string; // Available equipment (home) or notes about their gym (commercial)
  // Races/competitions the plan should build toward
  events?: TrainingEvent[];
  // Fixed weekly structure (class days, rest days)
  weeklySchedule?: Partial<Record<WeekdayKey, ScheduleDaySetting>>;
  // Which day the weekly long run lands on (empty = AI decides); used for running races
  longRunDay?: WeekdayKey | "";
  // Full rest days per week (0 = AI decides, defaults to 1-2)
  restDaysPerWeek?: number;
  workoutDuration: "short" | "medium" | "long" | "varied"; // Preferred workout length
  benchmarkFrequency: "often" | "sometimes" | "rarely"; // How often to program benchmarks
  programmingStyle: string; // e.g., "Mayhem", "CompTrain", "HWPO", "Custom"
  additionalRules: string; // Any other rules or preferences
  updatedAt: Timestamp;
}

// =====================
// TRAINING PLAN TABLE
// =====================

// A typed sub-component of a plan day (used by imported plans)
export interface PlanRowComponent {
  type: WorkoutComponentType;
  title: string;
  description: string;
}

// One row of the day-by-day training plan table
export interface PlanRow {
  date: string;        // YYYY-MM-DD
  day: string;         // "Monday"
  week: number;        // 1-based week number
  phase: string;       // e.g., "Base", "Build", "Comp Taper", "Marathon Taper"
  session: string;     // short label, e.g., "Run + CrossFit", "Oly Class", "Rest", "MARATHON"
  detail: string;      // the complete prescription for the day
  runMiles?: number;   // planned run miles (0 = none)
  targetRPE?: string;  // e.g., "3-7"
  estMinutes?: number; // estimated total session minutes
  reason?: string;     // why this day is programmed this way
  components?: PlanRowComponent[]; // typed components (imported plans)
}

// The full plan document (one per AI programming session, doc id = session id)
export interface TrainingPlan {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  status: "draft" | "locked";
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  rows: PlanRow[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =========================
// PRICING
// =========================

export const PRICING = {
  // FREE tier = tracking only
  // Base Oddo: advice, scaling, workout scan, cardio/class logging
  AI_COACH_MONTHLY: 9.99,
  AI_COACH_YEARLY: 79.99,
  // Oddo + Programming: adds the AI plan builder (day-by-day training plans)
  AI_PROGRAMMING_MONTHLY: 19.99,
  AI_PROGRAMMING_YEARLY: 159.99,
} as const;

/// Subscription tier semantics:
//   "pro"   = base Oddo (advice, scaling, scan, logging, baseline tests)
//   "elite" = Oddo + Programming (adds the AI plan builder)
// Trials carry the tier chosen at signup - a coach-only trial does NOT
// unlock the plan builder.
export function hasActiveAICoach(sub?: AITrainerSubscription): boolean {
  return sub?.status === "active" || sub?.status === "trialing";
}

export function hasAIProgramming(sub?: AITrainerSubscription): boolean {
  if (!sub) return false;
  return (sub.status === "active" || sub.status === "trialing") && sub.tier === "elite";
}

// =========================
// AI COACH SUGGESTION CACHE
// =========================

export type AISuggestionType = "today" | "tomorrow" | "week";

export interface AICoachSuggestion {
  id: string;
  type: AISuggestionType;
  content: string;
  generatedAt: Timestamp;
  // Date the suggestion is for (e.g., 2024-01-15 for "today" suggestion generated on that date)
  targetDate: string; // ISO date string YYYY-MM-DD
  // For week suggestions, this is the start of the week (Sunday)
  weekStartDate?: string;
}
