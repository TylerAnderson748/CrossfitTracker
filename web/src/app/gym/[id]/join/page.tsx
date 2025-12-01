"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, PricingTier, WorkoutGroup } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function JoinGymPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gymId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [gym, setGym] = useState<Gym | null>(null);
  const [groups, setGroups] = useState<WorkoutGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"plan" | "payment" | "confirm">("plan");

  // Selected plan
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // Payment form (mockup)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  // Default pricing tiers (mockup - would come from gym settings in real implementation)
  const [pricingTiers] = useState<PricingTier[]>([
    { id: "tier_1", name: "Monthly Membership", price: 150, billingCycle: "monthly", description: "Unlimited access to all classes", features: ["Unlimited classes", "Open gym access", "Member app access"], isActive: true },
    { id: "tier_2", name: "Drop-In", price: 25, billingCycle: "one-time", description: "Single class visit", features: ["1 class access"], isActive: true },
    { id: "tier_3", name: "10-Class Pack", price: 200, billingCycle: "one-time", description: "10 class punch card", features: ["10 class credits", "Never expires"], isActive: true },
  ]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && gymId) {
      loadGymData();
    }
  }, [user, gymId]);

  const loadGymData = async () => {
    try {
      // Load gym
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (!gymDoc.exists()) {
        router.push("/gym");
        return;
      }
      const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
      setGym(gymData);

      // Check if already a member
      if (
        gymData.ownerId === user?.id ||
        gymData.coachIds?.includes(user?.id || "") ||
        gymData.memberIds?.includes(user?.id || "")
      ) {
        router.push(`/gym/${gymId}`);
        return;
      }

      // Load groups with pricing
      const groupsQuery = query(collection(db, "groups"), where("gymId", "==", gymId));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as WorkoutGroup))
        .filter((g) => g.requiresPayment && g.additionalFee && g.additionalFee > 0);
      setGroups(groupsData);
    } catch (err) {
      console.error("Error loading gym:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !gym || !selectedTierId) return;

    setSubmitting(true);
    try {
      // Find selected tier
      const selectedTier = pricingTiers.find((t) => t.id === selectedTierId);

      await addDoc(collection(db, "gymMembershipRequests"), {
        gymId: gym.id,
        gymName: gym.name,
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        status: "pending",
        createdAt: Timestamp.now(),
        // Payment mockup data
        selectedPlanId: selectedTierId,
        selectedPlanName: selectedTier?.name,
        selectedPlanPrice: selectedTier?.price,
        paymentMethod: "card_mockup",
      });

      setStep("confirm");
    } catch (error) {
      console.error("Error sending request:", error);
      alert("Error submitting request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const selectedTier = pricingTiers.find((t) => t.id === selectedTierId);

  if (loading || authLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/gym")}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1"
          >
            ← Back to Gyms
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Join {gym.name}</h1>
          <p className="text-gray-500">Select a membership plan to get started</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step === "plan" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
            }`}>
              {step === "plan" ? "1" : "✓"}
            </div>
            <span className={step === "plan" ? "text-blue-600 font-medium" : "text-gray-500"}>Plan</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300 mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step === "payment" ? "bg-blue-600 text-white" : step === "confirm" ? "bg-green-500 text-white" : "bg-gray-300 text-gray-500"
            }`}>
              {step === "confirm" ? "✓" : "2"}
            </div>
            <span className={step === "payment" ? "text-blue-600 font-medium" : "text-gray-500"}>Payment</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300 mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step === "confirm" ? "bg-green-500 text-white" : "bg-gray-300 text-gray-500"
            }`}>
              {step === "confirm" ? "✓" : "3"}
            </div>
            <span className={step === "confirm" ? "text-green-600 font-medium" : "text-gray-500"}>Confirm</span>
          </div>
        </div>

        {/* Mockup Banner */}
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <span className="text-yellow-600">⚠️</span>
          <p className="text-sm text-yellow-700">This is a mockup. No actual payment will be processed.</p>
        </div>

        {/* Step 1: Select Plan */}
        {step === "plan" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Your Plan</h2>

            <div className="space-y-3">
              {pricingTiers.filter((t) => t.isActive).map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedTierId === tier.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{tier.description}</p>
                      {tier.features && tier.features.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-center gap-1">
                              <span className="text-green-500">✓</span> {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-gray-900">${tier.price}</span>
                      <span className="text-gray-500 text-sm">
                        {tier.billingCycle === "monthly" && "/mo"}
                        {tier.billingCycle === "one-time" && ""}
                      </span>
                    </div>
                  </div>
                  {selectedTierId === tier.id && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <span className="text-blue-600 text-sm font-medium">✓ Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Optional Group Add-ons */}
            {groups.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Optional Add-ons</h3>
                <p className="text-sm text-gray-500 mb-3">These groups have additional monthly fees:</p>
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{group.name}</p>
                        <p className="text-xs text-gray-500">Request access after joining</p>
                      </div>
                      <span className="text-green-600 font-medium">+${group.additionalFee}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep("payment")}
              disabled={!selectedTierId}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 hover:bg-blue-700 transition-colors mt-6"
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === "payment" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Payment Information</h2>

            {/* Order Summary */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">Order Summary</h3>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{selectedTier?.name}</span>
                <span className="font-semibold text-gray-900">
                  ${selectedTier?.price}
                  {selectedTier?.billingCycle === "monthly" && "/mo"}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Due Today</span>
                <span className="text-xl font-bold text-green-600">${selectedTier?.price}</span>
              </div>
            </div>

            {/* Card Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name on Card
                </label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                <span>🔒</span>
                <span>Your payment info is secure (mockup - not actually stored)</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("plan")}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !cardName || !cardNumber || !cardExpiry || !cardCvc}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold disabled:bg-gray-300 hover:bg-green-700 transition-colors"
              >
                {submitting ? "Processing..." : `Pay $${selectedTier?.price}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirm" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Your membership request has been sent to {gym.name}. The gym owner will review and approve your request.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-medium text-gray-900 mb-2">What&apos;s Next?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">1.</span>
                  The gym owner will review your request
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">2.</span>
                  Once approved, you&apos;ll have access to the gym
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-500">3.</span>
                  Your payment will be processed (mockup)
                </li>
              </ul>
            </div>

            <button
              onClick={() => router.push("/gym")}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Gyms
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
