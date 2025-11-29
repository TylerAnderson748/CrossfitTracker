"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, LeaderboardEntry, formatTime } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);
  const [recentLeaderboard, setRecentLeaderboard] = useState<LeaderboardEntry[]>([]);
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
    if (!user) return;

    try {
      // Fetch recent workouts for this user
      const workoutsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        orderBy("completedDate", "desc"),
        limit(5)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const workouts = workoutsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      setRecentWorkouts(workouts);

      // Fetch recent leaderboard entries
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      const entries = leaderboardSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];
      setRecentLeaderboard(entries);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user.firstName || user.displayName}!
          </h1>
          <p className="text-gray-400">Track your progress and crush your goals</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/workouts/new"
            className="bg-orange-500 hover:bg-orange-600 rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-2xl mb-2">+</div>
            <div className="font-semibold">Log Workout</div>
          </Link>
          <Link
            href="/leaderboard"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-semibold">Leaderboard</div>
          </Link>
          <Link
            href="/lifts"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-2xl mb-2">🏋️</div>
            <div className="font-semibold">Track Lifts</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Workouts */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Recent Workouts</h2>
              <Link href="/workouts" className="text-orange-500 text-sm hover:underline">
                View all
              </Link>
            </div>
            {loadingData ? (
              <p className="text-gray-400">Loading...</p>
            ) : recentWorkouts.length === 0 ? (
              <p className="text-gray-400">No workouts logged yet. Start tracking!</p>
            ) : (
              <div className="space-y-3">
                {recentWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{workout.wodTitle}</div>
                      <div className="text-sm text-gray-400">{workout.notes || "No notes"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-orange-500">
                        {formatTime(workout.timeInSeconds)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {workout.completedDate?.toDate?.()?.toLocaleDateString() || ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Leaderboard */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
              <Link href="/leaderboard" className="text-orange-500 text-sm hover:underline">
                Full leaderboard
              </Link>
            </div>
            {loadingData ? (
              <p className="text-gray-400">Loading...</p>
            ) : recentLeaderboard.length === 0 ? (
              <p className="text-gray-400">No leaderboard entries yet.</p>
            ) : (
              <div className="space-y-3">
                {recentLeaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{entry.userName}</div>
                      <div className="text-sm text-gray-400">{entry.originalWorkoutName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-orange-500">
                        {formatTime(entry.timeInSeconds)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
