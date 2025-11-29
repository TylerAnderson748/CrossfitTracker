import { Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  gender: string;
  role: string;
  hideFromLeaderboards: boolean;
  createdAt: Timestamp;
}

export interface LeaderboardEntry {
  id: string;
  userName: string;
  userId: string;
  timeInSeconds: number;
  resultType: "time" | "reps" | "rounds";
  originalWorkoutName: string;
  normalizedWorkoutName: string;
  completedDate: Timestamp;
  createdAt: Timestamp;
  workoutLogId: string;
}

export interface WorkoutLog {
  id: string;
  wodTitle: string;
  wodDescription: string;
  timeInSeconds: number;
  resultType: "time" | "reps" | "rounds";
  notes: string;
  isPersonalRecord: boolean;
  userId: string;
  completedDate: Timestamp;
  workoutDate: Timestamp;
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
  description?: string;
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  gymId: string;
  members: string[];
  createdAt: Timestamp;
}

// Helper function to format time
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper to normalize workout name for querying
export function normalizeWorkoutName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}
