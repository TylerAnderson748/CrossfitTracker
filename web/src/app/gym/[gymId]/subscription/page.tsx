"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, PRICING, GymSubscription } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymSubscriptionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gymId = params.gymId as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"base" | "ai_programmer">("base");
  const [aiCoachEnabled, setAiCoachEnabled] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && gymId) {
      fetchGym();
    }
  }, [user, gymId]);

  const fetchGym = async () => {
    try {
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
        setGym(gymData);

        // Set current subscription values
        if (gymData.subscription) {
          setSelectedPlan(gymData.subscription.plan || "base");
          setAiCoachEnabled(gymData.subscription.aiCoachEnabled || false);
        }
      } else {
        router.push("/programming");
      }
    } catch (error) {
      console.error("Error fetching gym:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const isOwner = gym?.ownerId === user?.id;
  const hasActiveSubscription = gym?.subscription?.status === "active";
  const memberCount = (gym?.memberIds?.length || 0) + (gym?.coachIds?.length || 0) + 1;

  const calculateMonthlyTotal = () => {
    let total = PRICING.GYM_BASE;
    if (selectedPlan === "ai_programmer") {
      total += PRICING.GYM_AI_PROGRAMMER;
    }
    if (aiCoachEnabled) {
      total += PRICING.GYM_AI_COACH_PER_MEMBER * memberCount;
    }
    return total;
  };

  const handleSubscribe = async () => {
    if (!user || !gym) return;

    setIsProcessing(true);
    try {
      // In a real app, this would integrate with Stripe
      // For now, we'll just update the subscription status directly
      const subscriptionData: GymSubscription = {
        plan: selectedPlan,
        status: "active",
        aiProgrammerEnabled: selectedPlan === "ai_programmer",
        aiCoachEnabled: aiCoachEnabled,
        aiCoachMemberCount: aiCoachEnabled ? memberCount : 0,
        startDate: Timestamp.now(),
        currentPeriodEnd: Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        ),
      };

      await updateDoc(doc(db, "gyms", gymId), {
        subscription: subscriptionData,
      });

      await fetchGym();
      alert("Subscription activated successfully!");
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Failed to update subscription. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!user || !gym || !gym.subscription) return;

    setIsProcessing(true);
    try {
      const updatedSubscription: GymSubscription = {
        ...gym.subscription,
        plan: selectedPlan,
        aiProgrammerEnabled: selectedPlan === "ai_programmer",
        aiCoachEnabled: aiCoachEnabled,
        aiCoachMemberCount: aiCoachEnabled ? memberCount : 0,
      };

      await updateDoc(doc(db, "gyms", gymId), {
        subscription: updatedSubscription,
      });

      await fetchGym();
      alert("Subscription updated successfully!");
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Failed to update subscription. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || !gym || !gym.subscription) return;

    if (!confirm("Are you sure you want to cancel your subscription? Your gym features will be disabled.")) {
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "gyms", gymId), {
        "subscription.status": "canceled",
      });

      await fetchGym();
      alert("Subscription canceled.");
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Gym not found</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Only the gym owner can manage subscriptions</p>
          <button
            onClick={() => router.push(`/gym/${gymId}`)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to Gym
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/gym/${gymId}`)}
            className="text-gray-500 hover:text-gray-700 text-sm mb-2 flex items-center gap-1"
          >
            <span>←</span> Back to {gym.name}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Gym Subscription</h1>
          <p className="text-gray-500">Manage your gym&apos;s subscription and add-ons</p>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Status</h2>
            {hasActiveSubscription ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
                No Active Subscription
              </span>
            )}
          </div>

          {hasActiveSubscription && gym.subscription && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Plan:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {gym.subscription.plan === "ai_programmer" ? "Base + AI Programmer" : "Base"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">AI Coach:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {gym.subscription.aiCoachEnabled ? `Enabled (${memberCount} members)` : "Not enabled"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Next billing:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {gym.subscription.currentPeriodEnd?.toDate?.().toLocaleDateString() || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Members:</span>
                <span className="ml-2 font-medium text-gray-900">{memberCount}</span>
              </div>
            </div>
          )}

          {!hasActiveSubscription && (
            <p className="text-gray-600 text-sm">
              Subscribe to unlock gym management features, workout programming, and more.
            </p>
          )}
        </div>

        {/* Plan Selection */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Choose Your Plan</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Base Plan */}
            <button
              onClick={() => setSelectedPlan("base")}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                selectedPlan === "base"
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">Base Gym</h3>
                  <p className="text-gray-500 text-sm">Manual programming</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">${PRICING.GYM_BASE}</div>
                  <div className="text-gray-500 text-xs">/month</div>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Unlimited athletes
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Manual workout programming
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Class scheduling
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Athlete tracking
                </li>
              </ul>
            </button>

            {/* AI Programmer Plan */}
            <button
              onClick={() => setSelectedPlan("ai_programmer")}
              className={`p-6 rounded-xl border-2 text-left transition-all relative ${
                selectedPlan === "ai_programmer"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="absolute -top-3 right-4 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                Recommended
              </div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">Base + AI Programmer</h3>
                  <p className="text-gray-500 text-sm">AI-powered programming</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    ${PRICING.GYM_BASE + PRICING.GYM_AI_PROGRAMMER}
                  </div>
                  <div className="text-gray-500 text-xs">/month</div>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Everything in Base
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-500">★</span> AI-generated programming
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-500">★</span> Weekly cycle generation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-500">★</span> Programming assistant
                </li>
              </ul>
            </button>
          </div>

          {/* AI Coach Add-on */}
          <div className={`p-4 rounded-xl border-2 border-dashed ${
            aiCoachEnabled ? "border-green-400 bg-green-50" : "border-gray-300"
          }`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">AI Coach for Members</h4>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">ADD-ON</span>
                  </div>
                  <p className="text-gray-500 text-sm">Enable personal AI coaching for all {memberCount} members</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-green-600">+${PRICING.GYM_AI_COACH_PER_MEMBER * memberCount}</div>
                  <div className="text-gray-400 text-xs">${PRICING.GYM_AI_COACH_PER_MEMBER}/member/mo</div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={aiCoachEnabled}
                    onChange={(e) => setAiCoachEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors ${aiCoachEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-1 ${aiCoachEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Summary & Actions */}
        <div className="bg-gray-900 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Monthly Total</h3>
              <p className="text-gray-400 text-sm">Billed monthly, cancel anytime</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">${calculateMonthlyTotal().toFixed(2)}</div>
              <div className="text-gray-400 text-sm">/month</div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-300 mb-6">
            <div className="flex justify-between">
              <span>Base Gym</span>
              <span>${PRICING.GYM_BASE}</span>
            </div>
            {selectedPlan === "ai_programmer" && (
              <div className="flex justify-between">
                <span>AI Programmer Add-on</span>
                <span>+${PRICING.GYM_AI_PROGRAMMER}</span>
              </div>
            )}
            {aiCoachEnabled && (
              <div className="flex justify-between">
                <span>AI Coach ({memberCount} members)</span>
                <span>+${PRICING.GYM_AI_COACH_PER_MEMBER * memberCount}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {hasActiveSubscription ? (
              <>
                <button
                  onClick={handleCancelSubscription}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
                <button
                  onClick={handleUpdateSubscription}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Update Subscription"}
                </button>
              </>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={isProcessing}
                className="w-full py-3 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Subscribe Now"}
              </button>
            )}
          </div>

          <p className="text-gray-400 text-xs text-center mt-4">
            By subscribing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
}
