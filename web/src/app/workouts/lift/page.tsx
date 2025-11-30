"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, getDocs, Timestamp, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";

// Generate straight line path
function getLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

interface LiftResult {
  id: string;
  liftTitle: string;  // iOS app uses liftTitle, not liftName
  weight: number;
  reps: number;
  userId: string;
  userName?: string;
  gymId?: string;
  date: { toDate: () => Date };
}

function LiftPageContent() {
  const { user, loading, switching } = useAuth();
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
  const [chartTimeRange, setChartTimeRange] = useState<"1m" | "6m" | "1y" | "2y" | "5y">("1y");

  // Edit history state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState(1);
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

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

      // Case-insensitive match for lift name
      const liftNameLower = liftName.toLowerCase().trim();
      const filtered = allResults
        .filter((r) => r.liftTitle?.toLowerCase().trim() === liftNameLower && r.reps === selectedReps)
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
      // Fetch all lift results and filter client-side for case-insensitive matching
      const q = query(
        collection(db, "liftResults"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];

      // Case-insensitive match for lift name (iOS uses liftTitle field)
      const liftNameLower = liftName.toLowerCase().trim();
      results = results.filter((r) => r.liftTitle?.toLowerCase().trim() === liftNameLower);

      // Filter by reps
      results = results.filter((r) => r.reps === selectedReps);

      // Filter by gym if scope is gym
      if (leaderboardScope === "gym" && user?.gymId) {
        results = results.filter((r) => r.gymId === user.gymId);
      }

      // Get max weight per user (only 1 entry per user - their best)
      const userBestMap = new Map<string, LiftResult>();
      for (const result of results) {
        const existing = userBestMap.get(result.userId);
        if (!existing || result.weight > existing.weight) {
          userBestMap.set(result.userId, result);
        }
      }
      results = Array.from(userBestMap.values());

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
        liftTitle: liftName.trim(),  // iOS app uses liftTitle
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

  // Calculate training percentages - 3 columns like iOS app
  const percentageColumns = [
    // Column 1 - Red (high intensity)
    [
      { pct: 100, color: "text-red-500" },
      { pct: 95, color: "text-red-500" },
      { pct: 90, color: "text-red-500" },
      { pct: 85, color: "text-red-500" },
    ],
    // Column 2 - Yellow/Orange (medium intensity)
    [
      { pct: 80, color: "text-yellow-500" },
      { pct: 75, color: "text-yellow-500" },
      { pct: 70, color: "text-yellow-500" },
      { pct: 65, color: "text-yellow-500" },
    ],
    // Column 3 - Green (low intensity)
    [
      { pct: 60, color: "text-green-500" },
      { pct: 55, color: "text-green-500" },
      { pct: 50, color: "text-green-500" },
      { pct: 45, color: "text-green-500" },
    ],
  ];

  // Progress chart data - filter by time range
  const getTimeRangeDate = (range: string) => {
    const now = new Date();
    switch (range) {
      case "1m": return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case "6m": return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case "1y": return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case "2y": return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      case "5y": return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      default: return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
  };
  const timeRangeStart = getTimeRangeDate(chartTimeRange);
  const timeRangeEnd = new Date();
  const timeRangeMs = timeRangeEnd.getTime() - timeRangeStart.getTime();

  const filteredHistory = history.filter((h) => {
    const date = h.date?.toDate?.();
    return date && date >= timeRangeStart;
  });
  const chartData = filteredHistory.slice(0, 50).reverse();
  const weights = chartData.map((h) => h.weight);
  const dataMax = weights.length > 0 ? Math.max(...weights) : 100;
  const dataMin = weights.length > 0 ? Math.min(...weights) : 0;

  // Calculate tick interval to fit data in ~5-6 ticks with padding
  const dataRange = dataMax - dataMin || 50;
  const rawInterval = dataRange / 5;
  // Round to nice intervals: 5, 10, 20, 25, 50, 100, etc.
  const niceIntervals = [5, 10, 20, 25, 50, 100, 200];
  const tickInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 10) * 10;

  // Calculate min/max ticks with padding
  const chartMin = Math.floor(dataMin / tickInterval) * tickInterval;
  const chartMax = Math.ceil(dataMax / tickInterval) * tickInterval;
  const range = chartMax - chartMin || tickInterval;
  const numTicks = Math.round(range / tickInterval) + 1;
  const yTicks = Array.from({ length: numTicks }, (_, i) => chartMax - i * tickInterval);

  // Generate x-axis labels for the full time range
  const getXAxisLabels = () => {
    const labels: { date: Date; label: string }[] = [];
    const now = new Date();
    switch (chartTimeRange) {
      case "1m":
        // Weekly labels for 1 month
        for (let i = 4; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
          labels.push({ date: d, label: `${d.getMonth() + 1}/${d.getDate()}` });
        }
        break;
      case "6m":
        // Monthly labels for 6 months
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "1y":
        // Bi-monthly labels for 1 year
        for (let i = 12; i >= 0; i -= 2) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "2y":
        // Quarterly labels for 2 years
        for (let i = 24; i >= 0; i -= 6) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) });
        }
        break;
      case "5y":
        // Yearly labels for 5 years
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear() - i, now.getMonth(), 1);
          labels.push({ date: d, label: d.getFullYear().toString() });
        }
        break;
    }
    return labels;
  };
  const xAxisLabels = getXAxisLabels();

  // Calculate x position based on date within time range
  const getXPosition = (date: Date) => {
    const dateMs = date.getTime() - timeRangeStart.getTime();
    return 10 + (dateMs / timeRangeMs) * 280;
  };

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
        </div>

        {/* Training Percentages - iOS style */}
        {latestWeight && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">Training %</p>
              <p className="text-sm text-purple-600 font-medium">
                Latest: {latestWeight} × {selectedReps}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-6">
              {percentageColumns.map((column, colIndex) => (
                <div key={colIndex} className="space-y-1">
                  {column.map(({ pct, color }) => (
                    <div key={pct} className="flex justify-between items-center">
                      <span className={`text-sm font-medium ${color}`}>{pct}%</span>
                      <span className="text-sm text-gray-700">
                        {Math.round(latestWeight * (pct / 100))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Line Chart */}
        {filteredHistory.length >= 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">Progress</p>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                {[
                  { key: "1m", label: "1M" },
                  { key: "6m", label: "6M" },
                  { key: "1y", label: "1Y" },
                  { key: "2y", label: "2Y" },
                  { key: "5y", label: "5Y" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setChartTimeRange(key as typeof chartTimeRange)}
                    className={`px-2 py-1 font-medium transition-colors ${
                      chartTimeRange === key
                        ? "bg-purple-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="flex">
                <div className="w-10 flex flex-col justify-between text-xs text-gray-400 pr-1 py-1" style={{ height: "160px" }}>
                  {yTicks.map((tick, i) => (
                    <span key={i} className="text-right">{tick}</span>
                  ))}
                </div>
                <div className="flex-1" style={{ height: "160px" }}>
                  <svg width="100%" height="100%" viewBox="0 0 350 160" preserveAspectRatio="none">
                    {/* Horizontal grid lines */}
                    {yTicks.map((_, i) => {
                      const y = 4 + (i / (yTicks.length - 1)) * 152;
                      return <line key={i} x1="5" y1={y} x2="345" y2={y} stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
                    })}
                    {/* Vertical grid lines */}
                    {xAxisLabels.map((label, i) => {
                      const xPct = (label.date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                      const x = 5 + xPct * 340;
                      return <line key={i} x1={x} y1="4" x2={x} y2="156" stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
                    })}
                    {/* Data line */}
                    {chartData.length > 1 ? (
                      <path
                        fill="none"
                        stroke="#9333EA"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        d={getLinePath(chartData.map((d) => {
                          const date = d.date?.toDate?.() || new Date();
                          const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                          const x = 5 + xPct * 340;
                          const y = range > 0 ? 4 + (1 - (d.weight - chartMin) / range) * 152 : 80;
                          return { x, y };
                        }))}
                      />
                    ) : null}
                    {/* Data points */}
                    {chartData.map((d, i) => {
                      const date = d.date?.toDate?.() || new Date();
                      const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                      const x = 5 + xPct * 340;
                      const y = range > 0 ? 4 + (1 - (d.weight - chartMin) / range) * 152 : 80;
                      return <circle key={i} cx={x} cy={y} r="4" fill="#9333EA" />;
                    })}
                  </svg>
                </div>
              </div>
              <div className="flex">
                <div className="w-10"></div>
                <div className="flex-1 flex justify-between text-xs text-gray-400 mt-1">
                  {xAxisLabels.map((label, i) => (
                    <span key={i}>{label.label}</span>
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
