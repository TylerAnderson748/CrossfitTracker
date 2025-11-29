"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, getDocs, Timestamp, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";

interface LiftResult {
  id: string;
  liftName: string;
  weight: number;
  reps: number;
  userId: string;
  userName?: string;
  gymId?: string;
  date: { toDate: () => Date };
}

function LiftPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if coming from a scheduled lift (has name in URL)
  const urlLiftName = searchParams.get("name") || "";
  const isFromSchedule = !!urlLiftName;

  const [liftName, setLiftName] = useState(urlLiftName);
  const [selectedReps, setSelectedReps] = useState(1);
  const [weight, setWeight] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<LiftResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<LiftResult[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardScope, setLeaderboardScope] = useState<"gym" | "everyone">("everyone");

  // Edit history state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState(1);
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && liftName) {
      loadHistory();
      loadLeaderboard();
    }
  }, [user, liftName, selectedReps, leaderboardScope]);

  const loadHistory = async () => {
    if (!user || !liftName) return;
    try {
      const q = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const allResults = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];

      const filtered = allResults
        .filter((r) => r.liftName === liftName && r.reps === selectedReps)
        .sort((a, b) => {
          const dateA = a.date?.toDate?.() || new Date(0);
          const dateB = b.date?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10);

      setHistory(filtered);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const loadLeaderboard = async () => {
    if (!liftName) return;
    setLoadingLeaderboard(true);
    try {
      const q = query(
        collection(db, "liftResults"),
        where("liftName", "==", liftName),
        limit(100)
      );
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];

      // Filter by reps
      results = results.filter((r) => r.reps === selectedReps);

      // Filter by gym if scope is gym
      if (leaderboardScope === "gym" && user?.gymId) {
        results = results.filter((r) => r.gymId === user.gymId);
      }

      // Sort by weight descending
      results.sort((a, b) => b.weight - a.weight);

      setLeaderboard(results.slice(0, 10));
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const latestWeight = history.length > 0 ? history[0].weight : null;

  const handleSubmit = async () => {
    setError("");

    if (!user) return;

    if (!liftName.trim()) {
      setError("Please select or enter a lift name");
      return;
    }

    if (!weight || parseFloat(weight) <= 0) {
      setError("Please enter a valid weight");
      return;
    }

    setSubmitting(true);

    try {
      const workoutDate = Timestamp.fromDate(new Date(entryDate));

      await addDoc(collection(db, "liftResults"), {
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        gymId: user.gymId || null,
        liftName: liftName.trim(),
        weight: parseFloat(weight),
        reps: selectedReps,
        date: workoutDate,
        isPersonalRecord: false,
      });

      setWeight("");
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error logging lift:", err);
      setError("Failed to log lift. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditLog = (log: LiftResult) => {
    setEditingLogId(log.id);
    setEditWeight(log.weight.toString());
    setEditReps(log.reps);
    const logDate = log.date?.toDate?.();
    if (logDate) {
      setEditDate(logDate.toISOString().split("T")[0]);
    } else {
      setEditDate(new Date().toISOString().split("T")[0]);
    }
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditWeight("");
    setEditReps(1);
    setEditDate("");
  };

  const saveEdit = async (logId: string) => {
    const newWeight = parseFloat(editWeight);
    if (!newWeight || newWeight <= 0) return;

    try {
      const newDate = Timestamp.fromDate(new Date(editDate));

      await updateDoc(doc(db, "liftResults", logId), {
        weight: newWeight,
        reps: editReps,
        date: newDate,
      });

      setEditingLogId(null);
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error updating log:", err);
      setError("Failed to update entry.");
    }
  };

  const deleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await deleteDoc(doc(db, "liftResults", logId));
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error deleting log:", err);
      setError("Failed to delete entry.");
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Calculate training percentages
  const percentages = [
    { pct: 100, color: "text-red-600" },
    { pct: 95, color: "text-red-500" },
    { pct: 90, color: "text-red-400" },
    { pct: 85, color: "text-orange-500" },
    { pct: 80, color: "text-orange-400" },
    { pct: 75, color: "text-yellow-500" },
    { pct: 70, color: "text-yellow-400" },
    { pct: 65, color: "text-green-500" },
    { pct: 60, color: "text-green-400" },
    { pct: 55, color: "text-green-400" },
    { pct: 50, color: "text-blue-400" },
    { pct: 45, color: "text-blue-300" },
  ];

  // Progress chart data
  const chartData = history.slice(0, 10).reverse();
  const weights = chartData.map((h) => h.weight);
  const dataMax = weights.length > 0 ? Math.max(...weights) : 100;
  const dataMin = weights.length > 0 ? Math.min(...weights) : 0;
  const tickInterval = 10;
  const minWeightTick = Math.floor(dataMin / tickInterval) * tickInterval - tickInterval;
  const maxWeightTick = Math.ceil(dataMax / tickInterval) * tickInterval + tickInterval;
  const range = maxWeightTick - minWeightTick || 50;
  const numTicks = Math.ceil(range / tickInterval) + 1;
  const yTicks = Array.from({ length: Math.min(numTicks, 7) }, (_, i) => maxWeightTick - i * tickInterval);

  // Common lifts for selector (only shown when not from schedule)
  const commonLifts = [
    "Back Squat",
    "Front Squat",
    "Deadlift",
    "Bench Press",
    "Overhead Press",
    "Clean",
    "Clean & Jerk",
    "Snatch",
    "Power Clean",
    "Push Press",
    "Thruster",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Lift Title */}
        {isFromSchedule ? (
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">{liftName}</h1>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <input
              type="text"
              value={liftName}
              onChange={(e) => setLiftName(e.target.value)}
              placeholder="Lift Name"
              className="w-full text-xl font-bold text-gray-900 border-none focus:ring-0 p-0 mb-3 placeholder-gray-400"
            />
            <div className="flex flex-wrap gap-2">
              {commonLifts.map((lift) => (
                <button
                  key={lift}
                  type="button"
                  onClick={() => setLiftName(lift)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    liftName === lift
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {lift}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reps Picker */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {[1, 2, 3, 4, 5].map((rep) => (
              <button
                key={rep}
                type="button"
                onClick={() => setSelectedReps(rep)}
                className={`flex-1 py-3 text-lg font-semibold transition-colors ${
                  selectedReps === rep
                    ? "bg-purple-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {rep}
              </button>
            ))}
          </div>
        </div>

        {/* Weight + Date + Save Row */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="2.5"
                  className="w-full px-3 py-2.5 text-center text-lg text-gray-900 border-none focus:ring-0"
                />
                <span className="px-3 py-2.5 bg-gray-50 text-gray-500 border-l border-gray-300">lbs</span>
              </div>
            </div>
            <div className="flex-1">
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !weight || !liftName.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300"
            >
              Save
            </button>
          </div>

          {/* Quick Weight Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {[45, 95, 135, 185, 225, 275, 315, 365, 405].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeight(w.toString())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    weight === w.toString()
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Training Percentages */}
        {latestWeight && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">Training %</p>
              <p className="text-xs text-purple-600 font-medium">
                Based on {latestWeight} lbs x {selectedReps}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              {percentages.map(({ pct, color }) => (
                <div key={pct} className="flex justify-between items-center">
                  <span className={`text-xs font-mono ${color}`}>{pct}%</span>
                  <span className="text-xs font-mono text-gray-600">
                    {Math.round(latestWeight * (pct / 100))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Line Chart */}
        {chartData.length >= 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Progress</p>
            <div className="relative h-40">
              <div className="absolute left-0 top-0 bottom-4 w-10 flex flex-col justify-between text-xs text-gray-400">
                {yTicks.map((tick, i) => (
                  <span key={i}>{tick}</span>
                ))}
              </div>
              <div className="ml-12 h-full relative">
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  {/* Horizontal grid lines */}
                  {yTicks.map((_, i) => {
                    const y = (i / (yTicks.length - 1)) * 100;
                    return <line key={i} x1="10" y1={y} x2="290" y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                  })}
                  {/* Vertical grid lines */}
                  {chartData.map((_, i) => {
                    const x = chartData.length > 1 ? 10 + (i / (chartData.length - 1)) * 280 : 150;
                    return <line key={i} x1={x} y1="0" x2={x} y2="100" stroke="#E5E7EB" strokeWidth="1" />;
                  })}
                  {chartData.length > 1 ? (
                    <path
                      fill="none"
                      stroke="#9333EA"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={chartData.map((d, i) => {
                        const x = 10 + (i / (chartData.length - 1)) * 280;
                        const y = range > 0 ? 100 - ((d.weight - minWeightTick) / range) * 100 : 50;
                        return `${i === 0 ? "M" : "L"} ${x},${y}`;
                      }).join(" ")}
                    />
                  ) : null}
                  {chartData.map((d, i) => {
                    const x = chartData.length > 1 ? 10 + (i / (chartData.length - 1)) * 280 : 150;
                    const y = range > 0 ? 100 - ((d.weight - minWeightTick) / range) * 100 : 50;
                    return <circle key={i} cx={x} cy={y} r="3" fill="#9333EA" />;
                  })}
                </svg>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {chartData.map((d, i) => (
                    <span key={i}>{d.date?.toDate?.().toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) || "N/A"}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {liftName && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">
                Leaderboard ({selectedReps} rep{selectedReps > 1 ? "s" : ""})
              </p>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => setLeaderboardScope("gym")}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    leaderboardScope === "gym"
                      ? "bg-purple-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Gym
                </button>
                <button
                  onClick={() => setLeaderboardScope("everyone")}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    leaderboardScope === "everyone"
                      ? "bg-purple-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Everyone
                </button>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No entries yet</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? getRankColor(index) + " text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.userName || "Unknown"}
                        {entry.userId === user?.id && (
                          <span className="text-purple-600 ml-1">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.date?.toDate?.().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {entry.weight} lbs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              History ({selectedReps} rep{selectedReps > 1 ? "s" : ""})
            </p>
            <div className="space-y-3">
              {history.map((log) => (
                <div key={log.id} className="py-2 border-b border-gray-100 last:border-0">
                  {editingLogId === log.id ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Date</p>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Weight (lbs)</p>
                        <input type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} placeholder="Weight" className="w-full px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Reps</p>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                          {[1, 2, 3, 4, 5].map((rep) => (
                            <button key={rep} onClick={() => setEditReps(rep)} className={`flex-1 px-2 py-1.5 font-medium ${editReps === rep ? "bg-purple-600 text-white" : "bg-white text-gray-600"}`}>
                              {rep}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(log.id)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium">Save</button>
                        <button onClick={cancelEdit} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{log.date?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                        <p className="text-lg font-semibold text-gray-900">{log.weight} lbs</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditLog(log)} className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm">✎</button>
                        <button onClick={() => deleteLog(log.id)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LiftPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
      <LiftPageContent />
    </Suspense>
  );
}
