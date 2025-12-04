"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AITrainerPaywallProps {
  onClose?: () => void;
  userEmail?: string;
  variant?: "athlete" | "coach";
}

export default function AITrainerPaywall({ onClose, variant = "athlete" }: AITrainerPaywallProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(false);

  const plans = {
    monthly: {
      price: 9.99,
      period: "month",
      savings: null,
    },
    yearly: {
      price: 79.99,
      period: "year",
      savings: "Save 33%",
    },
  };

  const athleteFeatures = [
    "Personalized weight recommendations based on YOUR lift history",
    "AI analyzes your past WOD performances for smart scaling",
    "Custom workout suggestions tailored to your fitness level",
    "Progress-aware coaching cues and advice",
    "Unlimited AI programming conversations",
  ];

  const coachFeatures = [
    "Generate weeks of programming in seconds with AI",
    "Describe what you want and let AI create the workouts",
    "Scan whiteboard photos to instantly digitize workouts",
    "AI-powered scaling suggestions for your athletes",
    "Smart workout variety - avoids repeating recent WODs",
  ];

  const features = variant === "coach" ? coachFeatures : athleteFeatures;

  const handleSubscribe = async () => {
    setIsLoading(true);
    router.push("/subscribe");
  };

  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 text-white">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
          {variant === "coach" ? (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>
        {variant === "coach" ? (
          <>
            <h2 className="text-2xl font-bold mb-2">Your AI Programming Assistant</h2>
            <p className="text-purple-200 text-sm">
              Let AI help you create professional programming for your athletes in seconds
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-2">Unlock Your Personal AI Coach</h2>
            <p className="text-purple-200 text-sm">
              Get personalized scaling and weight recommendations based on your actual workout history
            </p>
          </>
        )}
      </div>

      {/* Preview of what they're missing */}
      <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="font-semibold text-yellow-400">
            {variant === "coach" ? "Example AI Response" : "Sample AI Insight"}
          </span>
        </div>
        {variant === "coach" ? (
          <p className="text-sm text-purple-100 italic">
            &ldquo;Here&apos;s a strength-focused week with progressive loading. Monday: Back Squat 5x5 @ 75%,
            Wednesday: Deadlift 3x3 @ 80%, Friday: Front Squat 4x6 @ 70%. I&apos;ve paired each with
            complementary conditioning that won&apos;t interfere with recovery...&rdquo;
          </p>
        ) : (
          <p className="text-sm text-purple-100 italic">
            &ldquo;Based on your Back Squat PR of 225lb and recent Clean work at 155lb,
            I recommend trying 135lb thrusters today. This should let you maintain
            consistent sets while pushing your conditioning.&rdquo;
          </p>
        )}
      </div>

      {/* Features list */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3 text-purple-100">What you get:</h3>
        <ul className="space-y-2">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-purple-100">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pricing toggle */}
      <div className="flex justify-center mb-4">
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
            {plans.yearly.savings && (
              <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                {plans.yearly.savings}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Price display */}
      <div className="text-center mb-6">
        <div className="text-4xl font-bold">
          ${plans[selectedPlan].price}
          <span className="text-lg font-normal text-purple-200">/{plans[selectedPlan].period}</span>
        </div>
        {selectedPlan === "yearly" && (
          <p className="text-sm text-purple-200 mt-1">
            That&apos;s just ${(plans.yearly.price / 12).toFixed(2)}/month
          </p>
        )}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleSubscribe}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : variant === "coach" ? (
          "Unlock AI Programming"
        ) : (
          "Start Your AI Coaching"
        )}
      </button>

      {/* Trial info */}
      <p className="text-center text-xs text-purple-300 mt-3">
        7-day free trial. Cancel anytime. No commitment.
      </p>

      {/* Close button if modal */}
      {onClose && (
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-purple-300 hover:text-white text-sm transition-colors"
        >
          Maybe later
        </button>
      )}
    </div>
  );
}
