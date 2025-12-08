import { Timestamp } from "firebase/firestore";

// User roles
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
  gymId?: string;
  createdAt: Timestamp;
  hideFromLeaderboards: boolean;
  // AI Trainer subscription (for athletes - personalized scaling/recommendations)
  aiTrainerSubscription?: AITrainerSubscription;
  // AI Programming subscription (for coaches - programming assistant)
  aiProgrammingSubscription?: AITrainerSubscription;
  // AI Coach preferences and goals
  aiCoachPreferences?: AICoachPreferences;
  // Individual subscription (for users not in a gym)
  individualSubscription?: IndividualSubscription;
  // Flag to indicate if user has AI Coach via their gym
  gymAICoachEnabled?: boolean;
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
export type WorkoutType = "lift" | "wod";
export type WorkoutResultType = "time" | "rounds" | "weight" | "reps" | "other";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

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
  notes?: string; // Coach notes: stimulus, scaling options, intent, etc.
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

// Time slot with signups for a scheduled workout
export interface ScheduledTimeSlot extends TimeSlot {
  signups: string[]; // Array of user IDs signed up for this slot
}

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
  // Series tracking for recurring workouts
  seriesId?: string;
  gymId?: string;
  // Time slots for this workout (with signup tracking)
  timeSlots?: ScheduledTimeSlot[];
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

// Pricing types
export type BillingCycle = "monthly" | "yearly" | "one-time";
export type ClassLimitType = "unlimited" | "per-month" | "fixed";
export type PaymentStatus = "active" | "past_due" | "cancelled" | "trial";

export interface PricingTier {
  id: string;
  name: string;
  // Pricing per billing cycle
  monthlyPrice?: number;
  yearlyPrice?: number;
  oneTimePrice?: number;
  // Class limits
  classLimitType: ClassLimitType;
  classesPerMonth?: number;  // For "per-month" type
  totalClasses?: number;     // For "fixed" (one-time pack) type
  description?: string;
  features?: string[];
  isActive: boolean;
  // Hidden plan with signup code
  isHidden?: boolean;
  signupCode?: string;
}

export type DiscountType = "percentage" | "fixed";

export interface DiscountCode {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number; // Percentage (0-100) or fixed dollar amount
  description?: string;
  isActive: boolean;
  expiresAt?: Timestamp;
  usageLimit?: number;
  usageCount: number;
}

export interface MemberSubscription {
  id: string;
  memberId: string;
  tierId: string;
  status: PaymentStatus;
  startDate: Timestamp;
  nextBillingDate?: Timestamp;
  cancelledAt?: Timestamp;
}

export interface Gym {
  id: string;
  name: string;
  ownerId: string;
  coachIds: string[];
  memberIds: string[];
  createdAt: Timestamp;
  // Pricing settings (mockup)
  pricingEnabled?: boolean;
  defaultPricingTierId?: string;
  // Gym subscription (platform fees)
  subscription?: GymSubscription;
  // Gym details (from application)
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;
  // Application tracking
  applicationId?: string; // Reference to original application
  isApproved: boolean; // Whether the gym has been approved by admin
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
  // Signup cutoff (minutes before time slot)
  signupCutoffMinutes: number;
  // Pricing settings (mockup)
  pricingTierId?: string;
  requiresPayment?: boolean;
  additionalFee?: number;
}

