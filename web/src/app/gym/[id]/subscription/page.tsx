"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, GymSubscription, PRICING } from "@/lib/types";
import Navigation from "@/components/Navigation";

type PlanSelection = "base" | "ai_programmer";

export default function GymSubscriptionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gymId = params.id as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [loadingGym, setLoadingGym] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>("base");
  const [aiCoachEnabled, setAiCoachEnabled] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (gymId && user) {
      fetchGym();
    }
  }, [gymId, user]);

  const fetchGym = async () => {
    try {
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
        setGym(gymData);
        setMemberCount(gymData.memberIds?.length || 0);

        // Set current subscription state
        if (gymData.subscription) {
          setSelectedPlan(gymData.subscription.aiProgrammerEnabled ? "ai_programmer" : "base");
          setAiCoachEnabled(gymData.subscription.aiCoachEnabled || false);
        }
      }
    } catch (error) {
      console.error("Error fetching gym:", error);
    } finally {
      setLoadingGym(false);
    }
  };

  const calculateMonthlyTotal = () => {
    let total = PRICING.GYM_BASE;
    if (selectedPlan === "ai_programmer") {
      total += PRICING.GYM_AI_PROGRAMMER;
    }
    if (aiCoachEnabled) {
      total += memberCount * PRICING.GYM_AI_COACH_PER_MEMBER;
    }
    return total;
  };

  const handleSubscribe = async () => {
    if (!gym || !user) return;

    // Check if user is the owner
    if (gym.ownerId !== user.id) {
      alert("Only the gym owner can manage the subscription.");
      return;
    }

    setIsSaving(true);
    try {
      // Determine dates based on upgrade vs downgrade
      const existingSubscription = gym.subscription;
      const isNewSubscription = !existingSubscription?.status || existingSubscription.status !== "active";

      // Keep existing period end date when downgrading, otherwise set new 30-day period
      const periodEndDate = isNewSubscription
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : existingSubscription?.currentPeriodEnd?.toDate() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const subscription: GymSubscription = {
        plan: selectedPlan === "ai_programmer" ? "ai_programmer" : "base",
        status: "active",
        aiProgrammerEnabled: selectedPlan === "ai_programmer",
        aiCoachEnabled: aiCoachEnabled,
        aiCoachMemberCount: aiCoachEnabled ? memberCount : 0,
        startDate: existingSubscription?.startDate || Timestamp.now(),
        currentPeriodEnd: Timestamp.fromDate(periodEndDate),
      };

      // If downgrading from AI Programmer, schedule the end date
      if (currentlyHasAiProgrammer && selectedPlan === "base") {
        subscription.aiProgrammerEndsAt = Timestamp.fromDate(periodEndDate);
        // Keep AI Programmer active until period ends
        subscription.aiProgrammerEnabled = true;
      } else if (selectedPlan === "ai_programmer") {
        // If upgrading to AI Programmer, clear any scheduled end
        subscription.aiProgrammerEndsAt = undefined;
      }

      // Same logic for AI Coach
      const currentlyHasAiCoach = existingSubscription?.aiCoachEnabled || false;
      if (currentlyHasAiCoach && !aiCoachEnabled) {
        subscription.aiCoachEndsAt = Timestamp.fromDate(periodEndDate);
        // Keep AI Coach active until period ends
        subscription.aiCoachEnabled = true;
        subscription.aiCoachMemberCount = existingSubscription?.aiCoachMemberCount || memberCount;
      } else if (aiCoachEnabled) {
        subscription.aiCoachEndsAt = undefined;
      }

      await updateDoc(doc(db, "gyms", gymId), {
        subscription,
        pricingEnabled: true,
      });

      const message = isDowngradingAiProgrammer
        ? `AI Programmer will remain active until ${formatDate(periodEndDate)}`
        : "Subscription updated successfully!";
      alert(message);
      router.push(`/gym/${gymId}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Failed to update subscription. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || loadingGym) {
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

  if (gym.ownerId !== user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Only the gym owner can access this page</p>
      </div>
    );
  }

  const hasActiveSubscription = gym.subscription?.status === "active";
  const currentlyHasAiProgrammer = gym.subscription?.aiProgrammerEnabled || false;
  const isDowngradingAiProgrammer = currentlyHasAiProgrammer && selectedPlan === "base";
  const currentPeriodEnd = gym.subscription?.currentPeriodEnd?.toDate();

  // Check if there's a pending cancellation for AI Programmer
  const aiProgrammerEndsAt = gym.subscription?.aiProgrammerEndsAt?.toDate();
  const hasScheduledAiProgrammerEnd = aiProgrammerEndsAt && aiProgrammerEndsAt > new Date();

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <span>←</span> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Gym Subscription</h1>
          <p className="text-gray-500">Manage your gym&apos;s subscription and features</p>
        </div>

        {/* Gym Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏢</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{gym.name}</h2>
              <p className="text-gray-500 text-sm">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </p>
            </div>
            {hasActiveSubscription && (
              <div className="ml-auto px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                Active
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Cancellation Notice */}
        {hasScheduledAiProgrammerEnd && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-amber-800">AI Programmer Ending Soon</h3>
                <p className="text-amber-700 text-sm">
                  Your AI Programmer access will end on <strong>{formatDate(aiProgrammerEndsAt)}</strong>.
                  You can re-subscribe anytime to keep access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Downgrade Warning */}
        {isDowngradingAiProgrammer && !hasScheduledAiProgrammerEnd && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <h3 className="font-semibold text-blue-800">Downgrading to Base Plan</h3>
                <p className="text-blue-700 text-sm">
                  Your AI Programmer access will remain active until <strong>{formatDate(currentPeriodEnd)}</strong>.
                  After that date, you&apos;ll lose access to AI-generated programming.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Your Plan</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Base Plan */}
            <button
              onClick={() => setSelectedPlan("base")}
              className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                selectedPlan === "base"
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {selectedPlan === "base" && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <div className="text-2xl font-bold text-gray-900 mb-1">
                ${PRICING.GYM_BASE}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </div>
              <div className="font-semibold text-gray-900 mb-2">Base Gym</div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Unlimited athletes</li>
                <li>• Manual programming</li>
                <li>• Import external programming</li>
                <li>• Class scheduling</li>
              </ul>
            </button>

            {/* AI Programmer Plan */}
            <button
              onClick={() => setSelectedPlan("ai_programmer")}
              className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                selectedPlan === "ai_programmer"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                ADD-ON
              </div>
              {selectedPlan === "ai_programmer" && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <div className="text-2xl font-bold text-gray-900 mb-1">
                ${PRICING.GYM_BASE + PRICING.GYM_AI_PROGRAMMER}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </div>
              <div className="font-semibold text-gray-900 mb-2">Base + AI Programmer</div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Everything in Base</li>
                <li className="text-purple-600">• AI-generated programming</li>
                <li className="text-purple-600">• Programming assistant chat</li>
                <li className="text-purple-600">• Custom training philosophy</li>
              </ul>
            </button>
          </div>

          {/* AI Coach Add-on */}
          <div className={`rounded-xl border-2 border-dashed p-5 transition-all ${
            aiCoachEnabled ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                      ADD-ON
                    </span>
                    <h4 className="font-semibold text-gray-900">AI Coach for Members</h4>
                  </div>
                  <p className="text-gray-500 text-sm">
                    Personal AI coaching for all {memberCount} members
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    +${memberCount * PRICING.GYM_AI_COACH_PER_MEMBER}
                    <span className="text-sm font-normal text-gray-500">/mo</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ${PRICING.GYM_AI_COACH_PER_MEMBER}/member
                  </div>
                </div>
                <button
                  onClick={() => setAiCoachEnabled(!aiCoachEnabled)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    aiCoachEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      aiCoachEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Base Gym</span>
              <span>${PRICING.GYM_BASE}</span>
            </div>
            {selectedPlan === "ai_programmer" && (
              <div className="flex justify-between text-purple-600">
                <span>AI Programmer Add-on</span>
                <span>+${PRICING.GYM_AI_PROGRAMMER}</span>
              </div>
            )}
            {aiCoachEnabled && (
              <div className="flex justify-between text-green-600">
                <span>AI Coach ({memberCount} members)</span>
                <span>+${memberCount * PRICING.GYM_AI_COACH_PER_MEMBER}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-gray-900">
                ${calculateMonthlyTotal()}/mo
              </span>
            </div>
          </div>
        </div>

        {/* Subscribe Button */}
        <button
          onClick={handleSubscribe}
          disabled={isSaving}
          className={`w-full py-4 font-semibold rounded-xl transition-colors disabled:opacity-50 ${
            isDowngradingAiProgrammer
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-gray-900 hover:bg-gray-800 text-white"
          }`}
        >
          {isSaving
            ? "Processing..."
            : isDowngradingAiProgrammer
            ? "Downgrade Plan"
            : hasActiveSubscription
            ? "Update Subscription"
            : "Subscribe Now"}
        </button>

        <p className="text-center text-gray-500 text-sm mt-4">
          You can cancel or modify your subscription at any time.
        </p>
      </main>
    </div>
  );
}
