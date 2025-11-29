"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WODCategory, normalizeWorkoutName } from "@/lib/types";
import Navigation from "@/components/Navigation";

function NewWorkoutContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wodTitle, setWodTitle] = useState(searchParams.get("name") || "");
  const [wodDescription, setWodDescription] = useState(searchParams.get("description") || "");
  const [category, setCategory] = useState<WODCategory>("RX");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartStop = () => {
    setTimerRunning(!timerRunning);
  };

  const handleReset = () => {
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  const getTimeFromManual = (): number => {
    const mins = parseInt(manualMinutes) || 0;
    const secs = parseInt(manualSeconds) || 0;
    return mins * 60 + secs;
  };

  const isManualEntryValid = () => {
    const mins = parseInt(manualMinutes) || 0;
    const secs = parseInt(manualSeconds) || 0;
    return mins > 0 || secs > 0;
  };

  const handleSaveTimer = async () => {
    if (!user || !wodTitle.trim()) return;
    if (elapsedSeconds === 0) {
      setError("Please start the timer or enter a time manually");
      return;
    }
    await saveWorkout(elapsedSeconds);
  };

  const handleSaveManual = async () => {
    if (!user || !wodTitle.trim()) return;
    if (!isManualEntryValid()) {
      setError("Please enter a valid time");
      return;
    }
    await saveWorkout(getTimeFromManual());
  };

  const saveWorkout = async (timeInSeconds: number) => {
    setError("");
    setSubmitting(true);

    try {
      const now = Timestamp.now();
      const workoutDate = Timestamp.fromDate(new Date(entryDate));

      // Add to workoutLogs
      const workoutLogRef = await addDoc(collection(db, "workoutLogs"), {
        userId: user!.id,
        wodTitle: wodTitle.trim(),
        wodDescription: wodDescription.trim(),
        resultType: "time",
        timeInSeconds,
        notes: category,
        isPersonalRecord: false,
        workoutDate,
        completedDate: now,
      });

      // Add to leaderboardEntries
      await addDoc(collection(db, "leaderboardEntries"), {
        userId: user!.id,
        userName: user!.displayName || `${user!.firstName} ${user!.lastName}`,
        userGender: user!.gender,
        workoutLogId: workoutLogRef.id,
        normalizedWorkoutName: normalizeWorkoutName(wodTitle.trim()),
        originalWorkoutName: wodTitle.trim(),
        resultType: "time",
        timeInSeconds,
        category,
        completedDate: workoutDate,
        createdAt: now,
      });

      router.push("/workouts");
    } catch (err) {
      console.error("Error logging workout:", err);
      setError("Failed to log workout. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Workout Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <input
            type="text"
            value={wodTitle}
            onChange={(e) => setWodTitle(e.target.value)}
            placeholder="Workout Name"
            className="w-full text-xl font-bold text-gray-900 border-none focus:ring-0 p-0 mb-2 placeholder-gray-400"
          />
          <textarea
            value={wodDescription}
            onChange={(e) => setWodDescription(e.target.value)}
            placeholder="21-15-9 Thrusters & Pull-ups"
            rows={2}
            className="w-full text-gray-500 text-sm border-none focus:ring-0 p-0 resize-none placeholder-gray-300"
          />
        </div>

        {/* Timer Display */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="text-center mb-4">
            <div className="text-5xl font-mono font-semibold text-gray-900 tracking-tight">
              {formatTimerDisplay(elapsedSeconds)}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex justify-center gap-3 mb-4">
            <button
              type="button"
              onClick={handleStartStop}
              className={`px-8 py-2.5 rounded-xl font-semibold transition-colors ${
                timerRunning
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {timerRunning ? "Stop" : "Start"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-xl font-semibold transition-colors"
            >
              Reset
            </button>
            {elapsedSeconds > 0 && !timerRunning && (
              <button
                type="button"
                onClick={handleSaveTimer}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:bg-blue-300"
              >
                Save
              </button>
            )}
          </div>

          {/* Category Picker */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Category</p>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["RX", "Scaled", "Just for Fun"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    category === cat
                      ? cat === "RX"
                        ? "bg-blue-600 text-white"
                        : cat === "Scaled"
                        ? "bg-gray-600 text-white"
                        : "bg-green-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4"></div>

          {/* Manual Entry */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-semibold">Manual Entry</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">Minutes</p>
                <input
                  type="number"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">Seconds</p>
                <input
                  type="number"
                  value={manualSeconds}
                  onChange={(e) => setManualSeconds(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="59"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">Date</p>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveManual}
                disabled={submitting || !isManualEntryValid() || !wodTitle.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <NewWorkoutContent />
    </Suspense>
  );
}
