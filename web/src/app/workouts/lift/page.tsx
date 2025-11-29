"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";

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

interface LiftResult {
  id: string;
  liftName: string;
  weight: number;
  reps: number;
  date: { toDate: () => Date };
}

export default function LiftPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [liftName, setLiftName] = useState("");
  const [selectedReps, setSelectedReps] = useState(1);
  const [weight, setWeight] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<LiftResult[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && liftName) {
      loadHistory();
    }
  }, [user, liftName, selectedReps]);

  const loadHistory = async () => {
    if (!user || !liftName) return;
    try {
      const q = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id),
        where("liftName", "==", liftName),
        where("reps", "==", selectedReps),
        orderBy("date", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];
      setHistory(results);
    } catch (err) {
      console.error("Error loading history:", err);
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
        liftName: liftName.trim(),
        weight: parseFloat(weight),
        reps: selectedReps,
        date: workoutDate,
        isPersonalRecord: false,
      });

      router.push("/workouts");
    } catch (err) {
      console.error("Error logging lift:", err);
      setError("Failed to log lift. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Lift Name */}
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

        {/* Entry Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          {/* Reps Picker */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Reps</p>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {[1, 2, 3, 4, 5].map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setSelectedReps(rep)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
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

          {/* Weight, Date, Save */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">Weight</p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="2.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <span className="text-gray-500 text-sm">lbs</span>
              </div>
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
              onClick={handleSubmit}
              disabled={submitting || !weight || !liftName.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300"
            >
              Save
            </button>
          </div>
        </div>

        {/* Training Percentages */}
        {latestWeight && (
          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-700">Training %</p>
              <p className="text-xs text-purple-600 font-medium">
                Latest: {latestWeight} x {selectedReps}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
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

        {/* Quick Weight Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">Quick Add</p>
          <div className="flex flex-wrap gap-2">
            {[45, 95, 135, 185, 225, 275, 315, 365, 405].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeight(w.toString())}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
      </main>
    </div>
  );
}
