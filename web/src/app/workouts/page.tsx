"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, formatResult } from "@/lib/types";
import Navigation from "@/components/Navigation";

// Popular WODs
const POPULAR_WODS = [
  { name: "Fran", description: "21-15-9: Thrusters (95/65) & Pull-ups", type: "wod" },
  { name: "Murph", description: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run", type: "wod" },
  { name: "Cindy", description: "AMRAP 20: 5 pull-ups, 10 push-ups, 15 squats", type: "wod" },
  { name: "Grace", description: "30 Clean & Jerks (135/95)", type: "wod" },
  { name: "Helen", description: "3 RFT: 400m run, 21 KB swings, 12 pull-ups", type: "wod" },
  { name: "Diane", description: "21-15-9: Deadlifts (225/155) & HSPU", type: "wod" },
];

const POPULAR_LIFTS = [
  { name: "Back Squat", description: "Barbell back squat", type: "lift" },
  { name: "Front Squat", description: "Barbell front squat", type: "lift" },
  { name: "Deadlift", description: "Conventional deadlift", type: "lift" },
  { name: "Clean", description: "Power or squat clean", type: "lift" },
  { name: "Snatch", description: "Power or squat snatch", type: "lift" },
  { name: "Overhead Press", description: "Strict press", type: "lift" },
];

export default function WorkoutsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<"wod" | "lift">("wod");
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchRecentLogs();
    }
  }, [user]);

  const fetchRecentLogs = async () => {
    if (!user) return;

    try {
      // Simplified query to avoid index requirements - sort client-side
      const logsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id)
      );
      const snapshot = await getDocs(logsQuery);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      // Sort by completedDate descending client-side
      logs.sort((a, b) => {
        const dateA = a.completedDate?.toDate?.() || new Date(0);
        const dateB = b.completedDate?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setRecentLogs(logs.slice(0, 10));
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredWorkouts = workoutType === "wod"
    ? POPULAR_WODS.filter((w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_LIFTS.filter((w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
          <Link
            href="/workouts/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Log Workout
          </Link>
        </div>

        {/* Type Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setWorkoutType("wod")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "wod"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            WODs
          </button>
          <button
            onClick={() => setWorkoutType("lift")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "lift"
                ? "bg-purple-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Lifts
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workouts..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workout List */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              ⭐ Popular {workoutType === "wod" ? "WODs" : "Lifts"}
            </h2>
            <div className="space-y-3">
              {filteredWorkouts.map((workout) => (
                <Link
                  key={workout.name}
                  href={`/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}`}
                  className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{workout.name}</h3>
                      <p className="text-gray-500 text-sm mt-1">{workout.description}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      workout.type === "lift"
                        ? "bg-purple-100 text-purple-600"
                        : "bg-blue-100 text-blue-600"
                    }`}>
                      {workout.type === "lift" ? "Lift" : "WOD"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {filteredWorkouts.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No workouts found matching your search</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Recent Logs</h2>
            {loadingData ? (
              <p className="text-gray-500">Loading...</p>
            ) : recentLogs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm">No workouts logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{log.wodTitle}</h4>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {log.completedDate?.toDate?.()?.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-blue-600 font-medium text-sm">
                          {formatResult(log)}
                        </span>
                        {log.isPersonalRecord && (
                          <span className="ml-1 text-yellow-500">👑</span>
                        )}
                      </div>
                    </div>
                    {log.notes && (
                      <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                        log.notes === "RX"
                          ? "bg-blue-100 text-blue-600"
                          : log.notes === "Scaled"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-100 text-green-600"
                      }`}>
                        {log.notes}
                      </span>
                    )}
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
