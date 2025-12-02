"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [myGyms, setMyGyms] = useState<(Gym & { role: string })[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGymName, setNewGymName] = useState("");

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

      // Redirect non-owners to programming page
      if (ownedGyms.length === 0) {
        router.replace("/programming");
        return;
      }

      setMyGyms(ownedGyms);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateGym = async () => {
    if (!user || !newGymName.trim()) return;

    try {
      // Create the gym
      const gymRef = await addDoc(collection(db, "gyms"), {
        name: newGymName.trim(),
        ownerId: user.id,
        coachIds: [],
        memberIds: [],
        createdAt: Timestamp.now(),
      });

      // Create the default "Members" group for this gym
      await addDoc(collection(db, "groups"), {
        name: "Members",
        type: "default",
        gymId: gymRef.id,
        ownerId: user.id,
        memberIds: [],
        coachIds: [],
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

      setShowCreateModal(false);
      setNewGymName("");
      fetchGyms();
    } catch (error) {
      console.error("Error creating gym:", error);
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
        </div>

        {/* My Gyms */}
        <div className="mb-8">
          {loadingData ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-500">Loading gyms...</p>
            </div>
          ) : myGyms.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="text-4xl mb-4">🏢</div>
              <p className="text-gray-500 mb-4">You don&apos;t own any gyms yet</p>
              <p className="text-gray-400 text-sm">Create a gym to get started</p>
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
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                      🏢
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{gym.name}</h3>
                      <p className="text-gray-500 text-sm">
                        {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(gym.role)}`}>
                      {gym.role}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left w-full md:w-auto"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
              ➕
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Create Gym</h3>
              <p className="text-gray-500 text-sm">Start your own gym community</p>
            </div>
          </button>
        </div>

        {/* Create Gym Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Gym</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gym Name
                </label>
                <input
                  type="text"
                  value={newGymName}
                  onChange={(e) => setNewGymName(e.target.value)}
                  placeholder="e.g., CrossFit Downtown"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGym}
                  disabled={!newGymName.trim()}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  Create Gym
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
