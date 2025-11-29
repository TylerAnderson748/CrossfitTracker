"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WODCategory, normalizeWorkoutName, LeaderboardEntry, categoryOrder, categoryColors } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface WorkoutLog {
  id: string;
  wodTitle?: string;
  timeInSeconds: number;
  completedDate: { toDate: () => Date };
  notes: string;
  category?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get hex color for category
function getCategoryHexColor(category: string): string {
  if (category === "RX" || category === "rx" || category === "RX+") return "#3B82F6"; // blue
  if (category === "Scaled" || category === "scaled") return "#6B7280"; // gray
  if (category === "Just For Fun" || category === "Just for Fun" || category === "fun") return "#22C55E"; // green
  return "#3B82F6"; // default blue
}

// Generate smooth bezier curve path with gentle curves
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Lower tension = gentler curves that don't overshoot
    const tension = 0.15;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " at " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  const [categoryFilter, setCategoryFilter] = useState<"all" | WODCategory>("all");
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [chartTimeRange, setChartTimeRange] = useState<"1m" | "6m" | "1y" | "2y" | "5y">("1y");

  // Edit history state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [editSeconds, setEditSeconds] = useState("");
  const [editCategory, setEditCategory] = useState<WODCategory>("RX");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Redirect to lift page if type=lift is passed
  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "lift") {
      const name = searchParams.get("name") || "";
      const description = searchParams.get("description") || "";
      router.replace(`/workouts/lift?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}`);
    }
  }, [searchParams, router]);

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
  }, [user, wodTitle, leaderboardFilter, genderFilter, categoryFilter]);

  // Category priority: RX (0) > Scaled (1) > Just For Fun (2)
  const getCategoryPriority = (cat: string): number => {
    if (cat === "RX" || cat === "rx" || cat === "RX+" || cat === "rxPlus") return 0;
    if (cat === "Scaled" || cat === "scaled") return 1;
    if (cat === "Just For Fun" || cat === "Just for Fun" || cat === "fun" || cat === "Fun") return 2;
    return 0; // Default to RX priority for unknown/empty
  };

  const normalizeCategory = (cat: string): WODCategory => {
    if (!cat || cat === "RX" || cat === "rx" || cat === "RX+" || cat === "rxPlus") return "RX";
    if (cat === "Scaled" || cat === "scaled") return "Scaled";
    if (cat === "Just For Fun" || cat === "Just for Fun" || cat === "fun" || cat === "Fun" || cat === "Just Happy To Be Here" || cat === "happy") return "Just For Fun";
    return "RX"; // Default to RX for unknown categories
  };

  const loadHistory = async () => {
    if (!user || !wodTitle) return;
    try {
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const allLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];

      // Filter client-side for this workout and sort
      const filtered = allLogs
        .filter((log) => log.wodTitle?.toLowerCase() === wodTitle.trim().toLowerCase())
        .sort((a, b) => {
          const dateA = a.completedDate?.toDate?.() || new Date(0);
          const dateB = b.completedDate?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10);

      setHistory(filtered);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      let entries: LeaderboardEntry[] = [];

      // Always load all entries first (simpler, avoids index issues)
      const allQuery = query(
        collection(db, "leaderboardEntries"),
        limit(200)
      );
      const allSnapshot = await getDocs(allQuery);
      entries = allSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];

      // Filter for this workout if we have a title
      if (wodTitle) {
        const normalized = normalizeWorkoutName(wodTitle.trim());
        const workoutEntries = entries.filter(
          (e) => e.normalizedWorkoutName === normalized
        );
        if (workoutEntries.length > 0) {
          entries = workoutEntries;
        }
      }

      // Filter for entries with time data
      entries = entries.filter((e) => e.timeInSeconds && e.timeInSeconds > 0);

      // Apply gender filter
      if (genderFilter !== "all") {
        entries = entries.filter((e) => e.userGender === genderFilter);
      }

      // Normalize categories on all entries
      entries = entries.map((e) => ({
        ...e,
        category: normalizeCategory((e.category || "").toString()),
      }));

      // First, determine each user's BEST category (across all their entries)
      const userBestCategory = new Map<string, number>(); // userId -> best priority (lower is better)
      entries.forEach((entry) => {
        const priority = getCategoryPriority((entry.category || "").toString());
        const existing = userBestCategory.get(entry.userId);
        if (existing === undefined || priority < existing) {
          userBestCategory.set(entry.userId, priority);
        }
      });

      // Get best entry per user (considering category priority, then time)
      const bestByUser = new Map<string, LeaderboardEntry>();
      entries.forEach((entry) => {
        const existing = bestByUser.get(entry.userId);
        if (!existing) {
          bestByUser.set(entry.userId, entry);
        } else {
          const existingPriority = getCategoryPriority((existing.category || "").toString());
          const entryPriority = getCategoryPriority((entry.category || "").toString());

          if (entryPriority < existingPriority) {
            // Better category wins
            bestByUser.set(entry.userId, entry);
          } else if (entryPriority === existingPriority) {
            // Same category, faster time wins
            if ((entry.timeInSeconds || 0) < (existing.timeInSeconds || 0)) {
              bestByUser.set(entry.userId, entry);
            }
          }
        }
      });

      // Apply category filter - only show users whose BEST category matches
      // (users with better categories don't appear in lower category filters)
      let filteredEntries = Array.from(bestByUser.values());
      if (categoryFilter !== "all") {
        const filterPriority = getCategoryPriority(categoryFilter);
        filteredEntries = filteredEntries.filter((entry) => {
          const userBestPriority = userBestCategory.get(entry.userId) ?? 0;
          // Only include if user's best category matches the filter
          return userBestPriority === filterPriority;
        });
      }

      // Sort the filtered entries
      const sortedEntries = filteredEntries.sort((a, b) => {
        if (categoryFilter === "all") {
          // Sort by category priority first, then by time
          const aPriority = getCategoryPriority((a.category || "").toString());
          const bPriority = getCategoryPriority((b.category || "").toString());
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
        }
        return (a.timeInSeconds || 0) - (b.timeInSeconds || 0);
      });

      setLeaderboard(sortedEntries);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartStop = () => setTimerRunning(!timerRunning);
  const handleReset = () => { setTimerRunning(false); setElapsedSeconds(0); };

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
    if (!user || !wodTitle.trim() || elapsedSeconds === 0) return;
    await saveWorkout(elapsedSeconds);
  };

  const handleSaveManual = async () => {
    if (!user || !wodTitle.trim() || !isManualEntryValid()) return;
    await saveWorkout(getTimeFromManual());
  };

  const saveWorkout = async (timeInSeconds: number) => {
    setError("");
    setSubmitting(true);
    try {
      const now = Timestamp.now();
      const workoutDate = Timestamp.fromDate(new Date(entryDate));

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

      // Stay on page - reset inputs and refresh data
      setManualMinutes("");
      setManualSeconds("");
      setElapsedSeconds(0);
      setTimerRunning(false);
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error logging workout:", err);
      setError("Failed to log workout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditLog = (log: WorkoutLog) => {
    const mins = Math.floor(log.timeInSeconds / 60);
    const secs = log.timeInSeconds % 60;
    setEditingLogId(log.id);
    setEditMinutes(mins.toString());
    setEditSeconds(secs.toString());
    setEditCategory((log.notes as WODCategory) || "RX");
    // Initialize edit date from the log's completedDate
    const logDate = log.completedDate?.toDate?.();
    if (logDate) {
      setEditDate(logDate.toISOString().split("T")[0]);
    } else {
      setEditDate(new Date().toISOString().split("T")[0]);
    }
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditMinutes("");
    setEditSeconds("");
    setEditDate("");
  };

  const saveEdit = async (logId: string) => {
    const mins = parseInt(editMinutes) || 0;
    const secs = parseInt(editSeconds) || 0;
    const newTime = mins * 60 + secs;
    if (newTime <= 0) return;

    try {
      const newDate = Timestamp.fromDate(new Date(editDate));

      await updateDoc(doc(db, "workoutLogs", logId), {
        timeInSeconds: newTime,
        notes: editCategory,
        completedDate: newDate,
      });

      // Also update leaderboard entry if exists
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        where("workoutLogId", "==", logId)
      );
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      for (const docSnap of leaderboardSnapshot.docs) {
        await updateDoc(doc(db, "leaderboardEntries", docSnap.id), {
          timeInSeconds: newTime,
          category: editCategory,
          completedDate: newDate,
        });
      }

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
      await deleteDoc(doc(db, "workoutLogs", logId));

      // Also delete leaderboard entry if exists
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        where("workoutLogId", "==", logId)
      );
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      for (const docSnap of leaderboardSnapshot.docs) {
        await deleteDoc(doc(db, "leaderboardEntries", docSnap.id));
      }

      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error deleting log:", err);
      setError("Failed to delete entry.");
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
    const date = h.completedDate?.toDate?.();
    return date && date >= timeRangeStart;
  });
  const chartData = filteredHistory.slice(0, 50).reverse();
  const times = chartData.map((h) => h.timeInSeconds);
  const dataMax = Math.max(...times, 1);
  const dataMin = Math.min(...times, 0);
  // Round to nearest 10 seconds for nice tick marks
  const tickInterval = 10;
  const minTime = Math.floor(dataMin / tickInterval) * tickInterval;
  const maxTime = Math.ceil(dataMax / tickInterval) * tickInterval + tickInterval;
  const range = maxTime - minTime || 60;
  // Generate Y-axis ticks at 10-second intervals
  const numTicks = Math.ceil(range / tickInterval) + 1;
  const yTicks = Array.from({ length: Math.min(numTicks, 7) }, (_, i) => maxTime - i * tickInterval);

  // Generate x-axis labels for the full time range
  const getXAxisLabels = () => {
    const labels: { date: Date; label: string }[] = [];
    const now = new Date();
    switch (chartTimeRange) {
      case "1m":
        for (let i = 4; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
          labels.push({ date: d, label: `${d.getMonth() + 1}/${d.getDate()}` });
        }
        break;
      case "6m":
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "1y":
        for (let i = 12; i >= 0; i -= 2) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "2y":
        for (let i = 24; i >= 0; i -= 6) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) });
        }
        break;
      case "5y":
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear() - i, now.getMonth(), 1);
          labels.push({ date: d, label: d.getFullYear().toString() });
        }
        break;
    }
    return labels;
  };
  const xAxisLabels = getXAxisLabels();

  const getXPosition = (date: Date) => {
    const dateMs = date.getTime() - timeRangeStart.getTime();
    return 10 + (dateMs / timeRangeMs) * 280;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN - Progress, Leaderboard, History */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Progress Line Chart */}
            {filteredHistory.length >= 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
                            ? "bg-blue-600 text-white"
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
                    <div className="w-12 h-32 flex flex-col justify-between text-xs text-gray-400 pr-2">
                      {yTicks.map((tick, i) => (
                        <span key={i}>{formatTime(Math.round(tick))}</span>
                      ))}
                    </div>
                    <div className="flex-1 h-32">
                      <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                        {/* Horizontal grid lines */}
                        {yTicks.map((_, i) => {
                          const y = (i / (yTicks.length - 1)) * 100;
                          return <line key={i} x1="10" y1={y} x2="290" y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                        })}
                        {/* Vertical grid lines at x-axis label positions */}
                        {xAxisLabels.map((label, i) => {
                          const x = getXPosition(label.date);
                          return <line key={i} x1={x} y1="0" x2={x} y2="100" stroke="#E5E7EB" strokeWidth="1" />;
                        })}
                        {chartData.length > 1 ? (
                          <path
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={getSmoothPath(chartData.map((d) => {
                              const date = d.completedDate?.toDate?.() || new Date();
                              return {
                                x: getXPosition(date),
                                y: range > 0 ? 100 - ((d.timeInSeconds - minTime) / range) * 100 : 50,
                              };
                            }))}
                          />
                        ) : null}
                        {chartData.map((d, i) => {
                          const date = d.completedDate?.toDate?.() || new Date();
                          const x = getXPosition(date);
                          const y = range > 0 ? 100 - ((d.timeInSeconds - minTime) / range) * 100 : 50;
                          const color = getCategoryHexColor(d.notes || "");
                          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
                        })}
                      </svg>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-12"></div>
                    <div className="flex-1 relative h-4 text-xs text-gray-400 mt-2">
                      {xAxisLabels.map((label, i) => {
                        const x = getXPosition(label.date);
                        const percent = ((x - 10) / 280) * 100;
                        return (
                          <span
                            key={i}
                            className="absolute transform -translate-x-1/2"
                            style={{ left: `${percent}%` }}
                          >
                            {label.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 mt-6 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-gray-500">RX</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                    <span className="text-gray-500">Scaled</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-gray-500">Just For Fun</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Leaderboard</p>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                  <button onClick={() => setLeaderboardFilter("gym")} className={`px-3 py-1.5 font-medium ${leaderboardFilter === "gym" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Gym</button>
                  <button onClick={() => setLeaderboardFilter("everyone")} className={`px-3 py-1.5 font-medium ${leaderboardFilter === "everyone" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Everyone</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Gender:</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                    {(["all", "Male", "Female"] as const).map((g) => (
                      <button key={g} onClick={() => setGenderFilter(g)} className={`px-2 py-1 font-medium ${genderFilter === g ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                        {g === "all" ? "All" : g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Category:</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                    {(["all", "RX", "Scaled", "Just For Fun"] as const).map((c) => (
                      <button key={c} onClick={() => setCategoryFilter(c)} className={`px-2 py-1 font-medium whitespace-nowrap ${categoryFilter === c ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                        {c === "all" ? "All" : c}
                      </button>
                    ))}
                  </div>
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
                  {leaderboard.slice(0, 10).map((entry, index) => {
                    const cat = entry.category as WODCategory;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 py-1.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-600">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {entry.userName}
                              {entry.userId === user?.id && <span className="text-blue-600 ml-1">(You)</span>}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[cat]?.badge || "bg-blue-100 text-blue-700"}`}>
                              {cat}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {entry.completedDate?.toDate?.().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {formatTime(entry.timeInSeconds || 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">History</p>
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
                            <p className="text-xs text-gray-500 mb-1">Time</p>
                            <div className="flex items-center gap-2">
                              <input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} placeholder="Min" className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                              <span>:</span>
                              <input type="number" value={editSeconds} onChange={(e) => setEditSeconds(e.target.value)} placeholder="Sec" className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                            </div>
                          </div>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                            {categoryOrder.map((cat) => (
                              <button key={cat} onClick={() => setEditCategory(cat)} className={`flex-1 px-2 py-1.5 font-medium whitespace-nowrap ${editCategory === cat ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                                {cat}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(log.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Save</button>
                            <button onClick={cancelEdit} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">{log.completedDate?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-semibold text-gray-900">{formatTime(log.timeInSeconds)}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[log.notes as WODCategory]?.badge || "bg-gray-100 text-gray-600"}`}>
                                {log.notes || "RX"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEditLog(log)} className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✎</button>
                            <button onClick={() => deleteLog(log.id)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Workout Info, Category, Timer, Manual Entry */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Workout Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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

            {/* Timer, Category & Manual Entry */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Category */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Category</p>
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {categoryOrder.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`flex-1 py-2 text-xs font-semibold ${category === cat ? `${categoryColors[cat].bg} text-white` : "bg-white text-gray-600"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-semibold">Timer</p>
                <div className="text-center mb-3">
                  <div className="text-5xl font-mono font-semibold text-gray-900">
                    {formatTimerDisplay(elapsedSeconds)}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={handleStartStop} className={`w-full py-2.5 rounded-xl font-semibold ${timerRunning ? "bg-red-500 text-white" : "bg-blue-600 text-white"}`}>
                    {timerRunning ? "Stop" : "Start"}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={handleReset} className="flex-1 py-2 bg-gray-200 rounded-xl font-semibold text-gray-700 text-sm">Reset</button>
                    <button onClick={handleSaveTimer} disabled={submitting || elapsedSeconds === 0} className="flex-1 py-2 bg-green-500 rounded-xl font-semibold text-white text-sm disabled:bg-gray-300">Save</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 my-4"></div>

              {/* Manual Entry */}
              <div>
                <p className="text-xs text-gray-500 mb-2 font-semibold">Manual Entry</p>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Min</p>
                    <input type="number" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Sec</p>
                    <input type="number" value={manualSeconds} onChange={(e) => setManualSeconds(e.target.value)} placeholder="0" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900" />
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1">Date</p>
                  <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                </div>
                <button onClick={handleSaveManual} disabled={submitting || !isManualEntryValid()} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300">Save</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <NewWorkoutContent />
    </Suspense>
  );
}
