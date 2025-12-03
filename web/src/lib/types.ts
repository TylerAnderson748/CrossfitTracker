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
// EXTERNAL PROGRAMMING API TYPES
// =====================

// Status of a provider's API connection
export type ProviderConnectionStatus = "active" | "inactive" | "pending" | "error";

// Authentication method for external providers
export type ProviderAuthMethod = "api_key" | "oauth" | "webhook_secret";

// External Programming Provider - represents a programming service that can push workouts via API
export interface ExternalProgrammingProvider {
  id: string;
  name: string;
  slug: string; // URL-safe identifier (e.g., "elite-programming")
  description: string;
  logoUrl?: string;
  websiteUrl?: string;
  // API configuration
  authMethod: ProviderAuthMethod;
  apiEndpoint?: string; // Their callback URL for OAuth or outbound API
  webhookEndpoint?: string; // Our endpoint they'll call to push workouts
  // Provider capabilities
  supportsScheduledWorkouts: boolean;
  supportsDailyWorkouts: boolean;
  supportsMultiplePrograms: boolean; // Can offer different tracks/programs
  // Metadata
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// API credentials for a provider (stored securely)
export interface ProviderAPICredentials {
  id: string;
  providerId: string;
  gymId: string;
  // Credentials (only one will be used based on authMethod)
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string; // For verifying incoming webhook requests
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: Timestamp;
  // Status
  status: ProviderConnectionStatus;
  lastSyncAt?: Timestamp;
  lastError?: string;
  createdAt: Timestamp;
}

// Connection between a gym and an external provider
export interface GymProviderConnection {
  id: string;
  gymId: string;
  providerId: string;
  providerName: string;
  // Which program/track from this provider (if they offer multiple)
  programId?: string;
  programName?: string;
  // Mapping to gym groups - which groups receive these workouts
  targetGroupIds: string[];
  // Settings
  autoPublish: boolean; // Automatically publish workouts when received
  defaultHideDetails: boolean; // Hide workout details by default
  // Status
  status: ProviderConnectionStatus;
  connectedAt: Timestamp;
  lastWorkoutReceivedAt?: Timestamp;
}

// Workout pushed from an external provider
export interface ExternalProgrammedWorkout {
  id: string;
  // Source tracking
  externalId: string; // Provider's unique ID for this workout
  providerId: string;
  providerName: string;
  connectionId: string; // GymProviderConnection ID
  gymId: string;
  // Workout details
  title: string;
  description: string;
  scheduledDate: Timestamp;
  // Multi-component support (warmup, wod, lift, skill, cooldown)
  components: WorkoutComponent[];
  // Provider metadata
  programName?: string; // e.g., "Competition Track", "Fitness Track"
  trackName?: string;
  difficulty?: string;
  estimatedDuration?: number; // in minutes
  coachNotes?: string;
  // Publishing status
  isPublished: boolean;
  publishedAt?: Timestamp;
  publishedToGroupIds: string[];
  // Timestamps
  receivedAt: Timestamp;
  updatedAt: Timestamp;
}

// Webhook payload structure for providers to push workouts
export interface ProviderWebhookPayload {
  event: "workout.created" | "workout.updated" | "workout.deleted";
  timestamp: string; // ISO 8601
  provider: {
    id: string;
    name: string;
  };
  workout: {
    externalId: string;
    title: string;
    description: string;
    scheduledDate: string; // ISO 8601
    programName?: string;
    trackName?: string;
    difficulty?: string;
    estimatedDuration?: number;
    coachNotes?: string;
    components: Array<{
      type: WorkoutComponentType;
      title: string;
      description: string;
      scoringType?: WODScoringType;
    }>;
  };
  signature: string; // HMAC signature for verification
}

// Response from our webhook endpoint
export interface WebhookResponse {
  success: boolean;
  message: string;
  workoutId?: string;
  error?: string;
}

// Provider registration request (for new providers to sign up)
export interface ProviderRegistrationRequest {
  id: string;
  name: string;
  email: string;
  websiteUrl: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  notes?: string;
}

