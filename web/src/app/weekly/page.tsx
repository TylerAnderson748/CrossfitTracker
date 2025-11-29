"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, WorkoutType } from "@/lib/types";
import Navigation from "@/components/Navigation";

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
    }
  }, [user, weekStart]);

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const days = getDaysOfWeek();
  const today = new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Weekly Plan</h1>
            <p className="text-gray-500">Schedule and view your workouts</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Prev
            </button>
            <span className="font-medium text-gray-700">
              {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
              {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Week Grid */}
        {loadingData ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Loading workouts...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {days.map((day) => {
              const isToday = day.toDateString() === today.toDateString();
              const dayWorkouts = getWorkoutsForDay(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`bg-white rounded-xl shadow-sm border ${
                    isToday ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200"
                  } p-4 min-h-[200px]`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        {day.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                        {day.getDate()}
                      </div>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-semibold rounded">
                        TODAY
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {dayWorkouts.map((workout) => (
                      <div
                        key={workout.id}
                        className={`p-2 rounded-lg text-sm ${
                          workout.workoutType === "lift"
                            ? "bg-purple-50 border border-purple-200"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="font-medium text-gray-900 truncate">
                            {workout.wodTitle}
                          </div>
                          <button
                            onClick={() => handleDeleteWorkout(workout.id)}
                            className="text-gray-400 hover:text-red-500 ml-1"
                          >
                            ×
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {workout.wodDescription}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDate(day);
                      setShowAddModal(true);
                    }}
                    className="mt-2 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    + Add Workout
                  </button>
                </div>
              );
            })}
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
