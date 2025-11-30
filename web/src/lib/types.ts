import { Timestamp } from "firebase/firestore";

// User roles
export type UserRole = "athlete" | "coach" | "owner" | "superAdmin";
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
  gymId?: string;
  createdAt: Timestamp;
  hideFromLeaderboards: boolean;
}

// Workout types
export type WorkoutType = "lift" | "wod";
export type WorkoutResultType = "time" | "rounds" | "weight" | "reps" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

// Workout component types for programming
export type WorkoutComponentType = "warmup" | "wod" | "lift" | "skill" | "cooldown";

export interface WorkoutComponent {
  id: string;
  type: WorkoutComponentType;
  title: string;
  description: string;
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

// Standard CrossFit Benchmark Workouts - always available as suggestions
export interface BenchmarkWorkout {
  title: string;
  description: string;
  category: "girls" | "heroes" | "open" | "other";
}

export const BENCHMARK_WODS: BenchmarkWorkout[] = [
  // The Girls
  { title: "Fran", description: "21-15-9 Thrusters (95/65) and Pull-ups", category: "girls" },
  { title: "Grace", description: "30 Clean and Jerks for time (135/95)", category: "girls" },
  { title: "Helen", description: "3 RFT: 400m Run, 21 KB Swings (53/35), 12 Pull-ups", category: "girls" },
  { title: "Diane", description: "21-15-9 Deadlifts (225/155) and HSPU", category: "girls" },
  { title: "Elizabeth", description: "21-15-9 Cleans (135/95) and Ring Dips", category: "girls" },
  { title: "Nancy", description: "5 RFT: 400m Run, 15 OHS (95/65)", category: "girls" },
  { title: "Annie", description: "50-40-30-20-10 Double-unders and Sit-ups", category: "girls" },
  { title: "Jackie", description: "1000m Row, 50 Thrusters (45/35), 30 Pull-ups", category: "girls" },
  { title: "Karen", description: "150 Wall Balls for time (20/14)", category: "girls" },
  { title: "Mary", description: "AMRAP 20: 5 HSPU, 10 Pistols, 15 Pull-ups", category: "girls" },
  { title: "Chelsea", description: "EMOM 30: 5 Pull-ups, 10 Push-ups, 15 Squats", category: "girls" },
  { title: "Cindy", description: "AMRAP 20: 5 Pull-ups, 10 Push-ups, 15 Squats", category: "girls" },
  { title: "Barbara", description: "5 RFT: 20 Pull-ups, 30 Push-ups, 40 Sit-ups, 50 Squats (3 min rest)", category: "girls" },
  { title: "Angie", description: "100 Pull-ups, 100 Push-ups, 100 Sit-ups, 100 Squats for time", category: "girls" },
  { title: "Eva", description: "5 RFT: 800m Run, 30 KB Swings (70/53), 30 Pull-ups", category: "girls" },
  { title: "Kelly", description: "5 RFT: 400m Run, 30 Box Jumps (24/20), 30 Wall Balls (20/14)", category: "girls" },
  { title: "Lynne", description: "5 RFT: Max Bench Press (BW), Max Pull-ups", category: "girls" },
  { title: "Nicole", description: "AMRAP 20: 400m Run, Max Pull-ups", category: "girls" },
  { title: "Amanda", description: "9-7-5 Muscle-ups and Squat Snatches (135/95)", category: "girls" },
  { title: "Isabel", description: "30 Snatches for time (135/95)", category: "girls" },
  { title: "Gwen", description: "Clean and Jerk 15-12-9 (touch and go)", category: "girls" },

  // Hero WODs
  { title: "Murph", description: "1 Mile Run, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 Mile Run (20/14 vest)", category: "heroes" },
  { title: "DT", description: "5 RFT: 12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks (155/105)", category: "heroes" },
  { title: "JT", description: "21-15-9 HSPU, Ring Dips, Push-ups", category: "heroes" },
  { title: "Michael", description: "3 RFT: 800m Run, 50 Back Extensions, 50 Sit-ups", category: "heroes" },
  { title: "Daniel", description: "50 Pull-ups, 400m Run, 21 Thrusters (95/65), 800m Run, 21 Thrusters, 400m Run, 50 Pull-ups", category: "heroes" },
  { title: "Nate", description: "AMRAP 20: 2 Muscle-ups, 4 HSPU, 8 KB Swings (70/53)", category: "heroes" },
  { title: "Randy", description: "75 Power Snatches for time (75/55)", category: "heroes" },
  { title: "Tommy V", description: "21-15-9 Thrusters (115/75) and Rope Climbs", category: "heroes" },
  { title: "Filthy Fifty", description: "50 each: Box Jumps, Jumping Pull-ups, KB Swings, Walking Lunges, K2E, Push Press, Back Extensions, Wall Balls, Burpees, Double-unders", category: "heroes" },
  { title: "The Seven", description: "7 RFT: 7 HSPU, 7 Thrusters (135/95), 7 K2E, 7 Deadlifts (245/165), 7 Burpees, 7 KB Swings (70/53), 7 Pull-ups", category: "heroes" },
  { title: "Lumberjack 20", description: "20 Deadlifts (275/185), 400m Run, 20 KB Swings (70/53), 400m Run, 20 OHS (115/75), 400m Run, 20 Burpees, 400m Run, 20 Pull-ups (Chest-to-bar), 400m Run, 20 Box Jumps (24/20), 400m Run, 20 DB Squat Cleans (45/30), 400m Run", category: "heroes" },

  // Open Workouts / Games Workouts
  { title: "Open 23.1", description: "AMRAP 14: 60 Cal Row, 50 T2B, 40 Wall Balls (20/14), 30 Power Cleans (135/95), 20 Muscle-ups", category: "open" },
  { title: "Open 24.1", description: "AMRAP 15: 21-15-9-15-21 Cal Row and Lateral Burpees over Rower", category: "open" },

  // Other Common WODs
  { title: "Fight Gone Bad", description: "3 RFT: 1 min each Wall Balls, SDLHP, Box Jumps, Push Press, Row (1 min rest)", category: "other" },
  { title: "Tabata Something Else", description: "Tabata (8x :20/:10): Pull-ups, Push-ups, Sit-ups, Squats", category: "other" },
  { title: "Death by Pull-ups", description: "EMOM: 1 Pull-up min 1, 2 min 2, etc. until failure", category: "other" },
  { title: "Death by Burpees", description: "EMOM: 1 Burpee min 1, 2 min 2, etc. until failure", category: "other" },
  { title: "Baseline", description: "500m Row, 40 Squats, 30 Sit-ups, 20 Push-ups, 10 Pull-ups", category: "other" },
];

// Standard Lifts - always available as suggestions
export interface StandardLift {
  title: string;
  description: string;
  category: "olympic" | "powerlifting" | "accessory";
}

export const STANDARD_LIFTS: StandardLift[] = [
  // Olympic Lifts
  { title: "Snatch", description: "Full squat snatch", category: "olympic" },
  { title: "Power Snatch", description: "Power snatch (no squat)", category: "olympic" },
  { title: "Hang Snatch", description: "Snatch from hang position", category: "olympic" },
  { title: "Clean", description: "Full squat clean", category: "olympic" },
  { title: "Power Clean", description: "Power clean (no squat)", category: "olympic" },
  { title: "Hang Clean", description: "Clean from hang position", category: "olympic" },
  { title: "Clean and Jerk", description: "Full clean and jerk", category: "olympic" },
  { title: "Jerk", description: "Split or push jerk", category: "olympic" },
  { title: "Push Jerk", description: "Push jerk from shoulders", category: "olympic" },
  { title: "Split Jerk", description: "Split jerk from shoulders", category: "olympic" },
  { title: "Squat Clean", description: "Full squat clean", category: "olympic" },
  { title: "Squat Snatch", description: "Full squat snatch", category: "olympic" },

  // Powerlifting
  { title: "Back Squat", description: "Barbell back squat", category: "powerlifting" },
  { title: "Front Squat", description: "Barbell front squat", category: "powerlifting" },
  { title: "Deadlift", description: "Conventional deadlift", category: "powerlifting" },
  { title: "Sumo Deadlift", description: "Sumo stance deadlift", category: "powerlifting" },
  { title: "Bench Press", description: "Flat bench press", category: "powerlifting" },
  { title: "Strict Press", description: "Standing strict press", category: "powerlifting" },
  { title: "Push Press", description: "Push press with leg drive", category: "powerlifting" },
  { title: "Overhead Squat", description: "Squat with barbell overhead", category: "powerlifting" },

  // Accessory
  { title: "Romanian Deadlift", description: "RDL for hamstrings", category: "accessory" },
  { title: "Good Morning", description: "Barbell good morning", category: "accessory" },
  { title: "Hip Thrust", description: "Barbell hip thrust", category: "accessory" },
  { title: "Thruster", description: "Front squat to push press", category: "accessory" },
  { title: "Cluster", description: "Squat clean to thruster", category: "accessory" },
  { title: "Hang Power Snatch", description: "Power snatch from hang", category: "accessory" },
  { title: "Hang Power Clean", description: "Power clean from hang", category: "accessory" },
];

// Combined list for easy access
export const ALL_BENCHMARK_WORKOUTS = [
  ...BENCHMARK_WODS.map(w => ({ title: w.title, description: w.description })),
  ...STANDARD_LIFTS.map(l => ({ title: l.title, description: l.description })),
];

// WOD Categories
export type WODCategory = "RX" | "Scaled" | "Just For Fun";

// Category order for leaderboard (highest tier first)
export const categoryOrder: WODCategory[] = ["RX", "Scaled", "Just For Fun"];

export const categoryColors: Record<WODCategory, { bg: string; text: string; badge: string }> = {
  "RX": { bg: "bg-blue-500", text: "text-white", badge: "bg-blue-100 text-blue-700" },
  "Scaled": { bg: "bg-gray-500", text: "text-white", badge: "bg-gray-200 text-gray-700" },
  "Just For Fun": { bg: "bg-green-500", text: "text-white", badge: "bg-green-100 text-green-700" },
};

export interface ScheduledWorkout {
  id: string;
  wodTitle: string;
  wodDescription: string;
  date: Timestamp;
  workoutType: WorkoutType;
  groupIds: string[];
  createdBy: string;
  recurrenceType: RecurrenceType;
  hideDetails?: boolean;
  revealDate?: Timestamp;
  // Multi-component support
  components?: WorkoutComponent[];
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
  gymName?: string;
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

export interface Gym {
  id: string;
  name: string;
  ownerId: string;
  coachIds: string[];
  memberIds: string[];
  createdAt: Timestamp;
}

// Group types
export type GroupType = "default" | "custom" | "personal";
export type MembershipType = "auto-assign-all" | "invite-only";

export interface TimeSlot {
  id: string;
  hour: number;
  minute: number;
  capacity: number;
}

export interface WorkoutGroup {
  id: string;
  name: string;
  type: GroupType;
  gymId?: string;
  memberIds: string[];
  coachIds: string[];
  ownerId: string;
  createdAt?: Timestamp;
  // Settings
  membershipType: MembershipType;
  isPublic: boolean;
  isDeletable: boolean;
  // Default time slots
  defaultTimeSlots: TimeSlot[];
  // Workout visibility settings
  hideDetailsByDefault: boolean;
  defaultRevealDaysBefore: number;
  defaultRevealHour: number;
  defaultRevealMinute: number;
}

// Helper functions
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function normalizeWorkoutName(name: string): string {
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