// Group membership request
export interface GroupMembershipRequest {
  id: string;
  groupId: string;
  groupName: string;
  gymId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: "pending" | "approved" | "denied";
  createdAt: Timestamp;
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

export function formatTimeSlot(hour: number, minute: number): string {
  const safeHour = hour ?? 0;
  const safeMinute = minute ?? 0;
  const period = safeHour >= 12 ? "PM" : "AM";
  const displayHour = safeHour % 12 || 12;
  const displayMinute = safeMinute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
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
  gymId: string;
  createdBy: string;
  title: string;
  status: "active" | "published" | "archived";
  messages: AIChatMessage[];
  // Generated program details
  programWeeks?: number;
  programStartDate?: Timestamp;
  targetGroupIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AIGeneratedWorkout {
  type: WorkoutComponentType;
  title: string;
  description: string;
  scoringType?: WODScoringType;
  notes?: string; // Coach notes: stimulus, scaling options, intent, etc.
}

export interface AIGeneratedDay {
  date: string; // ISO date string
  dayOfWeek: string;
  isRestDay: boolean;
  components: AIGeneratedWorkout[];
}

export interface AIProgrammingPreferences {
  gymId: string;
  philosophy: string; // Free-form text describing gym's programming philosophy
  workoutDuration: "short" | "medium" | "long" | "varied"; // Preferred workout length
  benchmarkFrequency: "often" | "sometimes" | "rarely"; // How often to program benchmarks
  programmingStyle: string; // e.g., "Mayhem", "CompTrain", "HWPO", "Custom"
  additionalRules: string; // Any other rules or preferences
  updatedAt: Timestamp;
}

// =========================
// SUBSCRIPTION & PRICING TYPES
// =========================

// Gym Plan Types
export type GymPlanType = "base" | "ai_programmer";

export interface GymSubscription {
  plan: GymPlanType;
  status: "active" | "canceled" | "past_due" | "trialing";
  aiProgrammerEnabled: boolean;  // +$100/mo add-on
  aiCoachEnabled: boolean;       // Enables $1/member/mo AI Coach for all members
  aiCoachMemberCount?: number;   // Number of members with AI Coach enabled
  startDate?: Timestamp;
  currentPeriodEnd?: Timestamp;
  aiProgrammerEndsAt?: Timestamp;  // When AI Programmer will be disabled (if downgrading)
  aiCoachEndsAt?: Timestamp;       // When AI Coach will be disabled (if canceling)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// Individual User Subscription Flags
export interface IndividualSubscription {
  isIndividual: boolean;           // true if user is not affiliated with a gym
  aiCoachEnabled: boolean;         // $9.99/mo personal AI Coach subscription
  externalProgrammingEnabled: boolean; // $50/mo for external programming import
  aiProgrammerEnabled: boolean;    // $100/mo for AI-generated workouts
  status: "active" | "canceled" | "past_due" | "trialing";
  startDate?: Timestamp;
  currentPeriodEnd?: Timestamp;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// Pricing Constants
export const PRICING = {
  // Gym pricing
  GYM_BASE: 49,             // $49/mo base gym subscription (includes external programming import)
  GYM_AI_PROGRAMMER: 99,    // +$99/mo AI Programmer add-on for gyms
  GYM_AI_COACH_PER_MEMBER: 1, // +$1/member/mo for AI Coach

  // Individual pricing (FREE tier = tracking only)
  INDIVIDUAL_AI_COACH: 9.99,        // $9.99/mo personal AI Coach
  INDIVIDUAL_AI_PROGRAMMER: 9.99,   // $9.99/mo AI-generated personal programming
  INDIVIDUAL_AI_PROGRAMMER_PLUS: 14.99, // $14.99/mo premium AI programming
} as const;

// Feature Access Helpers
export interface FeatureAccess {
  canUseAIProgrammer: boolean;
  canUseAICoach: boolean;
  canImportExternalProgramming: boolean;
  isGymOwner: boolean;
  isGymMember: boolean;
}

// =========================
// GYM APPLICATION TYPES
// =========================

export type GymApplicationStatus = "pending" | "approved" | "rejected";

export interface GymApplication {
  id: string;
  // Applicant info
  userId: string;
  userEmail: string;
  userName: string;

  // Gym details
  gymName: string;
  gymAddress: string;
  gymCity: string;
  gymState: string;
  gymZip: string;
  gymPhone?: string;
  gymWebsite?: string;

  // Verification
  ownershipProof?: string; // Description of how they can prove ownership
  additionalNotes?: string;

  // Status
  status: GymApplicationStatus;
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string; // Super admin user ID
  rejectionReason?: string;

  // If approved, the created gym ID
  approvedGymId?: string;
}


