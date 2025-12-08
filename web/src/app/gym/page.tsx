"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, GymApplication } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [myGyms, setMyGyms] = useState<(Gym & { role: string })[]>([]);
  const [approvedApplication, setApprovedApplication] = useState<GymApplication | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchGyms();
      checkApprovedApplication();
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

      // Filter gyms where user is the owner
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

  const checkApprovedApplication = async () => {
    if (!user) return;

    try {
      const applicationsQuery = query(
        collection(db, "gymApplications"),
        where("userId", "==", user.id),
        where("status", "==", "approved")
      );
      const snapshot = await getDocs(applicationsQuery);

      if (!snapshot.empty) {
        const app = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GymApplication;
        // Only show if no gym has been created yet
        if (!app.approvedGymId) {
          setApprovedApplication(app);
        }
      }
    } catch (error) {
      console.error("Error checking applications:", error);
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

  // If user has an approved application waiting for setup, redirect to setup
  if (!loadingData && approvedApplication) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Gym is Approved!</h1>
            <p className="text-gray-500">Complete your setup to start managing {approvedApplication.gymName}</p>
          </div>
          <button
            onClick={() => router.push("/gym/setup")}
            className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl hover:bg-green-700 transition-colors"
          >
            Complete Setup & Subscribe
          </button>
        </main>
      </div>
    );
  }

  // Show message for users who don't own any gyms
  if (!loadingData && myGyms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏢</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">No Gyms Yet</h1>
            <p className="text-gray-500">
              You don&apos;t own any gyms yet. Apply to create one and we&apos;ll review your application.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">How it works:</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Apply</h3>
                  <p className="text-gray-500 text-sm">Submit your gym details for verification</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Get Approved</h3>
                  <p className="text-gray-500 text-sm">We&apos;ll verify your gym and approve your application</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Subscribe & Launch</h3>
                  <p className="text-gray-500 text-sm">Choose your plan and start managing your gym</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push("/programming")}
            className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 transition-colors"
          >
            Apply to Create a Gym
          </button>

          <p className="text-center text-gray-400 text-sm mt-4">
            Go to Programming → Own a Gym to start your application
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Gyms</h1>
          <p className="text-gray-500">Manage gyms you own</p>
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
                    {gym.subscription?.status === "active" ? (
                      <span className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full">
                        Subscribed
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs font-medium rounded-full">
                        Setup Needed
                      </span>
                    )}
                    <span className="text-gray-400 text-xl">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Apply for another gym */}
        <div className="text-center">
          <button
            onClick={() => router.push("/programming")}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Want to add another gym? Apply here →
          </button>
        </div>
      </main>
    </div>
  );
}
