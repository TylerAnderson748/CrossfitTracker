"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

type ProgrammingPath = "join-gym" | "ai-programmer" | "external-programming" | "own-gym" | null;

export default function ProgrammingPage() {
  const { user, loading, switching, refreshUser } = useAuth();
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);

  // Selected path state
  const [selectedPath, setSelectedPath] = useState<ProgrammingPath>(null);

  // Gym state
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [myGyms, setMyGyms] = useState<Gym[]>([]);
  const [showFindGymModal, setShowFindGymModal] = useState(false);
  const [gymSearchQuery, setGymSearchQuery] = useState("");

  // AI options
  const [hasHomeGym, setHasHomeGym] = useState(false);

  // Cancel subscription state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelType, setCancelType] = useState<"coach" | "programmer">("coach");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchGyms();
    }
  }, [user]);

  const fetchGyms = async () => {
    if (!user) return;

    try {
      const gymsSnapshot = await getDocs(collection(db, "gyms"));
      const gyms = gymsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Gym[];
      setAllGyms(gyms);

      // Filter gyms where user is a member
      const userGyms = gyms.filter(
        (gym) =>
          gym.ownerId === user.id ||
          gym.coachIds?.includes(user.id) ||
          gym.memberIds?.includes(user.id)
      );
      setMyGyms(userGyms);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Gyms available to join (not already a member)
  const availableGyms = allGyms.filter(
    (gym) =>
      gym.ownerId !== user?.id &&
      !gym.coachIds?.includes(user?.id || "") &&
      !gym.memberIds?.includes(user?.id || "")
  );

  // Filter available gyms by search query
  const filteredGyms = gymSearchQuery.trim()
    ? availableGyms.filter((gym) =>
        gym.name.toLowerCase().includes(gymSearchQuery.toLowerCase())
      )
    : availableGyms;

  // AI Coach subscription (for athletes - personal scaling, analysis)
  const aiCoachSubscription = user?.aiTrainerSubscription;
  const hasActiveAICoach = aiCoachSubscription?.status === "active" || aiCoachSubscription?.status === "trialing";

  // AI Programmer subscription (for generating workouts)
  const aiProgrammerSubscription = user?.aiProgrammingSubscription;
  const hasActiveAIProgrammer = aiProgrammerSubscription?.status === "active" || aiProgrammerSubscription?.status === "trialing";

  const handleCancelSubscription = async () => {
    if (!user) return;

    setIsCanceling(true);
    try {
      const subscriptionField = cancelType === "coach" ? "aiTrainerSubscription" : "aiProgrammingSubscription";
      await updateDoc(doc(db, "users", user.id), {
        [`${subscriptionField}.status`]: "canceled",
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

  const openCancelModal = (type: "coach" | "programmer") => {
    setCancelType(type);
    setShowCancelModal(true);
  };

  // Workout source options (where you get your programming from)
  const workoutSourceOptions = [
    {
      id: "join-gym" as ProgrammingPath,
      icon: "🏋️",
      title: "Join a Gym",
      description: "Find and join a local CrossFit gym to follow their programming",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      id: "ai-programmer" as ProgrammingPath,
      icon: "🤖",
      title: "AI Programmer",
      description: "Generate custom workouts tailored to your equipment and goals",
      color: "from-purple-500 to-indigo-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      id: "external-programming" as ProgrammingPath,
      icon: "📋",
      title: "Use Your Own Programming",
      description: "Import workouts from any source - your favorite provider or your own",
      color: "from-orange-500 to-amber-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
    },
    {
      id: "own-gym" as ProgrammingPath,
      icon: "🏢",
      title: "Own a Gym",
      description: "Create your gym, manage athletes, and program workouts",
      color: "from-gray-700 to-gray-900",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
    },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Programming</h1>
          <p className="text-gray-500">Choose how you want to get your workouts</p>
        </div>

        {/* Active Workout Sources Summary - at the top */}
        {(myGyms.length > 0 || hasActiveAIProgrammer) && (
          <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Active Workout Sources</h2>
            <div className="space-y-3">
              {myGyms.map((gym) => (
                <div key={gym.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏋️</span>
                    <span className="font-medium text-gray-900">{gym.name}</span>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                </div>
              ))}
              {hasActiveAIProgrammer && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🤖</span>
                    <span className="font-medium text-gray-900">AI Programmer</span>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workout Source Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Workout Source</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workoutSourceOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedPath(selectedPath === option.id ? null : option.id)}
                className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                  selectedPath === option.id
                    ? `${option.borderColor} ${option.bgColor} shadow-lg`
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {selectedPath === option.id && (
                  <div className="absolute top-3 right-3">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${option.color} flex items-center justify-center`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center text-2xl mb-4 shadow-md`}>
                  {option.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{option.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Expanded Section Based on Selection */}
        {selectedPath === "join-gym" && (
          <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Join a Gym</h2>
              <button
                onClick={() => setShowFindGymModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span>🔍</span> Find Gyms
              </button>
            </div>

            {myGyms.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🏋️</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Gym Memberships Yet</h3>
                <p className="text-gray-500 text-sm mb-4">Search for gyms in your area and join to see their programming</p>
                <button
                  onClick={() => setShowFindGymModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Find a Gym
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">Your current gym memberships:</p>
                {myGyms.map((gym) => {
                  const role = gym.ownerId === user?.id
                    ? "Owner"
                    : gym.coachIds?.includes(user?.id || "")
                    ? "Coach"
                    : "Member";
                  const roleColor = role === "Owner"
                    ? "bg-purple-100 text-purple-700"
                    : role === "Coach"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700";
                  const memberCount = (gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1;
                  return (
                    <div
                      key={gym.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl shadow-md">
                          🏋️
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{gym.name}</h3>
                          <p className="text-sm text-gray-500">{memberCount} members</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${roleColor}`}>
                          {role}
                        </span>
                        <button
                          onClick={() => router.push(`/gym/${gym.id}`)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* AI Programmer Section */}
        {selectedPath === "ai-programmer" && (
          <div className="mb-8 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">AI Programmer</h3>
                  <p className="text-purple-200 text-sm mt-1">
                    Generate custom workouts tailored to you
                  </p>
                </div>
              </div>
              {hasActiveAIProgrammer && (
                <span className="px-3 py-1 bg-green-400/20 text-green-100 text-sm font-medium rounded-full border border-green-400/30">
                  Active
                </span>
              )}
            </div>

            {/* Home Gym Toggle */}
            <div className="bg-white/10 rounded-xl p-4 mb-6">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <h4 className="font-semibold">I have a home gym</h4>
                  <p className="text-purple-200 text-sm mt-1">
                    AI will customize workouts based on your available equipment
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={hasHomeGym}
                    onChange={(e) => setHasHomeGym(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-14 h-8 rounded-full transition-colors ${hasHomeGym ? 'bg-green-400' : 'bg-white/30'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform mt-1 ${hasHomeGym ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                </div>
              </label>
            </div>

            {hasActiveAIProgrammer ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">🏋️</div>
                    <h4 className="font-semibold text-sm">Custom WODs</h4>
                    <p className="text-purple-200 text-xs mt-1">AI-generated daily workouts</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">📅</div>
                    <h4 className="font-semibold text-sm">Weekly Programming</h4>
                    <p className="text-purple-200 text-xs mt-1">Balanced training cycles</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-semibold text-sm">Goal-Focused</h4>
                    <p className="text-purple-200 text-xs mt-1">Workouts for your objectives</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">🏠</div>
                    <h4 className="font-semibold text-sm">{hasHomeGym ? "Home Gym Mode" : "Any Gym"}</h4>
                    <p className="text-purple-200 text-xs mt-1">{hasHomeGym ? "Equipment-aware workouts" : "Standard equipment assumed"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push("/weekly")}
                    className="px-4 py-2 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                  >
                    <span>📅</span> View Workouts
                  </button>
                </div>

                {aiProgrammerSubscription && (
                  <div className="mt-6 pt-4 border-t border-white/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-200">
                        {aiProgrammerSubscription.status === "trialing" ? "Trial ends" : "Renews"}{" "}
                        {(aiProgrammerSubscription.status === "trialing"
                          ? aiProgrammerSubscription.trialEndsAt?.toDate?.().toLocaleDateString()
                          : aiProgrammerSubscription.endDate?.toDate?.().toLocaleDateString()) || "N/A"}
                      </span>
                      <button
                        onClick={() => openCancelModal("programmer")}
                        className="text-red-300 hover:text-red-200 hover:underline"
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-green-300">✓</span> AI-generated custom workouts daily or weekly
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-300">✓</span> Balanced programming across all fitness domains
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-300">✓</span> Goal-focused training (strength, endurance, competition)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-300">✓</span> {hasHomeGym ? "Workouts customized to your home gym equipment" : "Works with any gym setup"}
                  </li>
                </ul>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.push("/subscribe?variant=programmer")}
                    className="px-6 py-3 bg-white text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Subscribe - $100/mo
                  </button>
                  <span className="text-purple-200 text-sm">Full AI-powered programming</span>
                </div>
              </>
            )}
          </div>
        )}

        {selectedPath === "external-programming" && (
          <div className="mb-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">📋</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Use Your Own Programming</h3>
                  <p className="text-orange-100 text-sm mt-1">Import and track workouts from any source</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">$50</div>
                <div className="text-orange-200 text-xs">/month</div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📝</div>
                <h4 className="font-semibold text-sm">Manual Import</h4>
                <p className="text-orange-100 text-xs mt-1">Copy & paste from any source</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📸</div>
                <h4 className="font-semibold text-sm">Photo Scan</h4>
                <p className="text-orange-100 text-xs mt-1">AI-powered workout import</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📊</div>
                <h4 className="font-semibold text-sm">Track Progress</h4>
                <p className="text-orange-100 text-xs mt-1">Log results and see gains</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📅</div>
                <h4 className="font-semibold text-sm">Weekly View</h4>
                <p className="text-orange-100 text-xs mt-1">Organize your programming</p>
              </div>
            </div>

            <ul className="space-y-2 text-sm mb-6">
              <li className="flex items-center gap-2">
                <span className="text-white">✓</span> Import workouts from any external provider
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white">✓</span> Use with programs you already subscribe to
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white">✓</span> Track your own custom programming
              </li>
            </ul>

            <button
              onClick={() => router.push("/subscribe?variant=external")}
              className="w-full px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-orange-50 transition-colors"
            >
              Subscribe - $50/mo
            </button>

            {/* Future Integrations Note */}
            <p className="text-orange-200 text-xs text-center mt-4">
              We&apos;re exploring partnerships for direct integrations in the future.
            </p>
          </div>
        )}

        {selectedPath === "own-gym" && (
          <div className="mb-8 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-3xl">🏢</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">Own a Gym</h3>
                <p className="text-gray-300 text-sm mt-1">
                  Create and manage your own gym with AI-powered programming
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">👥</div>
                <h4 className="font-semibold text-sm">Manage Athletes</h4>
                <p className="text-gray-400 text-xs mt-1">Track your members&apos; progress</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📅</div>
                <h4 className="font-semibold text-sm">Program Workouts</h4>
                <p className="text-gray-400 text-xs mt-1">Create and schedule WODs</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">🤖</div>
                <h4 className="font-semibold text-sm">AI Assistance</h4>
                <p className="text-gray-400 text-xs mt-1">Let AI help draft programming</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">📊</div>
                <h4 className="font-semibold text-sm">Analytics</h4>
                <p className="text-gray-400 text-xs mt-1">Gym-wide performance data</p>
              </div>
            </div>

            {user?.role === "owner" || user?.role === "coach" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-300 mb-2">Your gyms:</p>
                {myGyms.filter(gym => gym.ownerId === user?.id || gym.coachIds?.includes(user?.id || "")).map((gym) => (
                  <div
                    key={gym.id}
                    className="flex items-center justify-between p-4 bg-white/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏋️</span>
                      <div>
                        <h4 className="font-medium">{gym.name}</h4>
                        <p className="text-gray-400 text-sm">
                          {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/gym/${gym.id}`)}
                      className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100"
                    >
                      Manage
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => router.push("/gym")}
                  className="w-full mt-4 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
                >
                  + Create Another Gym
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/gym")}
                className="w-full px-6 py-3 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Create Your Gym
              </button>
            )}
          </div>
        )}

        {/* AI Coach - Enhance Your Workouts (Add-on, not a workout source) */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Enhance Your Workouts</h2>
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">AI Coach</h3>
                  <p className="text-green-100 text-sm mt-1">
                    Personal scaling and coaching for any workout source
                  </p>
                </div>
              </div>
              {hasActiveAICoach && (
                <span className="px-3 py-1 bg-white/20 text-white text-sm font-medium rounded-full border border-white/30">
                  Active
                </span>
              )}
            </div>

            {hasActiveAICoach ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">🎯</div>
                    <h4 className="font-semibold text-xs">Scaling</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">📊</div>
                    <h4 className="font-semibold text-xs">Analysis</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">💡</div>
                    <h4 className="font-semibold text-xs">Tips</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">📸</div>
                    <h4 className="font-semibold text-xs">Scan</h4>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push("/ai-coach/scan")}
                    className="px-4 py-2 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
                  >
                    <span>📸</span> Scan Workout
                  </button>
                  <button
                    onClick={() => router.push("/weekly")}
                    className="px-4 py-2 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                  >
                    <span>📅</span> View Workouts
                  </button>
                </div>
                {aiCoachSubscription && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-100">
                        {aiCoachSubscription.status === "trialing" ? "Trial ends" : "Renews"}{" "}
                        {(aiCoachSubscription.status === "trialing"
                          ? aiCoachSubscription.trialEndsAt?.toDate?.().toLocaleDateString()
                          : aiCoachSubscription.endDate?.toDate?.().toLocaleDateString()) || "N/A"}
                      </span>
                      <button
                        onClick={() => openCancelModal("coach")}
                        className="text-red-200 hover:text-red-100 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">🎯</div>
                    <h4 className="font-semibold text-xs">Scaling</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">📊</div>
                    <h4 className="font-semibold text-xs">Analysis</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">💡</div>
                    <h4 className="font-semibold text-xs">Tips</h4>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">📸</div>
                    <h4 className="font-semibold text-xs">Scan</h4>
                  </div>
                </div>

                <ul className="space-y-1 text-sm mb-4">
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span> Personalized workout scaling
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span> Performance analysis & tips
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-white">✓</span> Scan workouts from photos
                  </li>
                </ul>

                {/* Pricing Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Individual Pricing */}
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <div className="text-xs text-green-200 uppercase tracking-wide mb-1">Individual</div>
                    <div className="text-2xl font-bold mb-2">$9.99<span className="text-sm font-normal text-green-200">/mo</span></div>
                    <button
                      onClick={() => router.push("/subscribe?variant=coach")}
                      className="w-full px-4 py-2 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors text-sm"
                    >
                      Subscribe
                    </button>
                  </div>

                  {/* Gym Pricing */}
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <div className="text-xs text-green-200 uppercase tracking-wide mb-1">For Gyms</div>
                    <div className="text-2xl font-bold mb-2">$1<span className="text-sm font-normal text-green-200">/member/mo</span></div>
                    <button
                      onClick={() => router.push("/gym")}
                      className="w-full px-4 py-2 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors text-sm"
                    >
                      Manage Gym
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </main>

      {/* Find Gym Modal */}
      {showFindGymModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Find Gyms</h2>
              <button
                onClick={() => {
                  setShowFindGymModal(false);
                  setGymSearchQuery("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={gymSearchQuery}
                onChange={(e) => setGymSearchQuery(e.target.value)}
                placeholder="Search gyms..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredGyms.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500">
                    {gymSearchQuery.trim() ? "No gyms found matching your search" : "No gyms available to join"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGyms.map((gym) => (
                    <div
                      key={gym.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">🏋️</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{gym.name}</h3>
                          <p className="text-gray-500 text-sm">
                            {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          router.push(`/gym/${gym.id}/join`);
                          setShowFindGymModal(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowFindGymModal(false);
                setGymSearchQuery("");
              }}
              className="w-full mt-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
                Are you sure you want to cancel your {cancelType === "coach" ? "AI Coach" : "AI Programmer"} subscription?
                You&apos;ll lose access to {cancelType === "coach" ? "personal scaling and coaching" : "AI-generated workouts"} immediately.
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
