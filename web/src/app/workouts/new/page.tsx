"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WODCategory, WorkoutResultType, normalizeWorkoutName } from "@/lib/types";
import Navigation from "@/components/Navigation";

function NewWorkoutContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wodTitle, setWodTitle] = useState(searchParams.get("name") || "");
  const [wodDescription, setWodDescription] = useState(searchParams.get("description") || "");
  const [resultType, setResultType] = useState<WorkoutResultType>("time");
  const [category, setCategory] = useState<WODCategory>("RX");
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

  // Other result types
  const [rounds, setRounds] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

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

    setSubmitting(true);

    try {
      const now = Timestamp.now();
      const timeInSeconds = getFinalTimeInSeconds();

      // Create workout log data
      const logData: Record<string, unknown> = {
        userId: user.id,
        wodTitle: wodTitle.trim(),
        wodDescription: wodDescription.trim(),
        resultType,
        notes: category,
        isPersonalRecord,
        workoutDate: now,
        completedDate: now,
      };

      // Add result based on type
      if (resultType === "time") {
        logData.timeInSeconds = timeInSeconds;
      } else if (resultType === "rounds") {
        logData.rounds = parseInt(rounds) || 0;
      } else if (resultType === "reps") {
        logData.reps = parseInt(reps) || 0;
      } else if (resultType === "weight") {
        logData.weight = parseFloat(weight) || 0;
      }

      // Add to workoutLogs
      const workoutLogRef = await addDoc(collection(db, "workoutLogs"), logData);

      // Add to leaderboardEntries
      await addDoc(collection(db, "leaderboardEntries"), {
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userGender: user.gender,
        workoutLogId: workoutLogRef.id,
        normalizedWorkoutName: normalizeWorkoutName(wodTitle.trim()),
        originalWorkoutName: wodTitle.trim(),
        resultType,
        timeInSeconds: resultType === "time" ? timeInSeconds : undefined,
        rounds: resultType === "rounds" ? parseInt(rounds) || 0 : undefined,
        reps: resultType === "reps" ? parseInt(reps) || 0 : undefined,
        weight: resultType === "weight" ? parseFloat(weight) || 0 : undefined,
        category,
        completedDate: now,
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
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Log Workout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Workout Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workout Name
              </label>
              <input
                type="text"
                value={wodTitle}
                onChange={(e) => setWodTitle(e.target.value)}
                placeholder="e.g., Fran, Murph, Back Squat"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={wodDescription}
                onChange={(e) => setWodDescription(e.target.value)}
                placeholder="e.g., 21-15-9 Thrusters & Pull-ups"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Result Type */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Result Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(["time", "rounds", "reps", "weight"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setResultType(type)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                    resultType === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Timer / Result Input */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {resultType === "time" ? (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl font-mono text-blue-600 mb-4">
                    {formatTimerDisplay(elapsedSeconds)}
                  </div>
                  <div className="flex justify-center gap-4">
                    <button
                      type="button"
                      onClick={handleStartStop}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
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
                      className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={useManualTime}
                      onChange={(e) => setUseManualTime(e.target.checked)}
                      className="rounded text-blue-600"
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
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      />
                      <span className="text-gray-500">min</span>
                      <input
                        type="number"
                        value={manualSeconds}
                        onChange={(e) => setManualSeconds(e.target.value)}
                        placeholder="0"
                        min="0"
                        max="59"
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      />
                      <span className="text-gray-500">sec</span>
                    </div>
                  )}
                </div>
              </>
            ) : resultType === "rounds" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rounds Completed
                </label>
                <input
                  type="number"
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl text-center"
                />
              </div>
            ) : resultType === "reps" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Reps
                </label>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl text-center"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="2.5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl text-center"
                />
              </div>
            )}
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {(["RX", "Scaled", "Just for Fun"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    category === cat
                      ? cat === "RX"
                        ? "bg-blue-600 text-white"
                        : cat === "Scaled"
                        ? "bg-gray-600 text-white"
                        : "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Personal Record */}
          <label className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <input
              type="checkbox"
              checked={isPersonalRecord}
              onChange={(e) => setIsPersonalRecord(e.target.checked)}
              className="w-5 h-5 rounded text-yellow-500"
            />
            <span className="font-medium text-gray-700">👑 This is a Personal Record (PR)</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : "Save Workout"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <NewWorkoutContent />
    </Suspense>
  );
}
