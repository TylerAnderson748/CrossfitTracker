"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { LeaderboardEntry, formatTime } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState<string>("all");
  const [workoutNames, setWorkoutNames] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchLeaderboard();
    }
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        orderBy("timeInSeconds", "asc")
      );
      const snapshot = await getDocs(leaderboardQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];

      setEntries(data);

      // Extract unique workout names
      const uniqueNames = [...new Set(data.map((e) => e.originalWorkoutName))].sort();
      setWorkoutNames(uniqueNames);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredEntries = selectedWorkout === "all"
    ? entries
    : entries.filter((e) => e.originalWorkoutName === selectedWorkout);

  // Group by workout and get best time per user per workout
  const getBestEntriesPerWorkout = () => {
    const grouped: { [workout: string]: LeaderboardEntry[] } = {};

    filteredEntries.forEach((entry) => {
      const workout = entry.originalWorkoutName;
      if (!grouped[workout]) {
        grouped[workout] = [];
      }

      // Check if user already has an entry for this workout
      const existingIndex = grouped[workout].findIndex((e) => e.userId === entry.userId);
      if (existingIndex === -1) {
        grouped[workout].push(entry);
      } else if (entry.timeInSeconds < grouped[workout][existingIndex].timeInSeconds) {
        grouped[workout][existingIndex] = entry;
      }
    });

    // Sort each workout's entries by time
    Object.keys(grouped).forEach((workout) => {
      grouped[workout].sort((a, b) => a.timeInSeconds - b.timeInSeconds);
    });

    return grouped;
  };

  const groupedEntries = getBestEntriesPerWorkout();

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
        <h1 className="text-3xl font-bold mb-8">Leaderboard</h1>

        {/* Filter */}
        <div className="mb-6">
          <label htmlFor="workout-filter" className="block text-sm font-medium text-gray-300 mb-2">
            Filter by Workout
          </label>
          <select
            id="workout-filter"
            value={selectedWorkout}
            onChange={(e) => setSelectedWorkout(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">All Workouts</option>
            {workoutNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {loadingData ? (
          <p className="text-gray-400">Loading leaderboard...</p>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No leaderboard entries yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedEntries).map(([workout, workoutEntries]) => (
              <div key={workout} className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="bg-gray-700 px-6 py-3">
                  <h2 className="text-xl font-semibold">{workout}</h2>
                </div>
                <div className="divide-y divide-gray-700">
                  {workoutEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`px-6 py-4 flex items-center ${
                        entry.userId === user.id ? "bg-orange-500/10" : ""
                      }`}
                    >
                      <div className="w-12 text-center">
                        <span
                          className={`text-2xl font-bold ${
                            index === 0
                              ? "text-yellow-400"
                              : index === 1
                              ? "text-gray-300"
                              : index === 2
                              ? "text-orange-600"
                              : "text-gray-500"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 ml-4">
                        <div className="font-medium">
                          {entry.userName}
                          {entry.userId === user.id && (
                            <span className="ml-2 text-xs text-orange-500">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {entry.completedDate?.toDate?.()?.toLocaleDateString() || ""}
                        </div>
                      </div>
                      <div className="text-2xl font-mono text-orange-500">
                        {formatTime(entry.timeInSeconds)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
