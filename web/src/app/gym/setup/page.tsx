"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { GymApplication, GymSubscription, PRICING } from "@/lib/types";
import Navigation from "@/components/Navigation";

type PlanSelection = "base" | "ai_programmer";

function GymSetupContent() {
  const { user, loading, switching, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");

  const [approvedApplication, setApprovedApplication] = useState<GymApplication | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>("base");
  const [aiCoachEnabled, setAiCoachEnabled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user && !switching) {
      fetchApprovedApplication();
    }
  }, [user, switching, applicationId]);

  const fetchApprovedApplication = async () => {
    if (!user) return;

    try {
      // If we have an applicationId from URL, fetch it directly
      if (applicationId) {
        const appDoc = await getDoc(doc(db, "gymApplications", applicationId));
        if (appDoc.exists()) {
          const app = { id: appDoc.id, ...appDoc.data() } as GymApplication;
          // Verify this application belongs to the user and is approved
          if (app.userId === user.id && app.status === "approved" && !app.approvedGymId) {
            setApprovedApplication(app);
            setLoadingData(false);
            return;
          }
        }
      }

      // Fallback: Query for approved applications
      const applicationsQuery = query(
        collection(db, "gymApplications"),
        where("userId", "==", user.id)
      );
      const snapshot = await getDocs(applicationsQuery);

      // Find approved application without gym created
      for (const docSnap of snapshot.docs) {
        const app = { id: docSnap.id, ...docSnap.data() } as GymApplication;
        if (app.status === "approved") {
          if (!app.approvedGymId) {
            setApprovedApplication(app);
          } else {
            // Gym already exists, redirect to it
            router.push(`/gym/${app.approvedGymId}`);
          }
          break;
        }
      }
    } catch (error) {
      console.error("Error fetching application:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const calculateMonthlyTotal = () => {
    let total = PRICING.GYM_BASE;
    if (selectedPlan === "ai_programmer") {
      total += PRICING.GYM_AI_PROGRAMMER;
    }
    // AI Coach starts at 0 members
    return total;
  };

  const handleCreateGym = async () => {
    if (!user || !approvedApplication) return;

    setIsCreating(true);
    try {
      // Check if a gym already exists for this application to prevent duplicates
      const existingGymsQuery = query(
        collection(db, "gyms"),
        where("applicationId", "==", approvedApplication.id)
      );
      const existingGyms = await getDocs(existingGymsQuery);

      if (!existingGyms.empty) {
        // Gym already exists, just redirect to it
        const existingGymId = existingGyms.docs[0].id;

        // Make sure the application is updated
        await updateDoc(doc(db, "gymApplications", approvedApplication.id), {
          approvedGymId: existingGymId,
        });

        // Make sure user has correct role
        await updateDoc(doc(db, "users", user.id), {
          role: "owner",
          gymId: existingGymId,
        });

        await refreshUser();
        router.push(`/gym/${existingGymId}`);
        return;
      }
      // Create subscription
      const subscription: GymSubscription = {
        plan: selectedPlan === "ai_programmer" ? "ai_programmer" : "base",
        status: "active",
        aiProgrammerEnabled: selectedPlan === "ai_programmer",
        aiCoachEnabled: aiCoachEnabled,
        aiCoachMemberCount: 0,
        startDate: Timestamp.now(),
        currentPeriodEnd: Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ),
      };

      // Create the gym - don't include null/undefined values
      const gymData: Record<string, unknown> = {
        name: approvedApplication.gymName,
        ownerId: user.id,
        coachIds: [],
        memberIds: [],
        createdAt: Timestamp.now(),
        address: approvedApplication.gymAddress,
        city: approvedApplication.gymCity,
        state: approvedApplication.gymState,
        zip: approvedApplication.gymZip,
        applicationId: approvedApplication.id,
        isApproved: true,
        subscription,
        pricingEnabled: true,
      };

      // Only add optional fields if they have values
      if (approvedApplication.gymPhone) {
        gymData.phone = approvedApplication.gymPhone;
      }
      if (approvedApplication.gymWebsite) {
        gymData.website = approvedApplication.gymWebsite;
      }

      const gymRef = await addDoc(collection(db, "gyms"), gymData);

      // Update the application with the gym ID
      await updateDoc(doc(db, "gymApplications", approvedApplication.id), {
        approvedGymId: gymRef.id,
      });

      // Update user role and gymId
      await updateDoc(doc(db, "users", user.id), {
        role: "owner",
        gymId: gymRef.id,
      });

      // Refresh user data
      await refreshUser();

      // Redirect to the new gym
      router.push(`/gym/${gymRef.id}`);
    } catch (error) {
      console.error("Error creating gym:", error);
      alert("Failed to create gym. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || switching || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!approvedApplication) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏢</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">No Approved Application</h1>
            <p className="text-gray-500 mb-6">
              You don&apos;t have an approved gym application yet. Apply to create a gym first.
            </p>
            <button
              onClick={() => router.push("/programming")}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Go to Programming
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Gym Has Been Approved!</h1>
          <p className="text-gray-500">Complete your subscription to create <strong>{approvedApplication.gymName}</strong></p>
        </div>

        {/* Gym Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Gym Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{approvedApplication.gymName}</p>
            </div>
            <div>
              <p className="text-gray-500">Address</p>
              <p className="font-medium text-gray-900">{approvedApplication.gymAddress}</p>
            </div>
            <div>
              <p className="text-gray-500">City</p>
              <p className="font-medium text-gray-900">{approvedApplication.gymCity}, {approvedApplication.gymState} {approvedApplication.gymZip}</p>
            </div>
            {approvedApplication.gymPhone && (
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{approvedApplication.gymPhone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h2>

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
                <li>• Member management</li>
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
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 bg-purple-500 text-white text-xs font-bold rounded">
                POPULAR
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
                <li className="text-purple-600 font-medium">• AI-generated programming</li>
                <li className="text-purple-600 font-medium">• Programming assistant chat</li>
                <li className="text-purple-600 font-medium">• Custom training philosophy</li>
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
                    Personal AI coaching for all your members
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    +${PRICING.GYM_AI_COACH_PER_MEMBER}
                    <span className="text-sm font-normal text-gray-500">/member/mo</span>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Base Gym Platform</span>
              <span>${PRICING.GYM_BASE}/mo</span>
            </div>
            {selectedPlan === "ai_programmer" && (
              <div className="flex justify-between text-purple-600">
                <span>AI Programmer</span>
                <span>+${PRICING.GYM_AI_PROGRAMMER}/mo</span>
              </div>
            )}
            {aiCoachEnabled && (
              <div className="flex justify-between text-green-600">
                <span>AI Coach (per member)</span>
                <span>+${PRICING.GYM_AI_COACH_PER_MEMBER}/member/mo</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-gray-900">
                ${calculateMonthlyTotal()}/mo
                {aiCoachEnabled && <span className="text-sm font-normal text-gray-500"> + members</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreateGym}
          disabled={isCreating}
          className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? "Creating Your Gym..." : "Create Gym & Subscribe"}
        </button>

        <p className="text-center text-gray-500 text-sm mt-4">
          By subscribing, you agree to our terms of service. You can cancel anytime.
        </p>
      </main>
    </div>
  );
}

export default function GymSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <GymSetupContent />
    </Suspense>
  );
}
