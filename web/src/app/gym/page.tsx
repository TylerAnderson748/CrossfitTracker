"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymPage() {
  const { user, loading, switching, refreshUser } = useAuth();
  const router = useRouter();
  const [myGyms, setMyGyms] = useState<(Gym & { role: string })[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGymName, setNewGymName] = useState("");
  const [creating, setCreating] = useState(false);

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
      // Fetch all gyms and filter to owned ones
      const gymsSnapshot = await getDocs(collection(db, "gyms"));
      const gyms = gymsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Gym[];

      // Filter gyms where user is the owner only
      const ownedGyms = gyms
        .filter((gym) => gym.ownerId === user.id)
        .map((gym) => ({
          ...gym,
          role: "Owner",
        }));

      setMyGyms(ownedGyms);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateGym = async () => {
    if (!user || !newGymName.trim()) return;

    setCreating(true);
    try {
      // Create the gym
      const gymRef = await addDoc(collection(db, "gyms"), {
        name: newGymName.trim(),
        ownerId: user.id,
        coachIds: [],
        memberIds: [],
        createdAt: Timestamp.now(),
      });

      // Set gymId and role on the owner's user document
      await updateDoc(doc(db, "users", user.id), {
        gymId: gymRef.id,
        role: "owner",
      });

      // Create the default "Members" group for this gym
      await addDoc(collection(db, "groups"), {
        name: "Members",
        type: "default",
        gymId: gymRef.id,
        ownerId: user.id,
        memberIds: [],
        coachIds: [user.id], // Owner is also a coach
        membershipType: "auto-assign-all",
        isPublic: true,
        isDeletable: false,
        defaultTimeSlots: [],
        hideDetailsByDefault: false,
        defaultRevealDaysBefore: 0,
        defaultRevealHour: 0,
        defaultRevealMinute: 0,
        signupCutoffMinutes: 0,
        createdAt: Timestamp.now(),
      });

      // Refresh user to get updated role
      if (refreshUser) {
        await refreshUser();
      }

      setShowCreateModal(false);
      setNewGymName("");

      // Redirect to the new gym's page
      router.push(`/gym/${gymRef.id}`);
    } catch (error) {
      console.error("Error creating gym:", error);
      alert("Failed to create gym. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Owner":
        return "bg-purple-100 text-purple-600";
      case "Coach":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-green-100 text-green-600";
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show create gym flow for users who don't own any gyms
  if (!loadingData && myGyms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-4xl">🏋️</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Create Your Gym</h1>
            <p className="text-gray-500 text-lg">
              Set up your gym to manage athletes, program workouts, and build your community
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">What you&apos;ll get:</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">👥</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Athlete Management</h3>
                  <p className="text-gray-500 text-sm">Invite athletes, create groups, and track their progress</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📅</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Class Scheduling</h3>
                  <p className="text-gray-500 text-sm">Set up class times and let athletes sign up for sessions</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📋</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Manual Programming</h3>
                  <p className="text-gray-500 text-sm">Create and publish workouts for your athletes</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Leaderboards</h3>
                  <p className="text-gray-500 text-sm">Track results and see how athletes compare</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Features Upsell */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Want AI-Powered Features?</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Subscribe to AI Coach Pro to unlock AI programming, photo scanning, and personalized coaching for just $9.99/month.
                </p>
                <Link href="/subscribe" className="inline-block mt-3 text-sm text-purple-600 font-medium hover:underline">
                  Learn more about AI Coach Pro →
                </Link>
              </div>
            </div>
          </div>

          {/* Create Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Get Started</h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What&apos;s your gym called?
              </label>
              <input
                type="text"
                value={newGymName}
                onChange={(e) => setNewGymName(e.target.value)}
                placeholder="e.g., CrossFit Downtown, Iron Athletics..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <button
              onClick={handleCreateGym}
              disabled={!newGymName.trim() || creating}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <span>🚀</span> Create My Gym
                </>
              )}
            </button>
            <p className="text-center text-gray-400 text-sm mt-4">
              Free to create • No credit card required
            </p>
          </div>

          {/* Back link */}
          <div className="text-center mt-6">
            <Link href="/programming" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to Subscriptions
            </Link>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Gyms</h1>
            <p className="text-gray-500">Manage gyms you own</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <span>➕</span> Create Gym
          </button>
        </div>

        {/* My Gyms */}
        <div className="mb-8">
          {loadingData ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-500">Loading gyms...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myGyms.map((gym) => (
                <Link
                  key={gym.id}
                  href={`/gym/${gym.id}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between hover:shadow-md transition-shadow block"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-md">
                      🏋️
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{gym.name}</h3>
                      <p className="text-gray-500 text-sm">
                        {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(gym.role)}`}>
                      {gym.role}
                    </span>
                    <span className="text-gray-400 text-xl">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Create Gym Modal (for owners who want another gym) */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🏋️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Create New Gym</h2>
                  <p className="text-gray-500 text-sm">Add another gym to manage</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gym Name
                </label>
                <input
                  type="text"
                  value={newGymName}
                  onChange={(e) => setNewGymName(e.target.value)}
                  placeholder="e.g., CrossFit Downtown"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewGymName("");
                  }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGym}
                  disabled={!newGymName.trim() || creating}
                  className="flex-1 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create Gym"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
