"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";
import AIProgrammingChat from "@/components/AIProgrammingChat";

function ProgrammingContent() {
  const { user, loading, switching, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep link from the calendar: regenerate a specific day in a specific session
  const regenDate = searchParams.get("regen");
  const regenSession = searchParams.get("session");

  // Cancel subscription state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // AI Coach subscription (personal scaling, advice, and programming)
  const aiCoachSubscription = user?.aiTrainerSubscription;
  const hasActiveAICoach = aiCoachSubscription?.status === "active" || aiCoachSubscription?.status === "trialing";

  const handleCancelSubscription = async () => {
    if (!user) return;

    setIsCanceling(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        "aiTrainerSubscription.status": "canceled",
      });
      await refreshUser();
      setShowCancelModal(false);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setIsCanceling(false);
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your AI Coach</h1>
          <p className="text-gray-500">Programming, scaling, and advice - built for your garage gym</p>
        </div>

        {/* AI Programming Chat - the heart of the app */}
        <div className="mb-8">
          <AIProgrammingChat
            userId={user.id}
            userEmail={user.email}
            subscription={aiCoachSubscription}
            athleteProfile={user.aiCoachPreferences}
            initialSessionId={regenSession || undefined}
            initialPrompt={regenDate
              ? `Regenerate my workout for ${regenDate}. Give me a fresh alternative for just that day that still fits the overall plan and my schedule.`
              : undefined}
            onPublish={() => router.push("/weekly")}
          />
        </div>

        {/* AI Coach toolkit */}
        {hasActiveAICoach && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/ai-coach/scan")}
              className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
            >
              <div className="text-3xl mb-2">📸</div>
              <h3 className="font-bold text-gray-900">Scan a Workout</h3>
              <p className="text-gray-500 text-sm mt-1">
                Photograph your whiteboard or handwritten notes and the AI digitizes them onto your calendar
              </p>
            </button>
            <button
              onClick={() => router.push("/weekly")}
              className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
            >
              <div className="text-3xl mb-2">📅</div>
              <h3 className="font-bold text-gray-900">My Calendar</h3>
              <p className="text-gray-500 text-sm mt-1">
                See your programmed week and get personalized scaling advice on today&apos;s workout
              </p>
            </button>
          </div>
        )}

        {/* Bring your own programming - always free */}
        <div className="mb-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">Bring Your Own Programming</h3>
                <p className="text-orange-100 text-sm mt-1">Follow another program? Track it here</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">FREE</div>
              <div className="text-orange-200 text-xs">included with tracking</div>
            </div>
          </div>

          <ul className="space-y-2 text-sm mb-6">
            <li className="flex items-center gap-2">
              <span className="text-white">✓</span> Add workouts from any provider to your calendar
            </li>
            <li className="flex items-center gap-2">
              <span className="text-white">✓</span> Log results and track PRs across every workout
            </li>
            <li className="flex items-center gap-2">
              <span className="text-white">✓</span> Your AI Coach can still give scaling advice on imported workouts
            </li>
          </ul>

          <button
            onClick={() => router.push("/weekly")}
            className="w-full px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-orange-50 transition-colors"
          >
            Start Tracking - Free
          </button>
        </div>

        {/* Subscription management */}
        {hasActiveAICoach && aiCoachSubscription && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                  {aiCoachSubscription.status === "trialing" ? "Free Trial" : "Active"}
                </span>
                <span className="text-gray-600">
                  AI Coach {aiCoachSubscription.status === "trialing" ? "trial ends" : "renews"}{" "}
                  {(aiCoachSubscription.status === "trialing"
                    ? aiCoachSubscription.trialEndsAt?.toDate?.().toLocaleDateString()
                    : aiCoachSubscription.endDate?.toDate?.().toLocaleDateString()) || "N/A"}
                </span>
              </div>
              <button
                onClick={() => setShowCancelModal(true)}
                className="text-red-500 hover:text-red-600 hover:underline"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription?</h2>
              <p className="text-gray-600">
                Are you sure you want to cancel your AI Coach subscription?
                You&apos;ll lose access to AI programming, scaling, and coaching advice immediately.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCanceling}
                className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isCanceling ? "Canceling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgrammingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <ProgrammingContent />
    </Suspense>
  );
}
