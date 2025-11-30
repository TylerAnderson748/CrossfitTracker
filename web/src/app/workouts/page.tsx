"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, formatResult } from "@/lib/types";
import Navigation from "@/components/Navigation";
import { WOD_CATEGORIES, LIFT_CATEGORIES, WorkoutCategory, Workout, getAllWods, getAllLifts } from "@/lib/workoutData";

interface FrequentWorkout {
  name: string;
  count: number;
  type: "wod" | "lift";
  description: string;
}

export default function WorkoutsPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<"wod" | "lift">("wod");
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [frequentWods, setFrequentWods] = useState<FrequentWorkout[]>([]);
  const [frequentLifts, setFrequentLifts] = useState<FrequentWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch WOD logs
      const logsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id)
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      logs.sort((a, b) => {
        const dateA = a.completedDate?.toDate?.() || new Date(0);
        const dateB = b.completedDate?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setRecentLogs(logs.slice(0, 10));

      // Count WOD frequency
      const wodCounts: Record<string, number> = {};
      logs.forEach((log) => {
        if (log.wodTitle) {
          wodCounts[log.wodTitle] = (wodCounts[log.wodTitle] || 0) + 1;
        }
      });

      // Get top frequent WODs
      const allWods = getAllWods();
      const frequentWodsList: FrequentWorkout[] = Object.entries(wodCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, count]) => {
          const wod = allWods.find((w) => w.name.toLowerCase() === name.toLowerCase());
          return {
            name,
            count,
            type: "wod" as const,
            description: wod?.description || "",
          };
        });
      setFrequentWods(frequentWodsList);

      // Fetch lift results
      const liftsQuery = query(
        collection(db, "liftResults"),
        where("oderId", "==", user.id)
      );
      const liftsSnapshot = await getDocs(liftsQuery);

      // Count lift frequency
      const liftCounts: Record<string, number> = {};
      liftsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const liftName = data.liftTitle || data.liftName;
        if (liftName) {
          liftCounts[liftName] = (liftCounts[liftName] || 0) + 1;
        }
      });

      // Get top frequent lifts
      const allLifts = getAllLifts();
      const frequentLiftsList: FrequentWorkout[] = Object.entries(liftCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, count]) => {
          const lift = allLifts.find((l) => l.name.toLowerCase() === name.toLowerCase());
          return {
            name,
            count,
            type: "lift" as const,
            description: lift?.description || "",
          };
        });
      setFrequentLifts(frequentLiftsList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Build categories with dynamic Frequent section
  const getCategories = (): WorkoutCategory[] => {
    const baseCategories = workoutType === "wod" ? WOD_CATEGORIES : LIFT_CATEGORIES;
    const frequentItems = workoutType === "wod" ? frequentWods : frequentLifts;

    if (frequentItems.length > 0) {
      const frequentCategory: WorkoutCategory = {
        name: "Frequent",
        icon: "⚡",
        workouts: frequentItems.map((f) => ({
          name: f.name,
          description: f.description || `Logged ${f.count} times`,
          type: f.type,
        })),
      };
      return [frequentCategory, ...baseCategories];
    }
    return baseCategories;
  };

  const categories = getCategories();

  // Filter workouts across all categories when searching
  const getSearchResults = (): Workout[] => {
    if (!searchQuery.trim()) return [];
    const allWorkouts = workoutType === "wod" ? getAllWods() : getAllLifts();
    return allWorkouts.filter(
      (w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const searchResults = getSearchResults();
  const isSearching = searchQuery.trim().length > 0;

  const toggleCategory = (categoryName: string) => {
    setExpandedCategory(expandedCategory === categoryName ? null : categoryName);
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
            onClick={() => {
              setWorkoutType("wod");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "wod"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            WODs
          </button>
          <button
            onClick={() => {
              setWorkoutType("lift");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "lift"
                ? "bg-blue-600 text-white"
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workout Categories or Search Results */}
          <div className="lg:col-span-2">
            {isSearching ? (
              // Search Results
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Search Results ({searchResults.length})
                </h2>
                {searchResults.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {searchResults.map((workout, idx) => (
                      <Link
                        key={`${workout.name}-${idx}`}
                        href={
                          workout.type === "lift"
                            ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                            : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}`
                        }
                        className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                          idx > 0 ? "border-t border-gray-100" : ""
                        }`}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900">{workout.name}</h3>
                          <p className="text-gray-500 text-sm">{workout.description}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">No workouts found matching "{searchQuery}"</p>
                  </div>
                )}
              </>
            ) : (
              // Category List
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {categories.map((category, catIdx) => (
                  <div key={category.name}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                        catIdx > 0 ? "border-t border-gray-100" : ""
                      }`}
                    >
                      <span className="font-medium text-gray-900 flex items-center gap-2">
                        {category.icon && <span>{category.icon}</span>}
                        {category.name}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedCategory === category.name ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Expanded Workout List */}
                    {expandedCategory === category.name && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {category.workouts.map((workout, idx) => (
                          <Link
                            key={`${workout.name}-${idx}`}
                            href={
                              workout.type === "lift"
                                ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                                : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}`
                            }
                            className={`flex items-center justify-between p-4 pl-8 hover:bg-gray-100 transition-colors ${
                              idx > 0 ? "border-t border-gray-200" : ""
                            }`}
                          >
                            <div>
                              <h4 className="font-medium text-gray-800">{workout.name}</h4>
                              <p className="text-gray-500 text-sm">{workout.description}</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
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
