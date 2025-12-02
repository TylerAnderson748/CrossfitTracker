"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, formatResult } from "@/lib/types";
import Navigation from "@/components/Navigation";
import { WOD_CATEGORIES, LIFT_CATEGORIES, SKILL_CATEGORIES, WorkoutCategory, Workout, getAllWods, getAllLifts, getAllSkills } from "@/lib/workoutData";

interface FrequentWorkout {
  name: string;
  count: number;
  type: "wod" | "lift" | "skill";
  description: string;
}

interface CustomWorkout {
  name: string;
  description: string;
  type: "wod" | "lift" | "skill";
  scoringType?: string;
  count: number;
}

interface GymWorkout {
  name: string;
  description: string;
  type: "wod" | "lift" | "skill";
  scoringType?: string;
  scheduledDate?: Date;
}

export default function WorkoutsPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<"wod" | "lift" | "skill">("wod");
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [frequentWods, setFrequentWods] = useState<FrequentWorkout[]>([]);
  const [frequentLifts, setFrequentLifts] = useState<FrequentWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showLogDropdown, setShowLogDropdown] = useState(false);

  // Custom (user-created) workouts
  const [customWods, setCustomWods] = useState<CustomWorkout[]>([]);
  const [customLifts, setCustomLifts] = useState<CustomWorkout[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomWorkout[]>([]);

  // Gym programming workouts
  const [gymWorkouts, setGymWorkouts] = useState<GymWorkout[]>([]);

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
      const allWods = getAllWods();
      const allLifts = getAllLifts();
      const allSkills = getAllSkills();

      // Create sets of preset names for quick lookup
      const presetWodNames = new Set(allWods.map(w => w.name.toLowerCase()));
      const presetLiftNames = new Set(allLifts.map(l => l.name.toLowerCase()));
      const presetSkillNames = new Set(allSkills.map(s => s.name.toLowerCase()));

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

      // Count WOD frequency and identify custom WODs
      const wodCounts: Record<string, { count: number; description: string; scoringType?: string }> = {};
      logs.forEach((log) => {
        if (log.wodTitle) {
          if (!wodCounts[log.wodTitle]) {
            // Infer scoring type from result type
            let scoringType: string | undefined;
            if (log.resultType === "time") scoringType = "fortime";
            else if (log.resultType === "rounds" || log.resultType === "reps") scoringType = "amrap";

            wodCounts[log.wodTitle] = {
              count: 0,
              description: log.wodDescription || "",
              scoringType,
            };
          }
          wodCounts[log.wodTitle].count++;
        }
      });

      // Separate preset WODs from custom WODs
      const frequentWodsList: FrequentWorkout[] = [];
      const customWodsList: CustomWorkout[] = [];

      Object.entries(wodCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .forEach(([name, data]) => {
          const isPreset = presetWodNames.has(name.toLowerCase());
          if (isPreset) {
            const wod = allWods.find((w) => w.name.toLowerCase() === name.toLowerCase());
            frequentWodsList.push({
              name,
              count: data.count,
              type: "wod",
              description: wod?.description || data.description,
            });
          } else {
            customWodsList.push({
              name,
              description: data.description,
              type: "wod",
              scoringType: data.scoringType,
              count: data.count,
            });
          }
        });

      setFrequentWods(frequentWodsList.slice(0, 6));
      setCustomWods(customWodsList);

      // Fetch lift results
      const liftsQuery = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id)
      );
      const liftsSnapshot = await getDocs(liftsQuery);

      // Count lift frequency and identify custom lifts
      const liftCounts: Record<string, number> = {};
      liftsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const liftName = data.liftTitle || data.liftName;
        if (liftName) {
          liftCounts[liftName] = (liftCounts[liftName] || 0) + 1;
        }
      });

      // Separate preset lifts from custom lifts
      const frequentLiftsList: FrequentWorkout[] = [];
      const customLiftsList: CustomWorkout[] = [];

      Object.entries(liftCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          const isPreset = presetLiftNames.has(name.toLowerCase());
          if (isPreset) {
            const lift = allLifts.find((l) => l.name.toLowerCase() === name.toLowerCase());
            frequentLiftsList.push({
              name,
              count,
              type: "lift",
              description: lift?.description || "",
            });
          } else {
            customLiftsList.push({
              name,
              description: `Logged ${count} times`,
              type: "lift",
              count,
            });
          }
        });

      setFrequentLifts(frequentLiftsList.slice(0, 6));
      setCustomLifts(customLiftsList);

      // Fetch skill results
      const skillsQuery = query(
        collection(db, "skillResults"),
        where("userId", "==", user.id)
      );
      const skillsSnapshot = await getDocs(skillsQuery);

      // Count skill frequency and identify custom skills
      const skillCounts: Record<string, number> = {};
      skillsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const skillName = data.skillTitle || data.skillName;
        if (skillName) {
          skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
        }
      });

      // Separate preset skills from custom skills
      const customSkillsList: CustomWorkout[] = [];

      Object.entries(skillCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          const isPreset = presetSkillNames.has(name.toLowerCase());
          if (!isPreset) {
            customSkillsList.push({
              name,
              description: `Logged ${count} times`,
              type: "skill",
              count,
            });
          }
        });

      setCustomSkills(customSkillsList);

      // Fetch gym programming workouts if user has a gym
      if (user.gymId) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const gymProgrammingQuery = query(
          collection(db, "scheduledWorkouts"),
          where("gymId", "==", user.gymId)
        );
        const gymProgrammingSnapshot = await getDocs(gymProgrammingQuery);

        const gymWorkoutsList: GymWorkout[] = [];
        const seenNames = new Set<string>();

        gymProgrammingSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Check each component in the workout
          const components = data.components || [];
          components.forEach((component: { title?: string; description?: string; type?: string; scoringType?: string }) => {
            const name = component.title;
            if (name && !seenNames.has(name.toLowerCase())) {
              seenNames.add(name.toLowerCase());
              const componentType = component.type === "lift" ? "lift" : component.type === "skill" ? "skill" : "wod";
              gymWorkoutsList.push({
                name,
                description: component.description || "",
                type: componentType,
                scoringType: component.scoringType,
                scheduledDate: data.date?.toDate?.(),
              });
            }
          });
        });

        setGymWorkouts(gymWorkoutsList.slice(0, 20));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Build categories with dynamic Frequent section
  const getCategories = (): WorkoutCategory[] => {
    const baseCategories = workoutType === "wod" ? WOD_CATEGORIES : workoutType === "lift" ? LIFT_CATEGORIES : SKILL_CATEGORIES;
    const frequentItems = workoutType === "wod" ? frequentWods : workoutType === "lift" ? frequentLifts : [];

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
    const allWorkouts = workoutType === "wod" ? getAllWods() : workoutType === "lift" ? getAllLifts() : getAllSkills();
    return allWorkouts.filter(
      (w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const searchResults = getSearchResults();
  const isSearching = searchQuery.trim().length > 0;

  // Get custom workouts for current type
  const getCurrentCustomWorkouts = (): CustomWorkout[] => {
    switch (workoutType) {
      case "wod": return customWods;
      case "lift": return customLifts;
      case "skill": return customSkills;
      default: return [];
    }
  };
  const currentCustomWorkouts = getCurrentCustomWorkouts();

  // Get gym workouts for current type
  const getCurrentGymWorkouts = (): GymWorkout[] => {
    return gymWorkouts.filter(w => w.type === workoutType);
  };
  const currentGymWorkouts = getCurrentGymWorkouts();

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
          <div className="relative">
            <button
              onClick={() => setShowLogDropdown(!showLogDropdown)}
              onBlur={() => setTimeout(() => setShowLogDropdown(false), 200)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              + Log Workout
              <svg className={`w-4 h-4 transition-transform ${showLogDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLogDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <Link
                  href="/workouts/new"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log WOD</span>
                  <p className="text-xs text-gray-500">For Time, EMOM, AMRAP</p>
                </Link>
                <Link
                  href="/workouts/lift"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log Lift</span>
                  <p className="text-xs text-gray-500">Track weight & reps</p>
                </Link>
                <Link
                  href="/workouts/skill"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log Skill</span>
                  <p className="text-xs text-gray-500">Gymnastics & skills</p>
                </Link>
              </div>
            )}
          </div>
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
          <button
            onClick={() => {
              setWorkoutType("skill");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "skill"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Skills
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
                            : workout.type === "skill"
                            ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                            : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
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
              <>
                {/* My Saved Workouts Section */}
                {currentCustomWorkouts.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-xl">📝</span>
                      My Saved {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "Lifts" : "Skills"}
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {currentCustomWorkouts.slice(0, 5).map((workout, idx) => (
                        <Link
                          key={`custom-${workout.name}-${idx}`}
                          href={
                            workout.type === "lift"
                              ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                              : workout.type === "skill"
                              ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                              : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                          }
                          className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{workout.name}</h3>
                              <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                                Custom
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm truncate">
                              {workout.description || `Logged ${workout.count} times`}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                      {currentCustomWorkouts.length > 5 && (
                        <div className="px-4 py-3 bg-gray-50 text-center border-t border-gray-100">
                          <span className="text-sm text-gray-500">
                            +{currentCustomWorkouts.length - 5} more saved {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "lifts" : "skills"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* From My Gym Section */}
                {currentGymWorkouts.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-xl">🏋️</span>
                      From My Gym
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {currentGymWorkouts.slice(0, 5).map((workout, idx) => (
                        <Link
                          key={`gym-${workout.name}-${idx}`}
                          href={
                            workout.type === "lift"
                              ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                              : workout.type === "skill"
                              ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                              : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                          }
                          className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{workout.name}</h3>
                              {workout.scoringType && (
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  workout.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                                  workout.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                  workout.scoringType === "emom" ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {workout.scoringType === "fortime" ? "For Time" :
                                   workout.scoringType === "amrap" ? "AMRAP" :
                                   workout.scoringType === "emom" ? "EMOM" : workout.scoringType}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-sm truncate">{workout.description}</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                      {currentGymWorkouts.length > 5 && (
                        <div className="px-4 py-3 bg-gray-50 text-center border-t border-gray-100">
                          <span className="text-sm text-gray-500">
                            +{currentGymWorkouts.length - 5} more from gym programming
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Category List */}
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  All {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "Lifts" : "Skills"}
                </h2>
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
                                : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
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
              </>
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
