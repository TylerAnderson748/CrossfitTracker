"use client";

import { PRICING } from "@/lib/types";

interface PricingComparisonProps {
  onSelectPlan: (plan: "individual-external" | "individual-ai-programmer" | "gym-base" | "gym-ai-programmer") => void;
  currentPlan?: string;
}

export default function PricingComparison({ onSelectPlan, currentPlan }: PricingComparisonProps) {
  return (
    <div className="space-y-8">
      {/* Individual Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm">👤</span>
          Individual Plans
        </h3>
        <p className="text-gray-500 text-sm mb-4">For athletes training on their own</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* External Programming Plan */}
          <div className={`relative rounded-2xl border-2 p-6 transition-all ${
            currentPlan === "individual-external"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-md"
          }`}>
            {currentPlan === "individual-external" && (
              <div className="absolute -top-3 left-4 px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
                Current Plan
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900">External Programming</h4>
                <p className="text-gray-500 text-sm">Import your own workouts</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">${PRICING.INDIVIDUAL_EXTERNAL_PROGRAMMING}</div>
                <div className="text-gray-500 text-xs">/month</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Manual workout import
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Photo scan import
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Progress tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Weekly calendar view
              </li>
            </ul>
            <button
              onClick={() => onSelectPlan("individual-external")}
              disabled={currentPlan === "individual-external"}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === "individual-external"
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {currentPlan === "individual-external" ? "Current Plan" : "Select Plan"}
            </button>
          </div>

          {/* AI Programmer Plan */}
          <div className={`relative rounded-2xl border-2 p-6 transition-all ${
            currentPlan === "individual-ai-programmer"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-md"
          }`}>
            <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded-full">
              Most Popular
            </div>
            {currentPlan === "individual-ai-programmer" && (
              <div className="absolute -top-3 left-4 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                Current Plan
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900">AI Programmer</h4>
                <p className="text-gray-500 text-sm">AI-generated workouts</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">${PRICING.INDIVIDUAL_AI_PROGRAMMER}</div>
                <div className="text-gray-500 text-xs">/month</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Custom AI-generated WODs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Weekly programming cycles
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Goal-focused training
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Home gym equipment support
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Everything in External Programming
              </li>
            </ul>
            <button
              onClick={() => onSelectPlan("individual-ai-programmer")}
              disabled={currentPlan === "individual-ai-programmer"}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === "individual-ai-programmer"
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
              }`}
            >
              {currentPlan === "individual-ai-programmer" ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        </div>

        {/* AI Coach Add-on */}
        <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">AI Coach Add-on</h4>
                <p className="text-gray-500 text-sm">Personal scaling & coaching for any workout</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">+${PRICING.INDIVIDUAL_AI_COACH}</div>
              <div className="text-gray-500 text-xs">/month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gym Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">🏢</span>
          Gym Owner Plans
        </h3>
        <p className="text-gray-500 text-sm mb-4">For gym owners managing athletes and programming</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Gym Plan */}
          <div className={`relative rounded-2xl border-2 p-6 transition-all ${
            currentPlan === "gym-base"
              ? "border-gray-500 bg-gray-50"
              : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-md"
          }`}>
            {currentPlan === "gym-base" && (
              <div className="absolute -top-3 left-4 px-3 py-1 bg-gray-700 text-white text-xs font-medium rounded-full">
                Current Plan
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900">Base Gym</h4>
                <p className="text-gray-500 text-sm">Manual programming</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">${PRICING.GYM_BASE}</div>
                <div className="text-gray-500 text-xs">/month</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Unlimited athletes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Manual workout programming
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Import external programming
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Athlete progress tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Class scheduling
              </li>
            </ul>
            <button
              onClick={() => onSelectPlan("gym-base")}
              disabled={currentPlan === "gym-base"}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === "gym-base"
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-800 text-white hover:bg-gray-900"
              }`}
            >
              {currentPlan === "gym-base" ? "Current Plan" : "Select Plan"}
            </button>
          </div>

          {/* Gym + AI Programmer */}
          <div className={`relative rounded-2xl border-2 p-6 transition-all ${
            currentPlan === "gym-ai-programmer"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-md"
          }`}>
            <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded-full">
              Best Value
            </div>
            {currentPlan === "gym-ai-programmer" && (
              <div className="absolute -top-3 left-4 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                Current Plan
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900">Gym + AI Programmer</h4>
                <p className="text-gray-500 text-sm">AI-powered programming</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">${PRICING.GYM_BASE + PRICING.GYM_AI_PROGRAMMER}</div>
                <div className="text-gray-500 text-xs">/month</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Everything in Base Gym
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">★</span> AI-generated programming
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">★</span> Weekly cycle generation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">★</span> Programming assistant chat
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-500">★</span> Custom training philosophy
              </li>
            </ul>
            <button
              onClick={() => onSelectPlan("gym-ai-programmer")}
              disabled={currentPlan === "gym-ai-programmer"}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === "gym-ai-programmer"
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
              }`}
            >
              {currentPlan === "gym-ai-programmer" ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        </div>

        {/* AI Coach for Gym Members */}
        <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">AI Coach for Members</h4>
                <p className="text-gray-500 text-sm">Enable personal AI coaching for all gym members</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">+${PRICING.GYM_AI_COACH_PER_MEMBER}</div>
              <div className="text-gray-500 text-xs">/member/month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-4">Pricing Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Individual Athletes</h5>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>External Programming</span>
                <span className="font-medium">${PRICING.INDIVIDUAL_EXTERNAL_PROGRAMMING}/mo</span>
              </div>
              <div className="flex justify-between">
                <span>AI Programmer</span>
                <span className="font-medium">${PRICING.INDIVIDUAL_AI_PROGRAMMER}/mo</span>
              </div>
              <div className="flex justify-between">
                <span>AI Coach (add-on)</span>
                <span className="font-medium">+${PRICING.INDIVIDUAL_AI_COACH}/mo</span>
              </div>
            </div>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Gym Owners</h5>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Base Gym</span>
                <span className="font-medium">${PRICING.GYM_BASE}/mo</span>
              </div>
              <div className="flex justify-between">
                <span>AI Programmer (add-on)</span>
                <span className="font-medium">+${PRICING.GYM_AI_PROGRAMMER}/mo</span>
              </div>
              <div className="flex justify-between">
                <span>AI Coach for members</span>
                <span className="font-medium">+${PRICING.GYM_AI_COACH_PER_MEMBER}/member/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
