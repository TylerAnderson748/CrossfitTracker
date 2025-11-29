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
  createdAt: Timestamp;
  hideFromLeaderboards: boolean;
}

// Workout types
export type WorkoutType = "lift" | "wod";
export type WorkoutResultType = "time" | "rounds" | "weight" | "reps" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

// WOD Categories - matching iOS
export type WODCategory = "RX" | "Scaled" | "Just for Fun";

export const categoryColors: Record<WODCategory, string> = {
  "RX": "bg-blue-500 text-white",
  "Scaled": "bg-gray-500 text-white",
  "Just for Fun": "bg-green-500 text-white",
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

export interface WorkoutGroup {
  id: string;
  name: string;
  type: "defaultGroup" | "custom" | "personal";
  gymId?: string;
  memberIds: string[];
  coachIds: string[];
  ownerId: string;
  hideDetailsByDefault: boolean;
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
