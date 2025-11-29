"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, WorkoutType } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface WorkoutGroup {
  id: string;
  name: string;
}

export default function WeeklyPlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [groups, setGroups] = useState<Record<string, WorkoutGroup>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newWorkout, setNewWorkout] = useState({
    wodTitle: "",
    wodDescription: "",
    workoutType: "wod" as WorkoutType,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchWorkouts();
      fetchGroups();
    }
  }, [user, weekStart]);

  const fetchGroups = async () => {
    try {
      const groupsQuery = query(collection(db, "workoutGroups"));
      const snapshot = await getDocs(groupsQuery);
      const groupsMap: Record<string, WorkoutGroup> = {};
      snapshot.docs.forEach((doc) => {
        groupsMap[doc.id] = { id: doc.id, name: doc.data().name };
      });
      setGroups(groupsMap);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const fetchWorkouts = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("date", ">=", Timestamp.fromDate(weekStart)),
        where("date", "<", Timestamp.fromDate(weekEnd)),
        orderBy("date", "asc")
      );
      const snapshot = await getDocs(workoutsQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledWorkout[];
      setWorkouts(data);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddWorkout = async () => {
    if (!user || !selectedDate || !newWorkout.wodTitle) return;

    try {
      await addDoc(collection(db, "scheduledWorkouts"), {
        wodTitle: newWorkout.wodTitle,
        wodDescription: newWorkout.wodDescription,
        workoutType: newWorkout.workoutType,
        date: Timestamp.fromDate(selectedDate),
        groupIds: [],
        createdBy: user.id,
        recurrenceType: "none",
      });
      setShowAddModal(false);
      setNewWorkout({ wodTitle: "", wodDescription: "", workoutType: "wod" });
      fetchWorkouts();
    } catch (error) {
      console.error("Error adding workout:", error);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm("Delete this workout?")) return;

    try {
      await deleteDoc(doc(db, "scheduledWorkouts", workoutId));
      fetchWorkouts();
    } catch (error) {
      console.error("Error deleting workout:", error);
    }
  };

  const handleLogWorkout = (workout: ScheduledWorkout) => {
    const isLift = workout.workoutType?.toLowerCase().includes("lift");
    if (isLift) {
      router.push(`/workouts/lift?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`);
    } else {
      router.push(`/workouts/new?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`);
    }
  };

  const navigateWeek = (direction: number) => {
    const newWeek = new Date(weekStart);
    newWeek.setDate(newWeek.getDate() + direction * 7);
    setWeekStart(newWeek);
  };

  const getDaysOfWeek = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getWorkoutsForDay = (date: Date) => {
    return workouts.filter((w) => {
      const workoutDate = w.date?.toDate?.();
      return workoutDate?.toDateString() === date.toDateString();
    });
  };

  const getGroupNames = (groupIds: string[] | undefined) => {
    if (!groupIds || groupIds.length === 0) return [];
    return groupIds.map((id) => groups[id]?.name).filter(Boolean);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const days = getDaysOfWeek();
  const today = new Date();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Plan</h1>
          <button
            onClick={() => {
              setSelectedDate(today);
              setShowAddModal(true);
            }}
            className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold"
          >
            +
          </button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateWeek(-1)}
            className="text-blue-600 text-2xl font-bold px-2"
          >
            &lt;
          </button>
          <span className="font-semibold text-gray-900">
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
            {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <button
            onClick={() => navigateWeek(1)}
            className="text-blue-600 text-2xl font-bold px-2"
          >
            &gt;
          </button>
        </div>

        {/* Workouts List */}
        {loadingData ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => {
              const dayWorkouts = getWorkoutsForDay(day);
              if (dayWorkouts.length === 0) return null;

              const isToday = day.toDateString() === today.toDateString();
              const dayName = day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

              return (
                <div key={day.toISOString()} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Day Header */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="text-xs text-gray-500 font-medium">{dayName}</div>
                    <div className={`text-2xl font-bold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Workouts for this day */}
                  <div className="divide-y divide-gray-100">
                    {dayWorkouts.map((workout) => {
                      const groupNames = getGroupNames(workout.groupIds);
                      const workoutWithClassTimes = workout as unknown as { classTimes?: string[] };
                      const hasClassTimes = workoutWithClassTimes.classTimes && workoutWithClassTimes.classTimes.length > 0;

                      return (
                        <div key={workout.id} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-bold text-gray-900">{workout.wodTitle}</h3>
                                {groupNames.length > 0 && groupNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white"
                                  >
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                    </svg>
                                    {name}
                                  </span>
                                ))}
                                {groupNames.length === 0 && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                    </svg>
                                    Members
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm mb-3">{workout.wodDescription}</p>

                              {hasClassTimes && workoutWithClassTimes.classTimes && (
                                <p className="text-gray-500 text-sm mb-3">
                                  {workoutWithClassTimes.classTimes.length} class times available
                                </p>
                              )}

                              <div className="flex items-center gap-2 flex-wrap">
                                {hasClassTimes && (
                                  <button
                                    className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors"
                                  >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Sign Up
                                  </button>
                                )}
                                <button
                                  onClick={() => handleLogWorkout(workout)}
                                  className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors"
                                >
                                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Log
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteWorkout(workout.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Empty state - show all days with add buttons */}
            {workouts.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">No workouts scheduled this week</p>
                <button
                  onClick={() => {
                    setSelectedDate(today);
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold"
                >
                  Add First Workout
                </button>
              </div>
            )}

            {/* Quick add for days without workouts */}
            {workouts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-sm text-gray-500 mb-3">Add workout to:</p>
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => {
                    const dayWorkouts = getWorkoutsForDay(day);
                    const isToday = day.toDateString() === today.toDateString();
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => {
                          setSelectedDate(day);
                          setShowAddModal(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                          isToday
                            ? "border-blue-500 text-blue-600 bg-blue-50"
                            : dayWorkouts.length > 0
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {day.toLocaleDateString("en-US", { weekday: "short" })} {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Workout Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Workout for {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workout Name
                  </label>
                  <input
                    type="text"
                    value={newWorkout.wodTitle}
                    onChange={(e) => setNewWorkout({ ...newWorkout, wodTitle: e.target.value })}
                    placeholder="e.g., Fran, Back Squat"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newWorkout.wodDescription}
                    onChange={(e) => setNewWorkout({ ...newWorkout, wodDescription: e.target.value })}
                    placeholder="e.g., 21-15-9 Thrusters & Pull-ups"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="workoutType"
                        checked={newWorkout.workoutType === "wod"}
                        onChange={() => setNewWorkout({ ...newWorkout, workoutType: "wod" })}
                        className="text-blue-600"
                      />
                      <span>WOD</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="workoutType"
                        checked={newWorkout.workoutType === "lift"}
                        onChange={() => setNewWorkout({ ...newWorkout, workoutType: "lift" })}
                        className="text-purple-600"
                      />
                      <span>Lift</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWorkout}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Workout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
