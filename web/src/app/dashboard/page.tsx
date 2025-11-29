"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, LeaderboardEntry, formatResult, getRelativeDate } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<ScheduledWorkout[]>([]);
  const [recentActivity, setRecentActivity] = useState<LeaderboardEntry[]>([]);
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
      setUpcomingWorkouts(workouts.slice(0, 10));

      // Fetch recent leaderboard activity
      const activityQuery = query(
        collection(db, "leaderboardEntries"),
        orderBy("createdAt", "desc")
      );
      const activitySnapshot = await getDocs(activityQuery);
      const activity = activitySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];
      setRecentActivity(activity.slice(0, 5));
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
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Workouts</h1>
          <p className="text-gray-500">Your scheduled workouts for the week</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Workouts */}
          <div className="lg:col-span-2 space-y-6">
            {loadingData ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Loading workouts...</p>
              </div>
            ) : Object.keys(groupedWorkouts).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-4">📅</div>
                <p className="text-gray-500 mb-4">No upcoming workouts scheduled</p>
                <Link
                  href="/weekly"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Plan Your Week
                </Link>
              </div>
            ) : (
              Object.entries(groupedWorkouts).map(([dateKey, dayWorkouts]) => {
                const date = new Date(dateKey);
                const isToday = date.toDateString() === new Date().toDateString();

                return (
                  <div key={dateKey}>
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {getRelativeDate(date)}
                      </h2>
                      {isToday && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-semibold rounded">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="space-y-4">
                      {dayWorkouts.map((workout) => (
                        <div
                          key={workout.id}
                          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {workout.wodTitle}
                              </h3>
                              <p className="text-gray-500 text-sm mt-1">
                                {workout.wodDescription}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              workout.workoutType === "lift"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-blue-100 text-blue-600"
                            }`}>
                              {workout.workoutType === "lift" ? "Lift" : "WOD"}
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <Link
                              href={`/workouts/${workout.id}/timer`}
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              ⏱️ Log Workout
                            </Link>
                            <Link
                              href={`/leaderboard?workout=${encodeURIComponent(workout.wodTitle)}`}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              🏆 Leaderboard
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/workouts/new"
                  className="flex items-center gap-3 p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="text-xl">⏱️</span>
                  <span className="font-medium">Log a Workout</span>
                </Link>
                <Link
                  href="/workouts/lift"
                  className="flex items-center gap-3 p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <span className="text-xl">🏋️</span>
                  <span className="font-medium">Log a Lift</span>
                </Link>
                <Link
                  href="/leaderboard"
                  className="flex items-center gap-3 p-3 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xl">🏆</span>
                  <span className="font-medium">View Leaderboard</span>
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 text-sm">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{entry.userName}</p>
                        <p className="text-gray-500 text-xs">{entry.originalWorkoutName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-blue-600 font-medium">
                          {formatResult(entry)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          entry.category === "RX"
                            ? "bg-blue-100 text-blue-600"
                            : entry.category === "Scaled"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-600"
                        }`}>
                          {entry.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
