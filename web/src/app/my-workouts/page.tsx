"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutComponent, WorkoutComponentType, workoutComponentLabels, workoutComponentColors } from "@/lib/types";
import Navigation from "@/components/Navigation";

// Personal workout log entry
interface PersonalWorkout {
  id: string;
  userId: string;
  date: Date;
  components: WorkoutComponent[];
  notes?: string;
  duration?: number; // in minutes
  feeling?: "great" | "good" | "okay" | "tired" | "exhausted";
  createdAt: Date;
}

export default function MyWorkoutsPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();

  // Workouts state
  const [workouts, setWorkouts] = useState<PersonalWorkout[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Calendar state
  const [calendarRange, setCalendarRange] = useState<"thisWeek" | "nextWeek" | "2weeks" | "month">("thisWeek");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);

  // Form state
  const [newWorkoutDate, setNewWorkoutDate] = useState(new Date().toISOString().split("T")[0]);
  const [workoutComponents, setWorkoutComponents] = useState<WorkoutComponent[]>([]);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState("");
  const [workoutFeeling, setWorkoutFeeling] = useState<PersonalWorkout["feeling"]>("good");

  // Component editing state
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingComponentTitle, setEditingComponentTitle] = useState("");
  const [editingComponentDescription, setEditingComponentDescription] = useState("");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user, calendarRange]);

  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    let rangeStart = new Date(startOfWeek);
    let rangeEnd = new Date(startOfWeek);

    switch (calendarRange) {
      case "thisWeek":
        rangeEnd.setDate(startOfWeek.getDate() + 6);
        break;
      case "nextWeek":
        rangeStart.setDate(startOfWeek.getDate() + 7);
        rangeEnd = new Date(rangeStart);
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
  };

  const { rangeStart, rangeEnd } = getDateRange();

  // Generate calendar days
  const calendarDays: Date[] = [];
  const currentDay = new Date(rangeStart);
  while (currentDay <= rangeEnd) {
    calendarDays.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }

  const fetchWorkouts = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const { rangeStart, rangeEnd } = getDateRange();

      // Query personal workouts
      const workoutsQuery = query(
        collection(db, "personalWorkouts"),
        where("userId", "==", user.id),
        where("date", ">=", Timestamp.fromDate(rangeStart)),
        where("date", "<=", Timestamp.fromDate(rangeEnd)),
        orderBy("date", "asc")
      );

      const snapshot = await getDocs(workoutsQuery);
      const workoutsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          date: data.date.toDate(),
          components: data.components || [],
          notes: data.notes,
          duration: data.duration,
          feeling: data.feeling,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PersonalWorkout;
      });

      setWorkouts(workoutsData);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(
      (w) => w.date.toDateString() === date.toDateString()
    );
  };

  const formatDayHeader = (date: Date) => {
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { day, date: dateStr };
  };

  // Component management
  const addComponent = (type: WorkoutComponentType) => {
    const newComponent: WorkoutComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      title: "",
      description: "",
    };
    setWorkoutComponents([...workoutComponents, newComponent]);
    setEditingComponentId(newComponent.id);
    setEditingComponentTitle("");
    setEditingComponentDescription("");
  };

  const removeComponent = (id: string) => {
    setWorkoutComponents(workoutComponents.filter((c) => c.id !== id));
    if (editingComponentId === id) {
      setEditingComponentId(null);
    }
  };

  const startEditComponent = (comp: WorkoutComponent) => {
    setEditingComponentId(comp.id);
    setEditingComponentTitle(comp.title);
    setEditingComponentDescription(comp.description || "");
  };

  const saveComponentEdit = () => {
    if (!editingComponentId) return;
    setWorkoutComponents(
      workoutComponents.map((c) =>
        c.id === editingComponentId
          ? { ...c, title: editingComponentTitle, description: editingComponentDescription }
          : c
      )
    );
    setEditingComponentId(null);
    setEditingComponentTitle("");
    setEditingComponentDescription("");
  };

  // Save workout
  const handleSaveWorkout = async () => {
    if (!user || workoutComponents.length === 0) return;

    try {
      const workoutData = {
        userId: user.id,
        date: Timestamp.fromDate(new Date(newWorkoutDate)),
        components: workoutComponents,
        notes: workoutNotes || null,
        duration: workoutDuration ? parseInt(workoutDuration) : null,
        feeling: workoutFeeling,
        createdAt: Timestamp.now(),
      };

      if (editingWorkoutId) {
        await updateDoc(doc(db, "personalWorkouts", editingWorkoutId), workoutData);
      } else {
        await addDoc(collection(db, "personalWorkouts"), workoutData);
      }

      // Reset form
      resetForm();
      setShowAddModal(false);
      fetchWorkouts();
    } catch (error) {
      console.error("Error saving workout:", error);
      alert("Error saving workout. Please try again.");
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm("Delete this workout?")) return;

    try {
      await deleteDoc(doc(db, "personalWorkouts", workoutId));
      fetchWorkouts();
    } catch (error) {
      console.error("Error deleting workout:", error);
    }
  };

  const handleEditWorkout = (workout: PersonalWorkout) => {
    setEditingWorkoutId(workout.id);
    setNewWorkoutDate(workout.date.toISOString().split("T")[0]);
    setWorkoutComponents(workout.components);
    setWorkoutNotes(workout.notes || "");
    setWorkoutDuration(workout.duration?.toString() || "");
    setWorkoutFeeling(workout.feeling || "good");
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditingWorkoutId(null);
    setNewWorkoutDate(new Date().toISOString().split("T")[0]);
    setWorkoutComponents([]);
    setWorkoutNotes("");
    setWorkoutDuration("");
    setWorkoutFeeling("good");
    setEditingComponentId(null);
  };

  const openAddModal = (date?: Date) => {
    resetForm();
    if (date) {
      setNewWorkoutDate(date.toISOString().split("T")[0]);
    }
    setShowAddModal(true);
  };

  const feelingEmojis: Record<NonNullable<PersonalWorkout["feeling"]>, string> = {
    great: "🔥",
    good: "💪",
    okay: "😐",
    tired: "😓",
    exhausted: "😵",
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Workouts</h1>
            <p className="text-gray-500 text-sm">Track your personal training</p>
          </div>
          <button
            onClick={() => openAddModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Log Workout
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
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
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Date Range Display */}
        <div className="text-sm text-gray-500 mb-4">
          {rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          <span className="ml-2 text-gray-400">({workouts.length} workout{workouts.length !== 1 ? "s" : ""} logged)</span>
        </div>

        {/* Calendar View */}
        {loadingData ? (
          <div className="text-center py-12 text-gray-500">Loading workouts...</div>
        ) : (
          <div className="space-y-3">
            {calendarDays.map((day) => {
              const dayWorkouts = getWorkoutsForDate(day);
              const { day: dayLabel, date: dateLabel } = formatDayHeader(day);
              const isToday = day.toDateString() === new Date().toDateString();
              const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-xl border ${
                    isToday ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Day Header */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isToday ? "border-blue-200" : "border-gray-100"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isToday ? "text-blue-700" : "text-gray-900"}`}>
                        {dayLabel}
                      </span>
                      <span className={`text-sm ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                        {dateLabel}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Today</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dayWorkouts.length > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                          {dayWorkouts.length} workout{dayWorkouts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        onClick={() => openAddModal(day)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                          isToday
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Workouts for this day */}
                  <div className="p-3">
                    {dayWorkouts.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-3">
                        {isPast ? "No workout logged" : "No workout planned"}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dayWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {workout.feeling && (
                                  <span className="text-xl" title={workout.feeling}>
                                    {feelingEmojis[workout.feeling]}
                                  </span>
                                )}
                                {workout.duration && (
                                  <span className="text-sm text-gray-500">
                                    {workout.duration} min
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditWorkout(workout)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkout(workout.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* Components */}
                            <div className="space-y-2">
                              {workout.components.map((comp) => (
                                <div key={comp.id} className="border-l-2 border-gray-200 pl-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                      {workoutComponentLabels[comp.type] || comp.type}
                                    </span>
                                    <span className="font-medium text-gray-900 text-sm">{comp.title}</span>
                                  </div>
                                  {comp.description && (
                                    <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap">{comp.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Notes */}
                            {workout.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm text-gray-600">{workout.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Workout Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingWorkoutId ? "Edit Workout" : "Log Workout"}
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

              {/* Duration & Feeling Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(e.target.value)}
                    placeholder="60"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How did it feel?
                  </label>
                  <div className="flex gap-1">
                    {(["great", "good", "okay", "tired", "exhausted"] as const).map((feeling) => (
                      <button
                        key={feeling}
                        type="button"
                        onClick={() => setWorkoutFeeling(feeling)}
                        className={`flex-1 py-2 text-xl rounded-lg transition-colors ${
                          workoutFeeling === feeling
                            ? "bg-blue-100 ring-2 ring-blue-500"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                        title={feeling}
                      >
                        {feelingEmojis[feeling]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Workout Components Section */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Workout Components</p>

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
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEditComponent(comp)}
                              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => removeComponent(comp.id)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {editingComponentId === comp.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingComponentTitle}
                              onChange={(e) => setEditingComponentTitle(e.target.value)}
                              placeholder="Title (e.g., Back Squat 5x5)"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                              autoFocus
                            />
                            <textarea
                              value={editingComponentDescription}
                              onChange={(e) => setEditingComponentDescription(e.target.value)}
                              placeholder="Description / notes (optional)"
                              rows={2}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                            />
                            <button
                              type="button"
                              onClick={saveComponentEdit}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-gray-900 text-sm">{comp.title || "(No title)"}</p>
                            {comp.description && (
                              <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap">{comp.description}</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  placeholder="How the workout went, PRs, things to remember..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(false);
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWorkout}
                disabled={workoutComponents.length === 0 || workoutComponents.some(c => !c.title)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {editingWorkoutId ? "Save Changes" : "Log Workout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
