"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";
import { AITrainerSubscription, AICoachPreferences } from "@/lib/types";

export default function SubscribePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showGoalsStep, setShowGoalsStep] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsForm, setGoalsForm] = useState<AICoachPreferences>({
    goals: "",
    injuries: "",
    experienceLevel: "intermediate",
    focusAreas: [],
  });

  const plans = {
    monthly: {
      price: 9.99,
      period: "month",
      savings: null,
      trialDays: 7,
    },
    yearly: {
      price: 79.99,
      period: "year",
      savings: "Save 33%",
      monthlyEquivalent: 6.67,
      trialDays: 7,
    },
  };

  const features = [
    { icon: "🎯", text: "Personalized weight recommendations based on YOUR lift history" },
    { icon: "📊", text: "AI analyzes your past WOD performances for smart scaling" },
    { icon: "🏋️", text: "Custom workout suggestions tailored to your fitness level" },
    { icon: "💪", text: "Progress-aware coaching cues and advice" },
    { icon: "🤖", text: "Unlimited AI programming conversations" },
    { icon: "📈", text: "Track your progress with intelligent insights" },
  ];

  const handleStartTrial = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setIsProcessing(true);
    try {
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const subscription: AITrainerSubscription = {
        tier: "pro",
        status: "trialing",
        startDate: Timestamp.fromDate(now),
        trialEndsAt: Timestamp.fromDate(trialEndsAt),
      };

      await updateDoc(doc(db, "users", user.id), {
        aiTrainerSubscription: subscription,
      });

      setShowGoalsStep(true);
    } catch (error) {
      console.error("Error starting trial:", error);
      alert("Failed to start trial. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setIsProcessing(true);
    try {
      const now = new Date();
      const endDate = selectedPlan === "yearly"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const subscription: AITrainerSubscription = {
        tier: "pro",
        status: "active",
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(endDate),
      };

      await updateDoc(doc(db, "users", user.id), {
        aiTrainerSubscription: subscription,
      });

      setShowGoalsStep(true);
    } catch (error) {
      console.error("Error subscribing:", error);
      alert("Failed to subscribe. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    setGoalsForm(prev => ({
      ...prev,
      focusAreas: prev.focusAreas?.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...(prev.focusAreas || []), area],
    }));
  };

  const handleSaveGoals = async () => {
    if (!user) return;

    setSavingGoals(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        aiCoachPreferences: {
          ...goalsForm,
          updatedAt: Timestamp.now(),
        },
      });
      router.push("/weekly");
    } catch (error) {
      console.error("Error saving goals:", error);
      alert("Failed to save goals. Please try again.");
    } finally {
      setSavingGoals(false);
    }
  };

  const handleSkipGoals = () => {
    router.push("/weekly");
  };

  // Check if user already has an active subscription
  const hasActiveSubscription = user?.aiTrainerSubscription?.status === "active" ||
    user?.aiTrainerSubscription?.status === "trialing";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (showGoalsStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="max-w-xl mx-auto px-4 py-12">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to AI Coach!</h1>
            <p className="text-purple-200">Let&apos;s personalize your experience</p>
          </div>

          {/* Goals Form */}
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-bold text-gray-900">Tell us about your goals</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              This helps your AI Coach give you better personalized advice. You can always update this later in your profile.
            </p>

            <div className="space-y-5">
              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What are your fitness goals?
                </label>
                <textarea
                  value={goalsForm.goals || ""}
                  onChange={(e) => setGoalsForm({ ...goalsForm, goals: e.target.value })}
                  placeholder="e.g., Get my first muscle-up, improve my 5K time, increase my back squat to 300lbs..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Injuries/Limitations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Any injuries or limitations?
                </label>
                <textarea
                  value={goalsForm.injuries || ""}
                  onChange={(e) => setGoalsForm({ ...goalsForm, injuries: e.target.value })}
                  placeholder="e.g., Recovering from shoulder surgery, bad knees, avoid overhead movements..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Level
                </label>
                <select
                  value={goalsForm.experienceLevel || "intermediate"}
                  onChange={(e) => setGoalsForm({ ...goalsForm, experienceLevel: e.target.value as AICoachPreferences["experienceLevel"] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner (0-1 years)</option>
                  <option value="intermediate">Intermediate (1-3 years)</option>
                  <option value="advanced">Advanced (3-5 years)</option>
                  <option value="competitor">Competitor (5+ years)</option>
                </select>
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Areas (select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Strength", "Cardio/Endurance", "Gymnastics", "Olympic Lifting", "Mobility", "Weight Loss", "Competition Prep"].map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleFocusArea(area)}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        goalsForm.focusAreas?.includes(area)
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSkipGoals}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleSaveGoals}
                  disabled={savingGoals}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-colors font-bold"
                >
                  {savingGoals ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Coach Subscription</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Get personalized scaling and weight recommendations powered by AI that learns from your workout history
          </p>
        </div>

        {hasActiveSubscription ? (
          /* Already subscribed view */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Already Subscribed!</h2>
            <p className="text-gray-600 mb-4">
              {user?.aiTrainerSubscription?.status === "trialing"
                ? "You're currently on a free trial. Enjoy your AI Coach!"
                : "You have an active AI Coach subscription."}
            </p>
            {user?.aiTrainerSubscription?.trialEndsAt && (
              <p className="text-sm text-purple-600 mb-4">
                Trial ends: {user.aiTrainerSubscription.trialEndsAt.toDate().toLocaleDateString()}
              </p>
            )}
            <button
              onClick={() => router.push("/weekly")}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Go to My Training
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Features Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">What You Get</h2>
              <div className="space-y-4">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    <p className="text-gray-700">{feature.text}</p>
                  </div>
                ))}
              </div>

              {/* Sample insight */}
              <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-semibold text-purple-900">Sample AI Insight</span>
                </div>
                <p className="text-sm text-purple-800 italic">
                  &ldquo;Based on your Back Squat PR of 225lb and recent Clean work at 155lb,
                  I recommend trying 135lb thrusters today. This should let you maintain
                  consistent sets while pushing your conditioning.&rdquo;
                </p>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 text-white">
              <h2 className="text-xl font-bold mb-6 text-center">Choose Your Plan</h2>

              {/* Plan Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-white/10 rounded-lg p-1 flex gap-1">
                  <button
                    onClick={() => setSelectedPlan("monthly")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedPlan === "monthly"
                        ? "bg-white text-purple-900"
                        : "text-purple-200 hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setSelectedPlan("yearly")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      selectedPlan === "yearly"
                        ? "bg-white text-purple-900"
                        : "text-purple-200 hover:text-white"
                    }`}
                  >
                    Yearly
                    <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                      Save 33%
                    </span>
                  </button>
                </div>
              </div>

              {/* Price Display */}
              <div className="text-center mb-6">
                <div className="text-5xl font-bold">
                  ${plans[selectedPlan].price}
                  <span className="text-lg font-normal text-purple-200">/{plans[selectedPlan].period}</span>
                </div>
                {selectedPlan === "yearly" && (
                  <p className="text-sm text-purple-200 mt-1">
                    That&apos;s just ${plans.yearly.monthlyEquivalent}/month
                  </p>
                )}
              </div>

              {/* Trial CTA */}
              <div className="space-y-3">
                <button
                  onClick={handleStartTrial}
                  disabled={isProcessing}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Start 7-Day Free Trial"
                  )}
                </button>

                <p className="text-center text-xs text-purple-300">
                  No credit card required. Cancel anytime.
                </p>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-purple-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-purple-800 text-purple-300">or</span>
                  </div>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Subscribe Now - ${plans[selectedPlan].price}/{plans[selectedPlan].period}
                </button>
              </div>

              {/* Guarantee */}
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-purple-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>100% satisfaction guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">How does the AI Coach work?</h3>
              <p className="text-gray-600 text-sm">
                The AI Coach analyzes your workout history, lift PRs, and WOD performances to provide personalized recommendations. It considers your strength levels, recent performance trends, and the specific demands of each workout.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Can I cancel anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">What happens after my free trial?</h3>
              <p className="text-gray-600 text-sm">
                After your 7-day free trial, you&apos;ll be asked to subscribe to continue using the AI Coach features. You won&apos;t be charged automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Is my data secure?</h3>
              <p className="text-gray-600 text-sm">
                Absolutely. Your workout data is securely stored and only used to provide you with personalized recommendations. We never share your data with third parties.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
