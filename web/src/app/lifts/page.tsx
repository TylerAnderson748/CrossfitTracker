"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { LiftResult } from "@/lib/types";
import Navigation from "@/components/Navigation";

const COMMON_LIFTS = [
  "Back Squat",
  "Front Squat",
  "Deadlift",
  "Snatch",
  "Clean",
  "Clean & Jerk",
  "Overhead Press",
  "Bench Press",
];

export default function LiftsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lifts, setLifts] = useState<LiftResult[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedLift, setSelectedLift] = useState<string>("Back Squat");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("1");
  const [customLift, setCustomLift] = useState("");
  const [isCustomLift, setIsCustomLift] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchLifts();
    }
  }, [user]);

  const fetchLifts = async () => {
    if (!user) return;

    try {
      const liftsQuery = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(liftsQuery);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];
      setLifts(data);
    } catch (error) {
      console.error("Error fetching lifts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddLift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) return;

    setSubmitting(true);

    try {
      const liftName = isCustomLift ? customLift : selectedLift;

      // Check if this is a PR
      const existingLifts = lifts.filter(
        (l) => l.liftName === liftName && l.reps === parseInt(newReps)
      );
      const currentMax = existingLifts.length > 0
        ? Math.max(...existingLifts.map((l) => l.weight))
        : 0;
      const isPersonalRecord = weight > currentMax;

      await addDoc(collection(db, "liftResults"), {
        userId: user.id,
        liftName,
        weight,
        reps: parseInt(newReps),
        date: Timestamp.now(),
        isPersonalRecord,
      });

      // Reset form
      setNewWeight("");
      setShowAddForm(false);
      fetchLifts();
    } catch (error) {
      console.error("Error adding lift:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Get unique lift names from user's data + common lifts
  const allLiftNames = [
    ...new Set([...COMMON_LIFTS, ...lifts.map((l) => l.liftName)]),
  ].sort();

  // Group lifts by name
  const liftsByName: { [name: string]: LiftResult[] } = {};
  lifts.forEach((lift) => {
    if (!liftsByName[lift.liftName]) {
      liftsByName[lift.liftName] = [];
    }
    liftsByName[lift.liftName].push(lift);
  });

  // Get PR for each rep range
  const getPRForReps = (liftName: string, reps: number): number => {
    const liftEntries = liftsByName[liftName] || [];
    const filtered = liftEntries.filter((l) => l.reps === reps);
    if (filtered.length === 0) return 0;
    return Math.max(...filtered.map((l) => l.weight));
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lift Tracking</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Log Lift
          </button>
        </div>

        {/* Add Lift Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Log Lift</h2>
              <form onSubmit={handleAddLift} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <input
                      type="checkbox"
                      checked={isCustomLift}
                      onChange={(e) => setIsCustomLift(e.target.checked)}
                      className="rounded"
                    />
                    Custom lift name
                  </label>

                  {isCustomLift ? (
                    <input
                      type="text"
                      value={customLift}
                      onChange={(e) => setCustomLift(e.target.value)}
                      placeholder="Enter lift name"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  ) : (
                    <select
                      value={selectedLift}
                      onChange={(e) => setSelectedLift(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      {allLiftNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Weight (lbs)
                    </label>
                    <input
                      type="number"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="2.5"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Reps
                    </label>
                    <select
                      value={newReps}
                      onChange={(e) => setNewReps(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="1">1 Rep Max</option>
                      <option value="2">2 Rep Max</option>
                      <option value="3">3 Rep Max</option>
                      <option value="5">5 Rep Max</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 rounded-lg font-medium transition-colors"
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loadingData ? (
          <p className="text-gray-400">Loading lifts...</p>
        ) : Object.keys(liftsByName).length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No lifts logged yet.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-orange-500 hover:underline"
            >
              Log your first lift
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(liftsByName).map(([liftName, liftEntries]) => (
              <div key={liftName} className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">{liftName}</h3>

                {/* PRs by rep */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[1, 2, 3, 5].map((reps) => {
                    const pr = getPRForReps(liftName, reps);
                    return (
                      <div key={reps} className="text-center">
                        <div className="text-xs text-gray-400 mb-1">{reps}RM</div>
                        <div className="text-lg font-bold text-orange-500">
                          {pr > 0 ? `${pr}` : "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent entries */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-sm text-gray-400 mb-2">Recent</div>
                  <div className="space-y-2">
                    {liftEntries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="text-gray-300">
                          {entry.weight} lbs x {entry.reps}
                          {entry.isPersonalRecord && (
                            <span className="ml-2 text-yellow-500">PR</span>
                          )}
                        </span>
                        <span className="text-gray-500">
                          {entry.date?.toDate?.()?.toLocaleDateString() || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
