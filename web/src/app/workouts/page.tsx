"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, formatTime } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function WorkoutsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user]);

  const fetchWorkouts = async () => {
    if (!user) return;

    try {
      const workoutsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        orderBy("completedDate", "desc")
      );
      const snapshot = await getDocs(workoutsQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      setWorkouts(data);
    } catch (error) {
      console.error("Error fetching workouts:", error);
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Workouts</h1>
          <Link
            href="/workouts/new"
            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Log Workout
          </Link>
        </div>

        {loadingData ? (
          <p className="text-gray-400">Loading workouts...</p>
        ) : workouts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">You haven&apos;t logged any workouts yet.</p>
            <Link
              href="/workouts/new"
              className="text-orange-500 hover:underline"
            >
              Log your first workout
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <div key={workout.id} className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-semibold">{workout.wodTitle}</h3>
                    <p className="text-gray-400 text-sm mt-1">{workout.wodDescription}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono text-orange-500">
                      {formatTime(workout.timeInSeconds)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {workout.completedDate?.toDate?.()?.toLocaleDateString() || ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  {workout.notes && (
                    <span className="bg-gray-700 px-3 py-1 rounded text-sm">
                      {workout.notes}
                    </span>
                  )}
                  {workout.isPersonalRecord && (
                    <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded text-sm">
                      PR!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
