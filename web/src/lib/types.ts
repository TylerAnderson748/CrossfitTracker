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
  // AI Coach subscription (personalized scaling, advice, and programming)
  aiTrainerSubscription?: AITrainerSubscription;
  // AI Coach preferences and goals
  aiCoachPreferences?: AICoachPreferences;
}

// AI Coach user preferences
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

export const wodScoringTypeColors: Record<WODScoringType, { bg: string; text: string }> = {
  fortime: { bg: "bg-blue-500", text: "text-white" },
  emom: { bg: "bg-orange-500", text: "text-white" },
  amrap: { bg: "bg-green-500", text: "text-white" },
};

// Workout component types for programming
export type WorkoutComponentType = "warmup" | "wod" | "lift" | "skill" | "cooldown";

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
  cooldown: "Cool Down",
};

export const workoutComponentColors: Record<WorkoutComponentType, { bg: string; text: string }> = {
  warmup: { bg: "bg-yellow-100", text: "text-yellow-700" },
  wod: { bg: "bg-orange-100", text: "text-orange-700" },
  lift: { bg: "bg-purple-100", text: "text-purple-700" },
  skill: { bg: "bg-green-100", text: "text-green-700" },
  cooldown: { bg: "bg-blue-100", text: "text-blue-700" },
};

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

export interface AIProgrammingPreferences {
  userId: string;
  philosophy: string; // Free-form text describing the athlete's training philosophy
  equipment: string; // Available equipment in the athlete's garage/home gym
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
  // Individual pricing (FREE tier = tracking only)
  INDIVIDUAL_AI_COACH: 9.99, // $9.99/mo personal AI Coach (advice + programming)
} as const;

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
