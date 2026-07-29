"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { workoutComponentLabels, workoutComponentColors, WorkoutComponent, WorkoutComponentType, WODScoringType, wodScoringTypeLabels, wodScoringTypeColors, PersonalWorkout } from "@/lib/types";
import { getAllWods, getAllLifts } from "@/lib/workoutData";
import Navigation from "@/components/Navigation";
import PersonalAITrainer from "@/components/PersonalAITrainer";

export default function WeeklyPlanPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [calendarRange, setCalendarRange] = useState<"next7days" | "thisWeek" | "nextWeek" | "2weeks" | "month">("next7days");
  const [loadingData, setLoadingData] = useState(true);

  // Personal workouts state
  const [personalWorkouts, setPersonalWorkouts] = useState<PersonalWorkout[]>([]);
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [newWorkoutDate, setNewWorkoutDate] = useState("");
  const [workoutComponents, setWorkoutComponents] = useState<WorkoutComponent[]>([]);
  const [editingPersonalWorkoutId, setEditingPersonalWorkoutId] = useState<string | null>(null);

  // Get all workouts for suggestions
  const allWods = getAllWods();
  const allLifts = getAllLifts();
  const uniqueWorkouts = [...allWods, ...allLifts];

  const hasAICoach = user?.aiTrainerSubscription?.status === "active" ||
    user?.aiTrainerSubscription?.status === "trialing";

  // Component management functions
  const addComponent = (type: WorkoutComponentType) => {
    const newComponent: WorkoutComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: "",
      description: "",
      ...(type === "wod" && { scoringType: "fortime" as WODScoringType }),
    };
    setWorkoutComponents([...workoutComponents, newComponent]);
  };

  const removeComponent = (id: string) => {
    setWorkoutComponents(workoutComponents.filter((c) => c.id !== id));
  };

  const updateComponent = (id: string, field: "title" | "description" | "scoringType" | "isPreset", value: string | boolean) => {
    setWorkoutComponents(prev =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  // Filter suggestions based on search text
  const getFilteredSuggestions = (searchText: string) => {
    if (!searchText) return uniqueWorkouts.slice(0, 10);
    return uniqueWorkouts.filter((w) =>
      w.name.toLowerCase().includes(searchText.toLowerCase())
    ).slice(0, 10);
  };

  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);

  // Reset form for new workout
  const resetWorkoutForm = () => {
    setWorkoutComponents([]);
    setNewWorkoutDate("");
    setActiveComponentId(null);
    setEditingPersonalWorkoutId(null);
  };

  // Helper to format date as YYYY-MM-DD in local time
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Open modal for adding new workout
  const openAddWorkoutModal = (dateStr?: string) => {
    resetWorkoutForm();
    if (dateStr) {
      setNewWorkoutDate(dateStr);
    } else {
      // Default to today
      setNewWorkoutDate(formatDateLocal(new Date()));
    }
    setShowAddWorkoutModal(true);
  };

  // Open modal for editing existing workout
  const openEditWorkoutModal = (workout: PersonalWorkout) => {
    setEditingPersonalWorkoutId(workout.id);
    setWorkoutComponents([...workout.components]);
    const workoutDate = workout.date.toDate();
    setNewWorkoutDate(formatDateLocal(workoutDate));
    setShowAddWorkoutModal(true);
  };

  // Save personal workout
  const handleSavePersonalWorkout = async () => {
    if (!user || !newWorkoutDate || workoutComponents.length === 0) return;

    // Validate all components have titles
    const hasEmptyTitle = workoutComponents.some((c) => !c.title.trim());
    if (hasEmptyTitle) {
      alert("Please add a title to all workout components");
      return;
    }

    try {
      // Parse date as local time (not UTC) to avoid timezone issues
      const [year, month, day] = newWorkoutDate.split('-').map(Number);
      const workoutDate = new Date(year, month - 1, day, 12, 0, 0, 0);

      if (editingPersonalWorkoutId) {
        // Update existing workout
        const workoutRef = doc(db, "personalWorkouts", editingPersonalWorkoutId);
        await updateDoc(workoutRef, {
          date: Timestamp.fromDate(workoutDate),
          dateString: newWorkoutDate, // Store exact date string for reliable comparison
          components: workoutComponents,
        });
      } else {
        // Create new workout
        await addDoc(collection(db, "personalWorkouts"), {
          userId: user.id,
          date: Timestamp.fromDate(workoutDate),
          dateString: newWorkoutDate, // Store exact date string for reliable comparison
          components: workoutComponents,
          createdAt: Timestamp.now(),
        });
      }

      setShowAddWorkoutModal(false);
      resetWorkoutForm();
      fetchPersonalWorkouts();
    } catch (error) {
      console.error("Error saving personal workout:", error);
    }
  };

  // Delete personal workout
  const handleDeletePersonalWorkout = async (workoutId: string) => {
    if (!confirm("Are you sure you want to delete this workout?")) return;

    try {
      await deleteDoc(doc(db, "personalWorkouts", workoutId));
      fetchPersonalWorkouts();
    } catch (error) {
      console.error("Error deleting personal workout:", error);
    }
  };

  // Calculate date range based on selection
  const getDateRange = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of this week (Monday)
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    let rangeStart = new Date(startOfWeek);
    const rangeEnd = new Date(startOfWeek);

    switch (calendarRange) {
      case "next7days":
        rangeStart = new Date(today);
        rangeEnd.setTime(today.getTime());
        rangeEnd.setDate(today.getDate() + 6);
        break;
      case "thisWeek":
        rangeEnd.setDate(startOfWeek.getDate() + 6);
        break;
      case "nextWeek":
        rangeStart.setDate(startOfWeek.getDate() + 7);
        rangeEnd.setTime(rangeStart.getTime());
        rangeEnd.setDate(rangeEnd.getDate() + 6);
        break;
      case "2weeks":
        rangeEnd.setDate(startOfWeek.getDate() + 13);
        break;
      case "month":
        rangeEnd.setDate(startOfWeek.getDate() + 29);
        break;
    }

    rangeEnd.setHours(23, 59, 59, 999);
    return { rangeStart, rangeEnd };
  }, [calendarRange]);

  // Fetch personal workouts
  const fetchPersonalWorkouts = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const { rangeStart, rangeEnd } = getDateRange();
      // Simple query by userId only to avoid composite index requirement
      const personalQuery = query(
        collection(db, "personalWorkouts"),
        where("userId", "==", user.id)
      );
      const snapshot = await getDocs(personalQuery);
      const allWorkouts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PersonalWorkout[];

      // Filter by date range client-side
      const filteredWorkouts = allWorkouts.filter((w) => {
        const workoutDate = w.date?.toDate?.();
        if (!workoutDate) return false;
        return workoutDate >= rangeStart && workoutDate <= rangeEnd;
      }).sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      setPersonalWorkouts(filteredWorkouts);
    } catch (error) {
      console.error("Error fetching personal workouts:", error);
    } finally {
      setLoadingData(false);
    }
  }, [user, getDateRange]);

  // Get personal workouts for a specific date
  const getPersonalWorkoutsForDate = (date: Date) => {
    const targetDateString = formatDateLocal(date);

    return personalWorkouts.filter((w) => {
      // Use dateString if available (new format), fall back to timestamp comparison
      if (w.dateString) {
        return w.dateString === targetDateString;
      }
      // Legacy fallback for old data without dateString
      const workoutDate = w.date?.toDate?.();
      if (!workoutDate) return false;
      return formatDateLocal(workoutDate) === targetDateString;
    });
  };

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchPersonalWorkouts();
    }
  }, [user, calendarRange, fetchPersonalWorkouts]);

  const { rangeStart, rangeEnd } = getDateRange();

  // Generate array of days for the selected range
  const getCalendarDays = () => {
    const days: { date: Date; dateString: string }[] = [];
    const current = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 12, 0, 0, 0);
    const endDate = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 12, 0, 0, 0);
    while (current <= endDate) {
      // Generate date string directly from components to avoid any timezone issues
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: new Date(current),
        dateString: dateString
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const calendarDays = getCalendarDays();

  const formatDayHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayLabel: string;
    if (date.toDateString() === today.toDateString()) {
      dayLabel = "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = "Tomorrow";
    } else {
      dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
    }

    const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { day: dayLabel, date: dateLabel };
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">My Workouts</h1>
          <button
            onClick={() => openAddWorkoutModal()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Workout
          </button>
        </div>

        {/* AI Coach - the centerpiece */}
        <div className="mb-4">
          {hasAICoach ? (
            <PersonalAITrainer
              userId={user.id}
              userPreferences={user.aiCoachPreferences}
              todayPersonalWorkouts={getPersonalWorkoutsForDate(new Date())}
            />
          ) : (
            <Link
              href="/subscribe"
              className="block bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Get Your AI Coach</h3>
                  <p className="text-white/70 text-xs">Personal programming, scaling & advice for your garage gym</p>
                </div>
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { id: "next7days", label: "Next 7 Days" },
            { id: "thisWeek", label: "This Week" },
            { id: "nextWeek", label: "Next Week" },
            { id: "2weeks", label: "2 Weeks" },
            { id: "month", label: "Month" },
          ].map((range) => (
            <button
              key={range.id}
              onClick={() => setCalendarRange(range.id as typeof calendarRange)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                calendarRange === range.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Date Range Display */}
        <div className="text-sm text-gray-500 mb-4">
          {rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          <span className="ml-2 text-gray-400">({personalWorkouts.length} workout{personalWorkouts.length !== 1 ? "s" : ""})</span>
        </div>

        {/* Calendar View */}
        {loadingData ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {calendarDays.map((dayObj) => {
              const dayPersonalWorkouts = getPersonalWorkoutsForDate(dayObj.date);
              const { day: dayLabel, date: dateLabel } = formatDayHeader(dayObj.date);
              const isToday = dayObj.date.toDateString() === new Date().toDateString();
              const totalWorkouts = dayPersonalWorkouts.length;

              return (
                <div
                  key={dayObj.dateString}
                  className={`rounded-lg border ${isToday ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
                >
                  {/* Day Header */}
                  <div className={`flex items-center justify-between px-4 py-2 border-b ${isToday ? "border-blue-200" : "border-gray-100"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isToday ? "text-blue-700" : "text-gray-900"}`}>
                        {dayLabel}
                      </span>
                      <span className={`text-sm ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                        {dateLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalWorkouts > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                          {totalWorkouts} workout{totalWorkouts !== 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        onClick={() => openAddWorkoutModal(dayObj.dateString)}
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                          isToday
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-200 text-gray-600 hover:bg-blue-600 hover:text-white"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Workouts for this day */}
                  <div className="p-2">
                    {totalWorkouts === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-2">No workouts scheduled</p>
                    ) : (
                      <div className="space-y-2">
                        {dayPersonalWorkouts.map((personalWorkout) => (
                          <div
                            key={personalWorkout.id}
                            className={`p-3 rounded-lg border ${personalWorkout.aiSessionId ? "bg-purple-50 border-purple-200" : "bg-green-50 border-green-200"}`}
                          >
                            {/* Header row: badge + action buttons */}
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${personalWorkout.aiSessionId ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                                {personalWorkout.aiSessionId ? "🤖 AI Coach" : "Personal"}
                              </span>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1">
                                {/* Log button - find first WOD component */}
                                {(() => {
                                  const wodComponent = personalWorkout.components.find(c => c.type === "wod");
                                  const liftComponent = personalWorkout.components.find(c => c.type === "lift");
                                  if (wodComponent) {
                                    const scoringType = wodComponent.scoringType || "fortime";
                                    return (
                                      <Link
                                        href={`/workouts/new?name=${encodeURIComponent(wodComponent.title)}&description=${encodeURIComponent(wodComponent.description || "")}&scoringType=${scoringType}`}
                                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Log
                                      </Link>
                                    );
                                  } else if (liftComponent) {
                                    return (
                                      <Link
                                        href={`/workouts/lift?name=${encodeURIComponent(liftComponent.title)}&description=${encodeURIComponent(liftComponent.description || "")}`}
                                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Log
                                      </Link>
                                    );
                                  }
                                  return null;
                                })()}
                                {personalWorkout.aiSessionId && (
                                  <Link
                                    href={`/programming?regen=${personalWorkout.dateString || formatDateLocal(personalWorkout.date.toDate())}&session=${personalWorkout.aiSessionId}`}
                                    className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Regenerate with AI Coach"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </Link>
                                )}
                                <button
                                  onClick={() => openEditWorkoutModal(personalWorkout)}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeletePersonalWorkout(personalWorkout.id)}
                                  className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Full width workout content */}
                            <div className="space-y-2">
                              {personalWorkout.components.map((comp) => (
                                <div key={comp.id} className="border-l-2 border-gray-200 pl-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                      {workoutComponentLabels[comp.type] || comp.type}
                                    </span>
                                    <span className="font-medium text-gray-900 text-sm">{comp.title}</span>
                                  </div>
                                  {comp.description && (
                                    <p className="text-gray-700 text-xs whitespace-pre-wrap mt-1 ml-1">{comp.description}</p>
                                  )}
                                  {comp.notes && (
                                    <div className="mt-2 ml-1 p-2 bg-amber-50 rounded border-l-2 border-amber-300">
                                      <p className="text-amber-800 text-xs whitespace-pre-line">{comp.notes}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state when no workouts at all */}
            {personalWorkouts.length === 0 && !loadingData && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center mt-4">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-gray-500 mb-2">No workouts scheduled for this period</p>
                <p className="text-gray-400 text-sm mb-4">Let your AI Coach build your week, or add your own workout</p>
                <Link
                  href="/programming"
                  className="inline-block px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Ask AI Coach to Program My Week
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingPersonalWorkoutId ? "Edit Workout" : "Add Personal Workout"}
            </h2>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={newWorkoutDate}
                  onChange={(e) => setNewWorkoutDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Workout Components Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workout Components</p>
                  <span className="text-xs text-gray-400">
                    {workoutComponents.length} added
                  </span>
                </div>

                {/* Add Component Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["warmup", "wod", "lift", "skill", "cooldown"] as WorkoutComponentType[]).map((type) => {
                    const hasType = workoutComponents.some(c => c.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addComponent(type)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          hasType
                            ? `${workoutComponentColors[type].bg} ${workoutComponentColors[type].text}`
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <span>+</span>
                        {workoutComponentLabels[type]}
                      </button>
                    );
                  })}
                </div>

                {/* Added Components List */}
                {workoutComponents.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    Add workout components above
                  </p>
                ) : (
                  <div className="space-y-3">
                    {workoutComponents.map((comp) => (
                      <div key={comp.id} className={`border-l-4 ${workoutComponentColors[comp.type].bg.replace("100", "300")} bg-gray-50 rounded-r-lg p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type].bg} ${workoutComponentColors[comp.type].text}`}>
                            {workoutComponentLabels[comp.type]}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeComponent(comp.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Always show editable fields */}
                        <div className="space-y-2">
                          {/* Preset indicator and unlock button */}
                          {comp.isPreset && (
                            <div className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span className="text-xs font-medium text-blue-700">Preset Workout - Fields locked</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateComponent(comp.id, "isPreset", false)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Unlock
                              </button>
                            </div>
                          )}
                          <div className="relative">
                            <input
                              type="text"
                              value={comp.title}
                              onChange={(e) => {
                                if (!comp.isPreset) {
                                  updateComponent(comp.id, "title", e.target.value);
                                }
                              }}
                              onFocus={() => !comp.isPreset && setActiveComponentId(comp.id)}
                              onBlur={() => setTimeout(() => setActiveComponentId(null), 200)}
                              placeholder="Title (e.g., Fran, Back Squat)"
                              className={`w-full px-3 py-1.5 border rounded text-sm text-gray-900 ${
                                comp.isPreset
                                  ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                                  : "bg-white border-gray-300"
                              }`}
                              autoComplete="off"
                              readOnly={comp.isPreset}
                            />
                            {activeComponentId === comp.id && comp.title && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {getFilteredSuggestions(comp.title).length > 0 ? (
                                  getFilteredSuggestions(comp.title).map((workout, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        updateComponent(comp.id, "title", workout.name);
                                        updateComponent(comp.id, "description", workout.description || "");
                                        updateComponent(comp.id, "isPreset", true);
                                        if (workout.scoringType) {
                                          updateComponent(comp.id, "scoringType", workout.scoringType);
                                        }
                                        setActiveComponentId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{workout.name}</span>
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">Preset</span>
                                      </div>
                                      {workout.description && (
                                        <p className="text-gray-500 text-xs truncate">{workout.description}</p>
                                      )}
                                    </button>
                                  ))
                                ) : (
                                  <p className="px-3 py-2 text-gray-500 text-sm">
                                    No matches found
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <textarea
                            value={comp.description}
                            onChange={(e) => {
                              if (!comp.isPreset) {
                                updateComponent(comp.id, "description", e.target.value);
                              }
                            }}
                            placeholder="Description (optional)"
                            rows={2}
                            className={`w-full px-3 py-1.5 border rounded text-sm text-gray-900 ${
                              comp.isPreset
                                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                                : "bg-white border-gray-300"
                            }`}
                            readOnly={comp.isPreset}
                          />

                          {/* Scoring Type selector for WOD components */}
                          {comp.type === "wod" && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500">Scoring:</span>
                              <div className={`flex rounded-lg overflow-hidden border ${comp.isPreset ? "border-gray-200 opacity-75" : "border-gray-200"}`}>
                                {(["fortime", "emom", "amrap"] as WODScoringType[]).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => !comp.isPreset && updateComponent(comp.id, "scoringType", type)}
                                    disabled={comp.isPreset}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                                      comp.scoringType === type || (!comp.scoringType && type === "fortime")
                                        ? `${wodScoringTypeColors[type].bg} ${wodScoringTypeColors[type].text}`
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                    } ${comp.isPreset ? "cursor-not-allowed" : ""}`}
                                  >
                                    {wodScoringTypeLabels[type]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWorkoutModal(false);
                    resetWorkoutForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePersonalWorkout}
                  disabled={!newWorkoutDate || workoutComponents.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingPersonalWorkoutId ? "Update Workout" : "Save Workout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
