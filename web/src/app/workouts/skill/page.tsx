"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, getDocs, Timestamp, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";
import { getAllSkills, Workout } from "@/lib/workoutData";

// Generate straight line path
function getLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

interface SkillResult {
  id: string;
  skillTitle: string;
  maxReps: number;
  userId: string;
  userName?: string;
  gymId?: string;
  date: { toDate: () => Date };
  notes?: string;
}

function SkillPageContent() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if coming from a scheduled skill (has name in URL)
  const urlSkillName = searchParams.get("name") || "";
  const urlDescription = searchParams.get("description") || "";
  const isFromSchedule = !!urlSkillName;

  const [skillName, setSkillName] = useState(urlSkillName);
  const [description, setDescription] = useState(urlDescription);
  const [maxReps, setMaxReps] = useState("");
  const [notes, setNotes] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SkillResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<SkillResult[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardScope, setLeaderboardScope] = useState<"gym" | "everyone">("everyone");
  const [chartTimeRange, setChartTimeRange] = useState<"1m" | "6m" | "1y" | "2y" | "5y">("1y");

  // Autocomplete suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const allSkills = getAllSkills();

  // Edit history state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user && skillName) {
      loadHistory();
      loadLeaderboard();
    }
  }, [user, skillName, leaderboardScope]);

  const loadHistory = async () => {
    if (!user || !skillName) return;
    try {
      const q = query(
        collection(db, "skillResults"),
        where("userId", "==", user.id),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const allResults = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SkillResult[];

      // Case-insensitive match for skill name
      const skillNameLower = skillName.toLowerCase().trim();
      const filtered = allResults
        .filter((r) => r.skillTitle?.toLowerCase().trim() === skillNameLower)
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
    if (!skillName) return;
    setLoadingLeaderboard(true);
    try {
      const q = query(
        collection(db, "skillResults"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SkillResult[];

      // Case-insensitive match for skill name
      const skillNameLower = skillName.toLowerCase().trim();
      results = results.filter((r) => r.skillTitle?.toLowerCase().trim() === skillNameLower);

      // Filter by gym if scope is gym
      if (leaderboardScope === "gym" && user?.gymId) {
        results = results.filter((r) => r.gymId === user.gymId);
      }

      // Get max reps per user (only 1 entry per user - their best)
      const userBestMap = new Map<string, SkillResult>();
      for (const result of results) {
        const existing = userBestMap.get(result.userId);
        if (!existing || result.maxReps > existing.maxReps) {
          userBestMap.set(result.userId, result);
        }
      }
      results = Array.from(userBestMap.values());

      // Sort by reps descending
      results.sort((a, b) => b.maxReps - a.maxReps);

      setLeaderboard(results.slice(0, 10));
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const latestReps = history.length > 0 ? history[0].maxReps : null;

  const handleSubmit = async () => {
    setError("");

    if (!user) return;

    if (!skillName.trim()) {
      setError("Please select or enter a skill name");
      return;
    }

    if (!maxReps || parseInt(maxReps) <= 0) {
      setError("Please enter a valid rep count");
      return;
    }

    setSubmitting(true);

    try {
      const workoutDate = Timestamp.fromDate(new Date(entryDate));

      await addDoc(collection(db, "skillResults"), {
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        gymId: user.gymId || null,
        skillTitle: skillName.trim(),
        maxReps: parseInt(maxReps),
        notes: notes.trim(),
        date: workoutDate,
        isPersonalRecord: false,
      });

      setMaxReps("");
      setNotes("");
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error logging skill:", err);
      setError("Failed to log skill. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditLog = (log: SkillResult) => {
    setEditingLogId(log.id);
    setEditReps(log.maxReps.toString());
    setEditNotes(log.notes || "");
    const logDate = log.date?.toDate?.();
    if (logDate) {
      setEditDate(logDate.toISOString().split("T")[0]);
    } else {
      setEditDate(new Date().toISOString().split("T")[0]);
    }
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditReps("");
    setEditNotes("");
    setEditDate("");
  };

  const saveEdit = async (logId: string) => {
    const newReps = parseInt(editReps);
    if (!newReps || newReps <= 0) return;

    try {
      const newDate = Timestamp.fromDate(new Date(editDate));

      await updateDoc(doc(db, "skillResults", logId), {
        maxReps: newReps,
        notes: editNotes.trim(),
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
      await deleteDoc(doc(db, "skillResults", logId));
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
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
    const date = h.date?.toDate?.();
    return date && date >= timeRangeStart;
  });
  const chartData = filteredHistory.slice(0, 50).reverse();
  const reps = chartData.map((h) => h.maxReps);
  const dataMax = reps.length > 0 ? Math.max(...reps) : 10;
  const dataMin = reps.length > 0 ? Math.min(...reps) : 0;

  // Calculate tick interval
  const dataRange = dataMax - dataMin || 10;
  const rawInterval = dataRange / 5;
  const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100];
  const tickInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 10) * 10;

  const chartMin = Math.floor(dataMin / tickInterval) * tickInterval;
  const chartMax = Math.ceil(dataMax / tickInterval) * tickInterval;
  const range = chartMax - chartMin || tickInterval;
  const numTicks = Math.round(range / tickInterval) + 1;
  const yTicks = Array.from({ length: numTicks }, (_, i) => chartMax - i * tickInterval);

  // Generate x-axis labels
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

  // Filtered suggestions based on input
  const getFilteredSuggestions = (): Workout[] => {
    if (!skillName.trim()) return allSkills.slice(0, 10);
    const searchLower = skillName.toLowerCase();
    return allSkills
      .filter(skill =>
        skill.name.toLowerCase().includes(searchLower) ||
        skill.description.toLowerCase().includes(searchLower)
      )
      .slice(0, 10);
  };
  const filteredSuggestions = getFilteredSuggestions();

  const handleSelectSuggestion = (skill: Workout) => {
    setSkillName(skill.name);
    setShowSuggestions(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Skill Title */}
        {isFromSchedule ? (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 text-center">{skillName}</h1>
            {description && (
              <p className="text-gray-500 text-center text-sm mt-1">{description}</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="relative">
              <input
                type="text"
                value={skillName}
                onChange={(e) => {
                  setSkillName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search skills..."
                className="w-full text-xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {/* Autocomplete dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredSuggestions.map((skill, idx) => (
                    <button
                      key={`${skill.name}-${idx}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectSuggestion(skill)}
                      className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{skill.name}</p>
                        <p className="text-sm text-gray-500 truncate">{skill.description}</p>
                      </div>
                      <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 shrink-0">
                        Skill
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Click outside to close */}
            {showSuggestions && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSuggestions(false)}
              />
            )}
          </div>
        )}

        {/* Max Reps + Date + Save */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Log Max Reps</p>
          <div className="flex items-end gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <input
                  type="number"
                  value={maxReps}
                  onChange={(e) => setMaxReps(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2.5 text-center text-lg text-gray-900 border-none focus:ring-0"
                />
                <span className="px-3 py-2.5 bg-gray-50 text-gray-500 border-l border-gray-300">reps</span>
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
          </div>
          <div className="mb-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional) - e.g., unbroken, with vest"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !maxReps || !skillName.trim()}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300"
          >
            Save
          </button>
        </div>

        {/* Personal Best */}
        {latestReps && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-gray-700">Personal Best</p>
              <p className="text-2xl font-bold text-green-600">{Math.max(...history.map(h => h.maxReps))} reps</p>
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
                        ? "bg-green-600 text-white"
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
                        stroke="#16A34A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        d={getLinePath(chartData.map((d) => {
                          const date = d.date?.toDate?.() || new Date();
                          const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                          const x = 5 + xPct * 340;
                          const y = range > 0 ? 4 + (1 - (d.maxReps - chartMin) / range) * 152 : 80;
                          return { x, y };
                        }))}
                      />
                    ) : null}
                    {/* Data points */}
                    {chartData.map((d, i) => {
                      const date = d.date?.toDate?.() || new Date();
                      const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                      const x = 5 + xPct * 340;
                      const y = range > 0 ? 4 + (1 - (d.maxReps - chartMin) / range) * 152 : 80;
                      return <circle key={i} cx={x} cy={y} r="4" fill="#16A34A" />;
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
        {skillName && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">Leaderboard</p>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => setLeaderboardScope("gym")}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    leaderboardScope === "gym"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Gym
                </button>
                <button
                  onClick={() => setLeaderboardScope("everyone")}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    leaderboardScope === "everyone"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Everyone
                </button>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
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
                          <span className="text-green-600 ml-1">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.date?.toDate?.().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {entry.maxReps} reps
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
                        <p className="text-xs text-gray-500 mb-1">Max Reps</p>
                        <input type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)} placeholder="Reps" className="w-full px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(log.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium">Save</button>
                        <button onClick={cancelEdit} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{log.date?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">{log.maxReps} reps</p>
                          {log.notes && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{log.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditLog(log)} className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm">✎</button>
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

export default function SkillPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>}>
      <SkillPageContent />
    </Suspense>
  );
}
