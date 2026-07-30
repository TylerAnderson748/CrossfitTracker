"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { TrainingPlan } from "@/lib/types";
import Navigation from "@/components/Navigation";
import PlanTable, { PlanDayStatus } from "@/components/PlanTable";

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PlanPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [statusByDate, setStatusByDate] = useState<Record<string, PlanDayStatus>>({});
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingData(true);
      try {
        // Most recently updated plan for this user
        const planSnap = await getDocs(query(
          collection(db, "trainingPlans"),
          where("userId", "==", user.id)
        ));
        const plans = planSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as TrainingPlan))
          .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        const latest = plans[0] || null;
        setPlan(latest);

        if (latest) {
          // Build the set of dates with any logged training
          const loggedDates = new Set<string>();

          const [wodSnap, liftSnap, skillSnap, cardioSnap, classSnap] = await Promise.all([
            getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.id))),
            getDocs(query(collection(db, "liftResults"), where("userId", "==", user.id))),
            getDocs(query(collection(db, "skillResults"), where("userId", "==", user.id))),
            getDocs(query(collection(db, "cardioLogs"), where("userId", "==", user.id))),
            getDocs(query(collection(db, "classLogs"), where("userId", "==", user.id))),
          ]);
          wodSnap.docs.forEach(d => {
            const dt = d.data().workoutDate?.toDate?.() || d.data().completedDate?.toDate?.();
            if (dt) loggedDates.add(toLocalDateString(dt));
          });
          [liftSnap, skillSnap, cardioSnap, classSnap].forEach(snap => {
            snap.docs.forEach(d => {
              const ds = d.data().dateString;
              if (ds) { loggedDates.add(ds); return; }
              const dt = d.data().date?.toDate?.();
              if (dt) loggedDates.add(toLocalDateString(dt));
            });
          });

          const today = toLocalDateString(new Date());
          const status: Record<string, PlanDayStatus> = {};
          latest.rows.forEach(row => {
            if (!row.date) return;
            if (row.date === today) status[row.date] = "today";
            else if (loggedDates.has(row.date)) status[row.date] = "done";
            else if (row.date < today) status[row.date] = "missed";
            else status[row.date] = "upcoming";
          });
          setStatusByDate(status);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Quick stats from statuses
  const doneCount = Object.values(statusByDate).filter(s => s === "done").length;
  const trainingDays = plan ? plan.rows.filter(r => !r.session.toLowerCase().includes("rest")).length : 0;
  const totalMiles = plan ? plan.rows.reduce((sum, r) => sum + (r.runMiles || 0), 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Plan</h1>
            {plan && (
              <p className="text-gray-500 text-sm">
                {plan.startDate} → {plan.endDate} • {plan.rows.length} days • {plan.status === "locked" ? "Locked" : "Draft"}
              </p>
            )}
          </div>
          {plan && (
            <div className="flex gap-3 text-sm">
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-center">
                <div className="font-bold text-gray-900">{doneCount}/{trainingDays}</div>
                <div className="text-xs text-gray-500">sessions logged</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-center">
                <div className="font-bold text-gray-900">{Math.round(totalMiles)}</div>
                <div className="text-xs text-gray-500">planned miles</div>
              </div>
            </div>
          )}
        </div>

        {loadingData ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : !plan ? (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="font-bold text-gray-900 mb-2">No training plan yet</h2>
            <p className="text-gray-500 text-sm mb-4">
              Ask your AI Coach to build one - it creates a day-by-day plan table you can review, revise, and lock onto your calendar.
            </p>
            <Link
              href="/programming"
              className="inline-block px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
              Build My Plan
            </Link>
          </div>
        ) : (
          <>
            <PlanTable rows={plan.rows} statusByDate={statusByDate} />
            <p className="text-xs text-gray-400 mt-3">
              ✓ logged • ✗ past day with no log • ● today. Want changes? Open your{" "}
              <Link href="/programming" className="text-purple-600 hover:underline">AI Coach chat</Link>{" "}
              and tell it what to adjust - only the affected days get rewritten.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
