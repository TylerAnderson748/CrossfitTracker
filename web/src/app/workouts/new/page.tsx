"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { normalizeWorkoutName } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function NewWorkoutPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [wodTitle, setWodTitle] = useState("");
  const [wodDescription, setWodDescription] = useState("");
  const [notes, setNotes] = useState("RX");
  const [resultType, setResultType] = useState<"time" | "reps" | "rounds">("time");
  const [isPersonalRecord, setIsPersonalRecord] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [useManualTime, setUseManualTime] = useState(false);
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
    setUseManualTime(false);
  };

  const handleReset = () => {
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  const getFinalTimeInSeconds = (): number => {
    if (useManualTime) {
      const mins = parseInt(manualMinutes) || 0;
      const secs = parseInt(manualSeconds) || 0;
      return mins * 60 + secs;
    }
    return elapsedSeconds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) return;

    if (!wodTitle.trim()) {
      setError("Please enter a workout name");
      return;
    }

    const timeInSeconds = getFinalTimeInSeconds();
    if (timeInSeconds <= 0) {
      setError("Please enter a valid time");
      return;
    }

    setSubmitting(true);

    try {
      const now = Timestamp.now();

      // Add to workoutLogs
      const workoutLogRef = await addDoc(collection(db, "workoutLogs"), {
        wodTitle: wodTitle.trim(),
        wodDescription: wodDescription.trim(),
        timeInSeconds,
        resultType,
        notes,
        isPersonalRecord,
        userId: user.id,
        completedDate: now,
        workoutDate: now,
      });

      // Add to leaderboardEntries
      await addDoc(collection(db, "leaderboardEntries"), {
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userId: user.id,
        timeInSeconds,
        resultType,
        originalWorkoutName: wodTitle.trim(),
        normalizedWorkoutName: normalizeWorkoutName(wodTitle.trim()),
        completedDate: now,
        createdAt: now,
        workoutLogId: workoutLogRef.id,
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Log Workout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded">
              {error}
            </div>
          )}

          {/* Workout Name */}
          <div>
            <label htmlFor="wodTitle" className="block text-sm font-medium text-gray-300 mb-1">
              Workout Name
            </label>
            <input
              type="text"
              id="wodTitle"
              value={wodTitle}
              onChange={(e) => setWodTitle(e.target.value)}
              placeholder="e.g., Fran, Murph, Kelly..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
              required
            />
          </div>

          {/* Workout Description */}
          <div>
            <label htmlFor="wodDescription" className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="wodDescription"
              value={wodDescription}
              onChange={(e) => setWodDescription(e.target.value)}
              placeholder="e.g., 21-15-9 Thrusters & Pull-ups"
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
            />
          </div>

          {/* Timer Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Timer</h2>

            {/* Timer Display */}
            <div className="text-center mb-6">
              <div className="text-6xl font-mono text-orange-500 mb-4">
                {formatTimerDisplay(elapsedSeconds)}
              </div>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleStartStop}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    timerRunning
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {timerRunning ? "Stop" : "Start"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Manual Time Entry */}
            <div className="border-t border-gray-700 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <input
                  type="checkbox"
                  checked={useManualTime}
                  onChange={(e) => setUseManualTime(e.target.checked)}
                  className="rounded"
                />
                Enter time manually
              </label>
              {useManualTime && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-center text-white"
                  />
                  <span className="text-gray-400">min</span>
                  <input
                    type="number"
                    value={manualSeconds}
                    onChange={(e) => setManualSeconds(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="59"
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-center text-white"
                  />
                  <span className="text-gray-400">sec</span>
                </div>
              )}
            </div>
          </div>

          {/* Result Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Result Type</label>
            <div className="flex gap-4">
              {(["time", "reps", "rounds"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="resultType"
                    value={type}
                    checked={resultType === type}
                    onChange={(e) => setResultType(e.target.value as typeof resultType)}
                    className="text-orange-500"
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category / Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {["RX+", "RX", "Scaled", "Just Happy To Be Here"].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setNotes(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    notes === category
                      ? "bg-orange-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Personal Record */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPersonalRecord}
              onChange={(e) => setIsPersonalRecord(e.target.checked)}
              className="rounded text-orange-500"
            />
            <span>This is a Personal Record (PR)</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : "Save Workout"}
          </button>
        </form>
      </main>
    </div>
  );
}
