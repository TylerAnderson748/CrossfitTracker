"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { LeaderboardEntry, formatResult, Gender } from "@/lib/types";
import Navigation from "@/components/Navigation";

function LeaderboardContent() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWorkout = searchParams.get("workout") || "";

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState<string>(initialWorkout || "all");
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");
  const [workoutNames, setWorkoutNames] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchLeaderboard();
    }
  }, [user]);

  useEffect(() => {
    if (initialWorkout) {
      setSelectedWorkout(initialWorkout);
    }
  }, [initialWorkout]);

  const fetchLeaderboard = async () => {
    try {
      // Simplified query to avoid index requirements - sort client-side
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries")
      );
      const snapshot = await getDocs(leaderboardQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];

      // Sort by createdAt descending client-side
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setEntries(data);

      const uniqueNames = [...new Set(data.map((e) => e.originalWorkoutName))].sort();
      setWorkoutNames(uniqueNames);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoadingData(false);
    }
  };

  let filteredEntries = entries;

  if (selectedWorkout !== "all") {
    filteredEntries = filteredEntries.filter(
      (e) => e.originalWorkoutName === selectedWorkout
    );
  }

  if (genderFilter !== "all") {
    filteredEntries = filteredEntries.filter(
      (e) => e.userGender === genderFilter
    );
  }

  const getBestEntriesPerWorkout = () => {
    const grouped: { [workout: string]: LeaderboardEntry[] } = {};

    filteredEntries.forEach((entry) => {
      const workout = entry.originalWorkoutName;
      if (!grouped[workout]) {
        grouped[workout] = [];
      }

      const existingIndex = grouped[workout].findIndex((e) => e.userId === entry.userId);
      if (existingIndex === -1) {
        grouped[workout].push(entry);
      } else {
        const existing = grouped[workout][existingIndex];
        if (entry.resultType === "time") {
          if ((entry.timeInSeconds || Infinity) < (existing.timeInSeconds || Infinity)) {
            grouped[workout][existingIndex] = entry;
          }
        } else if (entry.resultType === "weight") {
          if ((entry.weight || 0) > (existing.weight || 0)) {
            grouped[workout][existingIndex] = entry;
          }
        }
      }
    });

    Object.keys(grouped).forEach((workout) => {
      grouped[workout].sort((a, b) => {
        if (a.resultType === "time") {
          return (a.timeInSeconds || Infinity) - (b.timeInSeconds || Infinity);
        }
        if (a.resultType === "weight") {
          return (b.weight || 0) - (a.weight || 0);
        }
        return 0;
      });
    });

    return grouped;
  };

  const groupedEntries = getBestEntriesPerWorkout();

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (rank === 2) return "bg-gray-100 text-gray-600 border-gray-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-gray-50 text-gray-500 border-gray-200";
  };

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workout
              </label>
              <select
                value={selectedWorkout}
                onChange={(e) => setSelectedWorkout(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Workouts</option>
                {workoutNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as Gender | "all")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Loading leaderboard...</p>
          </div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">🏆</div>
            <p className="text-gray-500">No leaderboard entries yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEntries).map(([workout, workoutEntries]) => (
              <div key={workout} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{workout}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {workoutEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`px-6 py-4 flex items-center ${
                        entry.userId === user.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${getRankStyle(
                          index + 1
                        )}`}
                      >
                        {index + 1}
                      </div>

                      <div className="ml-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {entry.userName}
                          </span>
                          {entry.userId === user.id && (
                            <span className="text-xs text-blue-600 font-medium">(You)</span>
                          )}
                          {entry.userGender && (
                            <span className="text-xs text-gray-400">
                              {entry.userGender === "Male" ? "♂" : "♀"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.completedDate?.toDate?.()?.toLocaleDateString()}
                          {entry.gymName && ` • ${entry.gymName}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-mono font-bold text-blue-600">
                          {formatResult(entry)}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            entry.category === "RX"
                              ? "bg-blue-100 text-blue-600"
                              : entry.category === "Scaled"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {entry.category}
                        </span>
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

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
