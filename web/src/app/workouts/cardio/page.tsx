"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, getDocs, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";
import { CardioActivity, CardioLog, cardioActivityLabels, cardioActivityIcons } from "@/lib/types";

const ACTIVITIES: CardioActivity[] = ["run", "swim", "bike_mtb", "bike_road", "row"];

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Pace per mile, e.g. "9:32 /mi"
function formatPace(miles: number, seconds: number): string {
  if (!miles || !seconds) return "";
  const paceSec = Math.round(seconds / miles);
  return `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, "0")} /mi`;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CardioPageContent() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlActivity = searchParams.get("activity") as CardioActivity | null;
  const urlDate = searchParams.get("date");
  const urlMiles = searchParams.get("miles");
  const urlTitle = searchParams.get("name");

  const [activity, setActivity] = useState<CardioActivity>(
    urlActivity && ACTIVITIES.includes(urlActivity) ? urlActivity : "run"
  );
  const [miles, setMiles] = useState(urlMiles || "");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [entryDate, setEntryDate] = useState(urlDate || localToday());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<CardioLog[]>([]);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(
        collection(db, "cardioLogs"),
        where("userId", "==", user.id)
      ));
      const logs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as CardioLog))
        .sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
      setHistory(logs);
    } catch (err) {
      console.error("Error loading cardio history:", err);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async () => {
    if (!user) return;
    const milesNum = parseFloat(miles);
    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (!milesNum && !totalSeconds) {
      setError("Enter at least mileage or a time");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const [y, m, d] = entryDate.split("-").map(Number);
      const logDate = new Date(y, m - 1, d, 12, 0, 0);
      await addDoc(collection(db, "cardioLogs"), {
        userId: user.id,
        activity,
        miles: milesNum || 0,
        timeInSeconds: totalSeconds,
        date: Timestamp.fromDate(logDate),
        dateString: entryDate,
        notes: notes.trim(),
        createdAt: Timestamp.now(),
      });
      setSaved(true);
      setMiles("");
      setHours("");
      setMinutes("");
      setSeconds("");
      setNotes("");
      await loadHistory();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving cardio log:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteDoc(doc(db, "cardioLogs", logId));
      setHistory(prev => prev.filter(l => l.id !== logId));
    } catch (err) {
      console.error("Error deleting cardio log:", err);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const activityHistory = history.filter(l => l.activity === activity);
  const totalActivityMiles = activityHistory.reduce((sum, l) => sum + (l.miles || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Log Cardio</h1>
          {urlTitle && <p className="text-gray-500 text-sm mt-1">From your plan: {urlTitle}</p>}
        </div>

        {/* Activity selector */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {ACTIVITIES.map(a => (
            <button
              key={a}
              onClick={() => setActivity(a)}
              className={`py-3 rounded-xl border text-center transition-colors ${
                activity === a
                  ? "bg-red-50 border-red-400 ring-1 ring-red-400"
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="text-2xl">{cardioActivityIcons[a]}</div>
              <div className={`text-xs font-semibold mt-1 ${activity === a ? "text-red-700" : "text-gray-600"}`}>
                {cardioActivityLabels[a]}
              </div>
            </button>
          ))}
        </div>

        {/* Log form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder="e.g., 4.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="hh"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-center focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <span className="text-gray-400 font-bold">:</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="mm"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-center focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <span className="text-gray-400 font-bold">:</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="ss"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-center focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {(() => {
                const milesNum = parseFloat(miles);
                const total = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
                const pace = milesNum && total ? formatPace(milesNum, total) : "";
                return pace ? <span className="ml-2 text-sm text-gray-500 font-mono">{pace}</span> : null;
              })()}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          {saved && <p className="text-green-600 text-sm mb-3 font-medium">✓ Logged!</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : `Log ${cardioActivityLabels[activity]}`}
          </button>
        </div>

        {/* History for the selected activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">{cardioActivityLabels[activity]} History</h2>
            {totalActivityMiles > 0 && (
              <span className="text-sm text-gray-500">{totalActivityMiles.toFixed(1)} mi total</span>
            )}
          </div>
          {activityHistory.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No {cardioActivityLabels[activity].toLowerCase()} logs yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {activityHistory.slice(0, 20).map(log => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {log.miles ? `${log.miles} mi` : ""}
                      {log.miles && log.timeInSeconds ? " • " : ""}
                      {log.timeInSeconds ? formatDuration(log.timeInSeconds) : ""}
                      {log.miles && log.timeInSeconds ? (
                        <span className="text-gray-400 font-normal"> • {formatPace(log.miles, log.timeInSeconds)}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.date?.toDate?.().toLocaleDateString()}
                      {log.notes ? ` — ${log.notes}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CardioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <CardioPageContent />
    </Suspense>
  );
}
