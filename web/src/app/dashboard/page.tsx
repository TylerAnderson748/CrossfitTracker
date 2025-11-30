"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, Timestamp, limit, orderBy, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, ScheduledTimeSlot, LeaderboardEntry, formatResult, normalizeWorkoutName, formatTimeSlot } from "@/lib/types";
import Navigation from "@/components/Navigation";

// Combined result type for both WODs and lifts
interface WorkoutResult {
  id: string;
  userName: string;
  createdAt?: Timestamp;
  // WOD fields
  category?: string;
  timeInSeconds?: number;
  resultType?: string;
  // Lift fields
  weight?: number;
  reps?: number;
  date?: Timestamp;
  isLift?: boolean;
}

interface WorkoutGroup {
  id: string;
  name: string;
  signupCutoffMinutes?: number;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
}

export default function DashboardPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<ScheduledWorkout[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<{ [key: string]: WorkoutResult[] }>({});
  const [groups, setGroups] = useState<Record<string, WorkoutGroup>>({});
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch upcoming scheduled workouts for the next 7 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);
      endDate.setHours(23, 59, 59, 999);
      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("date", ">=", Timestamp.fromDate(today)),
        where("date", "<=", Timestamp.fromDate(endDate)),
        orderBy("date", "asc")
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const workouts = workoutsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledWorkout[];
      setUpcomingWorkouts(workouts);

      // Fetch all groups for signup cutoff info
      const groupsQuery = query(collection(db, "groups"));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsMap: Record<string, WorkoutGroup> = {};
      groupsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        groupsMap[doc.id] = {
          id: doc.id,
          name: data.name,
          signupCutoffMinutes: data.signupCutoffMinutes ?? 0,
        };
      });
      setGroups(groupsMap);

      // Fetch logs for each workout - handle both WODs and lifts
      const logsMap: { [key: string]: WorkoutResult[] } = {};
      for (const workout of workouts) {
        const isLift = workout.workoutType?.toLowerCase().includes("lift");

        if (isLift) {
          // Fetch from liftResults for lifts (iOS uses liftTitle field)
          const liftQuery = query(
            collection(db, "liftResults"),
            where("liftTitle", "==", workout.wodTitle),
            limit(20)
          );
          const liftSnapshot = await getDocs(liftQuery);
          const liftResults = liftSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isLift: true,
          })) as WorkoutResult[];
          // Sort by date descending
          liftResults.sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(0);
            const dateB = b.date?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          logsMap[workout.id] = liftResults.slice(0, 5);
        } else {
          // Fetch from leaderboardEntries for WODs
          const normalized = normalizeWorkoutName(workout.wodTitle);
          const logsQuery = query(
            collection(db, "leaderboardEntries"),
            where("normalizedWorkoutName", "==", normalized),
            limit(20)
          );
          const logsSnapshot = await getDocs(logsQuery);
          const logs = logsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isLift: false,
          })) as WorkoutResult[];
          // Sort by createdAt descending client-side and take first 5
          logs.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          logsMap[workout.id] = logs.slice(0, 5);
        }
      }
      setWorkoutLogs(logsMap);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Check if user is signed up for a time slot
  const isUserSignedUp = (slot: ScheduledTimeSlot): boolean => {
    return slot.signups?.includes(user?.id || "") || false;
  };

  // Check if signup is past cutoff for a workout/timeslot
  const isSignupPastCutoff = (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot): boolean => {
    const groupIds = workout.groupIds || [];
    let maxCutoff = 0;
    for (const groupId of groupIds) {
      const group = groups[groupId];
      if (group?.signupCutoffMinutes && group.signupCutoffMinutes > maxCutoff) {
        maxCutoff = group.signupCutoffMinutes;
      }
    }

    if (maxCutoff === 0) return false;

    const workoutDate = workout.date.toDate();
    const slotTime = new Date(workoutDate);
    slotTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);

    const cutoffTime = new Date(slotTime.getTime() - maxCutoff * 60 * 1000);
    const now = new Date();

    return now >= cutoffTime;
  };

  const handleSignup = async (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot) => {
    if (!user) return;

    if (isSignupPastCutoff(workout, timeSlot)) {
      alert("Signup for this time slot has closed.");
      return;
    }

    try {
      const workoutRef = doc(db, "scheduledWorkouts", workout.id);
      const updatedTimeSlots = workout.timeSlots?.map((slot) => {
        if (slot.id === timeSlot.id) {
          return { ...slot, signups: [...(slot.signups || []), user.id] };
        }
        return slot;
      });

      await updateDoc(workoutRef, { timeSlots: updatedTimeSlots });

      setUpcomingWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id ? { ...w, timeSlots: updatedTimeSlots } : w
        )
      );
    } catch (error) {
      console.error("Error signing up for time slot:", error);
    }
  };

  const handleCancelSignup = async (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot) => {
    if (!user) return;

    try {
      const workoutRef = doc(db, "scheduledWorkouts", workout.id);
      const updatedTimeSlots = workout.timeSlots?.map((slot) => {
        if (slot.id === timeSlot.id) {
          return { ...slot, signups: (slot.signups || []).filter((id) => id !== user.id) };
        }
        return slot;
      });

      await updateDoc(workoutRef, { timeSlots: updatedTimeSlots });

      setUpcomingWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id ? { ...w, timeSlots: updatedTimeSlots } : w
        )
      );
    } catch (error) {
      console.error("Error canceling signup:", error);
    }
  };

  // Group workouts by date
  const groupedWorkouts: { [key: string]: ScheduledWorkout[] } = {};
  upcomingWorkouts.forEach((workout) => {
    const date = workout.date?.toDate?.() || new Date();
    const dateKey = date.toDateString();
    if (!groupedWorkouts[dateKey]) {
      groupedWorkouts[dateKey] = [];
    }
    groupedWorkouts[dateKey].push(workout);
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Workouts</h1>
          <p className="text-gray-500 mt-1">Your scheduled workouts and group programming</p>
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : Object.keys(groupedWorkouts).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 text-gray-300">📅</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No upcoming workouts</h3>
            <p className="text-gray-500 mb-6">Check back later or ask your coach to add workouts!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedWorkouts).map(([dateKey, dayWorkouts]) => {
              const date = new Date(dateKey);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div key={dateKey}>
                  {/* Day Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className={`text-lg font-semibold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                      {formatDate(date)}
                    </h2>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Workout Cards */}
                  <div className="space-y-4">
                    {dayWorkouts.map((workout) => {
                      const logs = workoutLogs[workout.id] || [];
                      const isLift = workout.workoutType?.toLowerCase().includes("lift");

                      return (
                        <div
                          key={workout.id}
                          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                        >
                          {/* Workout Info */}
                          <div className="p-5">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {workout.wodTitle}
                            </h3>
                            <p className="text-gray-500 leading-relaxed">
                              {workout.wodDescription}
                            </p>

                            {/* Time Slots */}
                            {workout.timeSlots && workout.timeSlots.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Class Times</p>
                                <div className="flex flex-wrap gap-2">
                                  {workout.timeSlots.map((slot, index) => {
                                    const signedUp = isUserSignedUp(slot);
                                    const signedUpCount = slot.signups?.length || 0;
                                    const capacity = slot.capacity || 20;
                                    const availableSpots = capacity - signedUpCount;
                                    const isFull = availableSpots <= 0;
                                    const isPastCutoff = isSignupPastCutoff(workout, slot);

                                    return (
                                      <button
                                        key={slot.id || `slot-${index}`}
                                        onClick={() => signedUp ? handleCancelSignup(workout, slot) : handleSignup(workout, slot)}
                                        disabled={(isFull || isPastCutoff) && !signedUp}
                                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                                          signedUp
                                            ? "bg-green-100 text-green-700 border border-green-300"
                                            : isPastCutoff
                                            ? "bg-orange-50 text-orange-400 cursor-not-allowed border border-orange-200"
                                            : isFull
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 border border-gray-200"
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {formatTimeSlot(slot.hour, slot.minute)}
                                        <span className={`text-xs ${
                                          signedUp ? "text-green-600"
                                          : isPastCutoff ? "text-orange-500"
                                          : isFull ? "text-red-400"
                                          : "text-gray-500"
                                        }`}>
                                          {signedUp ? "✓ Signed up" : isPastCutoff ? "Closed" : isFull ? "Full" : `${availableSpots} spots`}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-4">
                              <Link
                                href={isLift
                                  ? `/workouts/lift?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`
                                  : `/workouts/new?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`}
                                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors ${
                                  isLift
                                    ? "bg-purple-600 hover:bg-purple-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                <span>{isLift ? "🏋️" : "⏱️"}</span>
                                Log Workout
                              </Link>
                              <Link
                                href={`/leaderboard?workout=${encodeURIComponent(workout.wodTitle)}`}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                              >
                                <span>🏆</span>
                                Leaderboard
                              </Link>
                            </div>
                          </div>

                          {/* Recent Results */}
                          {logs.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                              <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">
                                Recent Results
                              </p>
                              <div className="space-y-3">
                                {logs.map((log) => (
                                  <div key={log.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                        log.isLift ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                      }`}>
                                        {log.userName?.charAt(0) || "?"}
                                      </div>
                                      <span className="text-sm font-medium text-gray-900">{log.userName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {log.isLift ? (
                                        <>
                                          <span className="font-mono text-sm font-semibold text-gray-900">{log.weight} lbs</span>
                                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                                            {log.reps} rep{log.reps !== 1 ? "s" : ""}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-mono text-sm font-semibold text-gray-900">{formatResult(log as LeaderboardEntry)}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            log.category === "RX"
                                              ? "bg-blue-100 text-blue-700"
                                              : log.category === "Scaled"
                                              ? "bg-gray-200 text-gray-700"
                                              : "bg-green-100 text-green-700"
                                          }`}>
                                            {log.category}
                                          </span>
                                        </>
                                      )}
                                      <span className="text-xs text-gray-400">
                                        {timeAgo((log.isLift ? log.date : log.createdAt)?.toDate?.() || new Date())}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
