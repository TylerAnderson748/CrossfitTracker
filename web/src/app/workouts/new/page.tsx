"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WODCategory, normalizeWorkoutName, LeaderboardEntry, formatResult } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface WorkoutLog {
  id: string;
  timeInSeconds: number;
  completedDate: { toDate: () => Date };
  notes: string;
}

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

  // History and leaderboard
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardFilter, setLeaderboardFilter] = useState<"everyone" | "gym">("everyone");
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">("all");
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

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

  useEffect(() => {
    if (user) {
      if (wodTitle) {
        loadHistory();
      }
      loadLeaderboard();
    }
  }, [user, wodTitle, leaderboardFilter, genderFilter]);

  const loadHistory = async () => {
    if (!user || !wodTitle) return;
    try {
      const q = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        where("wodTitle", "==", wodTitle.trim()),
        orderBy("completedDate", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      setHistory(results);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      let entries: LeaderboardEntry[] = [];

      if (wodTitle) {
        // Try to match by normalized workout name
        const normalized = normalizeWorkoutName(wodTitle.trim());
        console.log("Looking for workout:", normalized);

        const q = query(
          collection(db, "leaderboardEntries"),
          where("normalizedWorkoutName", "==", normalized),
          limit(50)
        );

        const snapshot = await getDocs(q);
        entries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LeaderboardEntry[];

        console.log("Found entries:", entries.length);
      }

      // If no workout specified or no matches, show all recent entries
      if (entries.length === 0) {
        const allQuery = query(
          collection(db, "leaderboardEntries"),
          limit(50)
        );
        const allSnapshot = await getDocs(allQuery);
        entries = allSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LeaderboardEntry[];
        console.log("Loaded all entries:", entries.length);
      }

      // Filter to only time-based results
      entries = entries.filter((e) => e.resultType === "time" && e.timeInSeconds);

      // Apply gender filter
      if (genderFilter !== "all") {
        entries = entries.filter((e) => e.userGender === genderFilter);
      }

      // Sort by time (fastest first)
      entries.sort((a, b) => (a.timeInSeconds || 0) - (b.timeInSeconds || 0));

      setLeaderboard(entries.slice(0, 10));
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

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

  const getRankColor = (index: number) => {
    if (index === 0) return "bg-yellow-400";
    if (index === 1) return "bg-gray-300";
    if (index === 2) return "bg-amber-600";
    return "bg-gray-100";
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

        {/* Progress Chart */}
        {history.length > 0 && (
          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Progress</p>
            {history.length > 1 ? (
              <div className="h-24 flex items-end gap-1">
                {history.slice(0, 10).reverse().map((log, i) => {
                  const maxTime = Math.max(...history.map((h) => h.timeInSeconds));
                  const height = (log.timeInSeconds / maxTime) * 100;
                  return (
                    <div key={log.id} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${height}%`, minHeight: "4px" }}
                        title={formatTimerDisplay(log.timeInSeconds)}
                      ></div>
                      <span className="text-[10px] text-gray-400 mt-1">
                        {log.completedDate?.toDate().toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">Add more entries to see progress chart</p>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {wodTitle && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Leaderboard</p>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => setLeaderboardFilter("gym")}
                  className={`px-3 py-1.5 font-medium ${
                    leaderboardFilter === "gym" ? "bg-blue-600 text-white" : "bg-white text-gray-600"
                  }`}
                >
                  Gym
                </button>
                <button
                  onClick={() => setLeaderboardFilter("everyone")}
                  className={`px-3 py-1.5 font-medium ${
                    leaderboardFilter === "everyone" ? "bg-blue-600 text-white" : "bg-white text-gray-600"
                  }`}
                >
                  Everyone
                </button>
              </div>
            </div>

            {/* Gender Filter */}
            <div className="flex justify-end mb-3">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                {(["all", "Male", "Female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`px-3 py-1.5 font-medium ${
                      genderFilter === g ? "bg-blue-600 text-white" : "bg-white text-gray-600"
                    }`}
                  >
                    {g === "all" ? "All" : g}
                  </button>
                ))}
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No entries yet</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex items-center gap-3 py-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index < 3 ? getRankColor(index) + " text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.userName}
                        {entry.userId === user?.id && (
                          <span className="text-blue-600 text-xs ml-1">(You)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">
                          {formatTimerDisplay(entry.timeInSeconds || 0)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          entry.category === "RX"
                            ? "bg-blue-100 text-blue-700"
                            : entry.category === "Scaled"
                            ? "bg-gray-200 text-gray-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {entry.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
