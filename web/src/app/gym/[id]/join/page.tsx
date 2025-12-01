"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, PricingTier, WorkoutGroup, DiscountCode } from "@/lib/types";
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
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<"monthly" | "yearly" | "one-time">("monthly");

  // Payment form (mockup)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  // Signup code for hidden plans
  const [signupCode, setSignupCode] = useState("");
  const [codeApplied, setCodeApplied] = useState(false);

  // Discount code
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);

  // Mockup discount codes (would come from gym settings)
  const [discountCodes] = useState<DiscountCode[]>([
    { id: "disc_1", code: "SUMMER20", discountType: "percentage", discountValue: 20, description: "Summer sale - 20% off", isActive: true, usageCount: 0 },
    { id: "disc_2", code: "FIRST10", discountType: "fixed", discountValue: 10, description: "$10 off first month", isActive: true, usageCount: 0 },
  ]);

  // Default pricing tiers (mockup - would come from gym settings in real implementation)
  const [pricingTiers] = useState<PricingTier[]>([
    { id: "tier_1", name: "Monthly Unlimited", monthlyPrice: 150, yearlyPrice: 1500, classLimitType: "unlimited", description: "Unlimited access to all classes", features: ["Unlimited classes", "Open gym access", "Member app access"], isActive: true },
    { id: "tier_2", name: "Drop-In", oneTimePrice: 25, classLimitType: "fixed", totalClasses: 1, description: "Single class visit", features: ["1 class access"], isActive: true },
    { id: "tier_3", name: "10-Class Pack", oneTimePrice: 200, classLimitType: "fixed", totalClasses: 10, description: "10 class punch card", features: ["10 class credits", "Never expires"], isActive: true },
    { id: "tier_4", name: "VIP Founder Rate", monthlyPrice: 99, classLimitType: "unlimited", description: "Special rate for founding members", features: ["Unlimited classes", "Open gym access", "Priority booking", "Free merchandise"], isActive: true, isHidden: true, signupCode: "VIP2024" },
  ]);

  // Filter visible plans: show non-hidden + any plan matching the entered code
  const visibleTiers = pricingTiers.filter((t) =>
    t.isActive && (!t.isHidden || (t.signupCode && t.signupCode.toUpperCase() === signupCode.toUpperCase()))
  );

  // Check if entered code matches any hidden plan
  const codeMatchesPlan = pricingTiers.some(
    (t) => t.isHidden && t.signupCode && t.signupCode.toUpperCase() === signupCode.toUpperCase()
  );

  // Helper to get price based on selected billing cycle
  const getSelectedPrice = (tier: PricingTier, cycle: "monthly" | "yearly" | "one-time") => {
    if (cycle === "monthly" && tier.monthlyPrice) return tier.monthlyPrice;
    if (cycle === "yearly" && tier.yearlyPrice) return tier.yearlyPrice;
    if (cycle === "one-time" && tier.oneTimePrice) return tier.oneTimePrice;
    // Fallback to any available price
    return tier.monthlyPrice || tier.yearlyPrice || tier.oneTimePrice || 0;
  };

  // Get the best available billing cycle for a tier
  const getDefaultBillingCycle = (tier: PricingTier): "monthly" | "yearly" | "one-time" => {
    if (tier.monthlyPrice) return "monthly";
    if (tier.yearlyPrice) return "yearly";
    return "one-time";
  };

  // Check if tier has a specific billing option
  const hasBillingOption = (tier: PricingTier, cycle: "monthly" | "yearly" | "one-time") => {
    if (cycle === "monthly") return !!tier.monthlyPrice;
    if (cycle === "yearly") return !!tier.yearlyPrice;
    return !!tier.oneTimePrice;
  };

  // Calculate discounted price
  const getDiscountedPrice = (price: number, discount: DiscountCode | null) => {
    if (!discount) return price;
    if (discount.discountType === "percentage") {
      return Math.max(0, price - (price * discount.discountValue / 100));
    }
    return Math.max(0, price - discount.discountValue);
  };

  // Find matching discount code
  const findDiscountCode = (code: string) => {
    return discountCodes.find(
      (d) => d.isActive && d.code.toUpperCase() === code.toUpperCase()
    );
  };

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

      const originalPrice = selectedTier ? getSelectedPrice(selectedTier, selectedBillingCycle) : 0;
      const finalPrice = selectedTier ? getDiscountedPrice(originalPrice, appliedDiscount) : 0;

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
        selectedPlanPrice: originalPrice,
        selectedBillingCycle: selectedBillingCycle,
        // Discount info
        discountCode: appliedDiscount?.code || null,
        discountAmount: appliedDiscount ? (originalPrice - finalPrice) : 0,
        finalPrice: finalPrice,
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

            {/* Signup Code Entry */}
            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-600">🔑</span>
                <span className="text-sm font-medium text-gray-700">Have a signup code?</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={signupCode}
                  onChange={(e) => {
                    setSignupCode(e.target.value.toUpperCase());
                    setCodeApplied(false);
                  }}
                  placeholder="Enter code"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 uppercase focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    if (codeMatchesPlan) {
                      setCodeApplied(true);
                    }
                  }}
                  disabled={!signupCode.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:bg-gray-300 hover:bg-purple-700 transition-colors"
                >
                  Apply
                </button>
              </div>
              {signupCode && !codeMatchesPlan && (
                <p className="text-sm text-red-600 mt-2">Invalid code. Please check and try again.</p>
              )}
              {codeApplied && codeMatchesPlan && (
                <p className="text-sm text-green-600 mt-2">✓ Code applied! Exclusive plan unlocked below.</p>
              )}
            </div>

            {/* Discount Code Entry */}
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600">🏷️</span>
                <span className="text-sm font-medium text-gray-700">Have a discount code?</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase());
                    if (appliedDiscount) setAppliedDiscount(null);
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 uppercase focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    const found = findDiscountCode(discountCode);
                    if (found) {
                      setAppliedDiscount(found);
                    }
                  }}
                  disabled={!discountCode.trim() || !!appliedDiscount}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium disabled:bg-gray-300 hover:bg-green-700 transition-colors"
                >
                  {appliedDiscount ? "Applied" : "Apply"}
                </button>
              </div>
              {discountCode && !findDiscountCode(discountCode) && !appliedDiscount && (
                <p className="text-sm text-red-600 mt-2">Invalid discount code.</p>
              )}
              {appliedDiscount && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-green-600">
                    ✓ {appliedDiscount.discountType === "percentage"
                      ? `${appliedDiscount.discountValue}% off`
                      : `$${appliedDiscount.discountValue} off`} applied!
                  </p>
                  <button
                    onClick={() => {
                      setAppliedDiscount(null);
                      setDiscountCode("");
                    }}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {visibleTiers.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => {
                    setSelectedTierId(tier.id);
                    // Set default billing cycle for this tier if current selection isn't available
                    if (!hasBillingOption(tier, selectedBillingCycle)) {
                      setSelectedBillingCycle(getDefaultBillingCycle(tier));
                    }
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedTierId === tier.id
                      ? tier.isHidden ? "border-purple-500 bg-purple-50" : "border-blue-500 bg-blue-50"
                      : tier.isHidden ? "border-purple-200 bg-purple-50/50 hover:border-purple-300" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {tier.isHidden && (
                    <div className="mb-2">
                      <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">✨ Exclusive Plan</span>
                    </div>
                  )}
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
                      {/* Show all available pricing options */}
                      <div className="space-y-1">
                        {tier.monthlyPrice && (
                          <div className={`${selectedTierId === tier.id && selectedBillingCycle === "monthly" ? "text-blue-600" : "text-gray-900"}`}>
                            <span className="text-xl font-bold">${tier.monthlyPrice}</span>
                            <span className="text-gray-500 text-sm">/mo</span>
                          </div>
                        )}
                        {tier.yearlyPrice && (
                          <div className={`${selectedTierId === tier.id && selectedBillingCycle === "yearly" ? "text-blue-600" : "text-gray-700"}`}>
                            <span className="text-lg font-semibold">${tier.yearlyPrice}</span>
                            <span className="text-gray-500 text-sm">/yr</span>
                            {tier.monthlyPrice && (
                              <span className="text-green-600 text-xs ml-1">
                                (save ${(tier.monthlyPrice * 12) - tier.yearlyPrice})
                              </span>
                            )}
                          </div>
                        )}
                        {tier.oneTimePrice && (
                          <div className={`${selectedTierId === tier.id && selectedBillingCycle === "one-time" ? "text-blue-600" : "text-gray-700"}`}>
                            <span className={`${!tier.monthlyPrice && !tier.yearlyPrice ? "text-xl font-bold" : "text-lg font-semibold"}`}>${tier.oneTimePrice}</span>
                            <span className="text-gray-500 text-xs ml-1">one-time</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billing cycle selector - only show when selected and multiple options exist */}
                  {selectedTierId === tier.id && (
                    <div className={`mt-3 pt-3 border-t ${tier.isHidden ? "border-purple-200" : "border-blue-200"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`${tier.isHidden ? "text-purple-600" : "text-blue-600"} text-sm font-medium`}>✓ Selected</span>

                        {/* Show billing toggle if multiple options available */}
                        {((tier.monthlyPrice ? 1 : 0) + (tier.yearlyPrice ? 1 : 0) + (tier.oneTimePrice ? 1 : 0)) > 1 && (
                          <div className="flex gap-1">
                            {tier.monthlyPrice && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedBillingCycle("monthly"); }}
                                className={`px-2 py-1 text-xs rounded ${
                                  selectedBillingCycle === "monthly"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                Monthly
                              </button>
                            )}
                            {tier.yearlyPrice && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedBillingCycle("yearly"); }}
                                className={`px-2 py-1 text-xs rounded ${
                                  selectedBillingCycle === "yearly"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                Yearly
                              </button>
                            )}
                            {tier.oneTimePrice && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedBillingCycle("one-time"); }}
                                className={`px-2 py-1 text-xs rounded ${
                                  selectedBillingCycle === "one-time"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                One-time
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                <div>
                  <span className="text-gray-600">{selectedTier?.name}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    ({selectedBillingCycle === "monthly" ? "Monthly" : selectedBillingCycle === "yearly" ? "Yearly" : "One-time"})
                  </span>
                </div>
                <span className={`font-semibold ${appliedDiscount ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  ${selectedTier ? getSelectedPrice(selectedTier, selectedBillingCycle) : 0}
                  {selectedBillingCycle === "monthly" && "/mo"}
                  {selectedBillingCycle === "yearly" && "/yr"}
                </span>
              </div>
              {appliedDiscount && selectedTier && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-green-600 text-sm">
                    🏷️ {appliedDiscount.discountType === "percentage"
                      ? `${appliedDiscount.discountValue}% off`
                      : `$${appliedDiscount.discountValue} off`}
                  </span>
                  <span className="text-green-600 font-medium">
                    -${(getSelectedPrice(selectedTier, selectedBillingCycle) - getDiscountedPrice(getSelectedPrice(selectedTier, selectedBillingCycle), appliedDiscount)).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Due Today</span>
                <span className="text-xl font-bold text-green-600">
                  ${selectedTier ? getDiscountedPrice(getSelectedPrice(selectedTier, selectedBillingCycle), appliedDiscount).toFixed(2) : "0.00"}
                </span>
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
                {submitting ? "Processing..." : `Pay $${selectedTier ? getDiscountedPrice(getSelectedPrice(selectedTier, selectedBillingCycle), appliedDiscount).toFixed(2) : "0.00"}`}
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
