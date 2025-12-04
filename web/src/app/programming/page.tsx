"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function ProgrammingPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);

  // Gym state
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [myGyms, setMyGyms] = useState<Gym[]>([]);
  const [showFindGymModal, setShowFindGymModal] = useState(false);
  const [gymSearchQuery, setGymSearchQuery] = useState("");

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

  // AI Subscription status - everyone needs subscription for AI features
  const aiSubscription = user?.aiTrainerSubscription;
  const hasActiveAI = aiSubscription?.status === "active" || aiSubscription?.status === "trialing";
  const isCoachOrOwner = user?.role === "coach" || user?.role === "owner";

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
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions & Memberships</h1>
          <p className="text-gray-500">Manage your gym memberships and AI training subscriptions</p>
        </div>

        {/* AI Trainer Subscription */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Personal Trainer</h2>
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold">AI Coach Pro</h3>
                  <p className="text-purple-200 text-sm mt-1">
                    {hasActiveAI
                      ? "Personalized scaling, workout analysis & AI programming"
                      : "Get personalized coaching powered by AI"}
                  </p>
                </div>
              </div>
              {hasActiveAI && (
                <span className="px-3 py-1 bg-green-400/20 text-green-100 text-sm font-medium rounded-full border border-green-400/30">
                  Active
                </span>
              )}
            </div>

            {hasActiveAI ? (
              <>
                {/* Active subscription features */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-semibold text-sm">Personal Scaling</h4>
                    <p className="text-purple-200 text-xs mt-1">AI-powered workout modifications</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">📸</div>
                    <h4 className="font-semibold text-sm">Scan Workouts</h4>
                    <p className="text-purple-200 text-xs mt-1">Photo-to-workout conversion</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">📊</div>
                    <h4 className="font-semibold text-sm">Smart Analysis</h4>
                    <p className="text-purple-200 text-xs mt-1">Performance insights & tips</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl mb-2">🤖</div>
                    <h4 className="font-semibold text-sm">AI Programming</h4>
                    <p className="text-purple-200 text-xs mt-1">Generate custom workouts</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push("/ai-coach/scan")}
                    className="px-4 py-2 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                  >
                    <span>📸</span> Scan Workout
                  </button>
                  {isCoachOrOwner && myGyms.length > 0 && (
                    <button
                      onClick={() => router.push(`/gym/${myGyms[0].id}`)}
                      className="px-4 py-2 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                    >
                      <span>🤖</span> AI Programming
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/weekly")}
                    className="px-4 py-2 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                  >
                    <span>🏠</span> View Workouts
                  </button>
                </div>

                {/* Subscription info */}
                {aiSubscription && (
                  <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-sm">
                    <span className="text-purple-200">
                      {aiSubscription.status === "trialing" ? "Trial ends" : "Renews"}{" "}
                      {(aiSubscription.status === "trialing"
                        ? aiSubscription.trialEndsAt?.toDate?.().toLocaleDateString()
                        : aiSubscription.endDate?.toDate?.().toLocaleDateString()) || "N/A"}
                    </span>
                    <button
                      onClick={() => router.push("/subscribe")}
                      className="text-white hover:underline"
                    >
                      Manage Subscription →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Not subscribed - show benefits */}
                <div className="mt-6">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-300">✓</span> Personalized workout scaling based on your abilities
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-300">✓</span> Scan photos of workouts to add them instantly
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-300">✓</span> AI-powered performance analysis and tips
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-300">✓</span> Generate custom programming with AI
                    </li>
                  </ul>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <button
                    onClick={() => router.push("/subscribe")}
                    className="px-6 py-3 bg-white text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Start Free Trial
                  </button>
                  <span className="text-purple-200 text-sm">7 days free, then $9.99/month</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* My Gyms */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Gym Memberships</h2>
            <button
              onClick={() => setShowFindGymModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>🔍</span> Find Gyms
            </button>
          </div>
          {myGyms.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏢</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Gym Memberships</h3>
              <p className="text-gray-500 text-sm mb-4">Join a gym to see their programming and sign up for classes</p>
              <button
                onClick={() => setShowFindGymModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Find a Gym
              </button>
            </div>
          ) : (
            <div className="space-y-3">
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
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-md">
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
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => router.push(`/gym/${gym.id}`)}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        View Gym
                      </button>
                      <button
                        onClick={() => router.push("/weekly")}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        See Programming
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coming Soon - Partner Programs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Partner Programs</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚀</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Coming Soon</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                We&apos;re working on partnerships with popular programming providers.
                Soon you&apos;ll be able to subscribe to programs like Comptrain, HWPO, and more directly through the app.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {["Comptrain", "HWPO", "Mayhem", "Street Parking", "Linchpin"].map((name) => (
                  <span key={name} className="px-3 py-1.5 bg-gray-100 text-gray-500 text-sm rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Create Your Own Gym */}
        {user?.role !== "owner" && user?.role !== "coach" && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-3xl">🏢</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">Are You a Coach?</h3>
                <p className="text-gray-300 text-sm mt-1">
                  Create your own gym, manage athletes, and use AI to program workouts
                </p>
              </div>
              <button
                onClick={() => router.push("/gym")}
                className="px-5 py-2.5 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Create Gym
              </button>
            </div>
          </div>
        )}
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
    </div>
  );
}
