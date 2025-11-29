"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, Timestamp, limit } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, LeaderboardEntry, formatResult, normalizeWorkoutName } from "@/lib/types";
import Navigation from "@/components/Navigation";

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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<ScheduledWorkout[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<{ [key: string]: LeaderboardEntry[] }>({});
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch upcoming scheduled workouts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("date", ">=", Timestamp.fromDate(today)),
        orderBy("date", "asc")
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const workouts = workoutsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledWorkout[];
      setUpcomingWorkouts(workouts.slice(0, 14));

      // Fetch logs for each workout - simplified query to avoid index requirements
      const logsMap: { [key: string]: LeaderboardEntry[] } = {};
      for (const workout of workouts.slice(0, 14)) {
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
        })) as LeaderboardEntry[];
        // Sort by createdAt descending client-side and take first 5
        logs.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        logsMap[workout.id] = logs.slice(0, 5);
      }
      setWorkoutLogs(logsMap);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoadingData(false);
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
                                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                        {log.userName?.charAt(0) || "?"}
                                      </div>
                                      <span className="text-sm font-medium text-gray-900">{log.userName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-semibold text-gray-900">{formatResult(log)}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        log.category === "RX"
                                          ? "bg-blue-100 text-blue-700"
                                          : log.category === "Scaled"
                                          ? "bg-gray-200 text-gray-700"
                                          : "bg-green-100 text-green-700"
                                      }`}>
                                        {log.category}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {timeAgo(log.createdAt?.toDate?.() || new Date())}
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
