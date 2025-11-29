"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
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

export default function LiftPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("1");
  const [isPersonalRecord, setIsPersonalRecord] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) return;

    if (!liftName.trim()) {
      setError("Please enter a lift name");
      return;
    }

    if (!weight || parseFloat(weight) <= 0) {
      setError("Please enter a valid weight");
      return;
    }

    setSubmitting(true);

    try {
      const now = Timestamp.now();

      // Add to liftResults collection
      await addDoc(collection(db, "liftResults"), {
        userId: user.id,
        liftName: liftName.trim(),
        weight: parseFloat(weight),
        reps: parseInt(reps) || 1,
        date: now,
        isPersonalRecord,
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
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Log a Lift</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Lift Name */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Lift Name
            </label>
            <input
              type="text"
              value={liftName}
              onChange={(e) => setLiftName(e.target.value)}
              placeholder="e.g., Back Squat"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
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

          {/* Weight and Reps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-6">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reps
                </label>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="1"
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Quick Weight Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Quick Add Weight
            </label>
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

          {/* Personal Record */}
          <label className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <input
              type="checkbox"
              checked={isPersonalRecord}
              onChange={(e) => setIsPersonalRecord(e.target.checked)}
              className="w-5 h-5 rounded text-yellow-500"
            />
            <span className="font-medium text-gray-700">This is a Personal Record (PR)</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : "Save Lift"}
          </button>
        </form>
      </main>
    </div>
  );
}
