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
  const [pendingApplication, setPendingApplication] = useState<GymApplication | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Fetch gyms and all user's applications in parallel
      const [gymsSnapshot, applicationsSnapshot] = await Promise.all([
        getDocs(collection(db, "gyms")),
        getDocs(query(
          collection(db, "gymApplications"),
          where("userId", "==", user.id)
        ))
      ]);

      // Process gyms
      const gyms = gymsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Gym[];

      const ownedGyms = gyms
        .filter((gym) => gym.ownerId === user.id)
        .map((gym) => ({
          ...gym,
          role: "Owner",
        }));

      setMyGyms(ownedGyms);

      // Process applications
      applicationsSnapshot.docs.forEach((doc) => {
        const app = { id: doc.id, ...doc.data() } as GymApplication;
        if (app.status === "approved" && !app.approvedGymId) {
          setApprovedApplication(app);
        } else if (app.status === "pending") {
          setPendingApplication(app);
        }
      });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoadingData(false);
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

  // Show pending application status
  if (!loadingData && myGyms.length === 0 && pendingApplication) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Pending</h1>
            <p className="text-gray-500">Your application for <strong>{pendingApplication.gymName}</strong> is under review.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Application Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Gym Name</span>
                <span className="font-medium text-gray-900">{pendingApplication.gymName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-900">{pendingApplication.gymCity}, {pendingApplication.gymState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Pending Review</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-4">We&apos;ll notify you once your application is reviewed.</p>
          </div>
        </main>
      </div>
    );
  }

  // Show message for users who don't own any gyms and have no applications
  if (!loadingData && myGyms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏢</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">No Gyms Yet</h1>
            <p className="text-gray-500 mb-6">
              You don&apos;t own any gyms yet.
            </p>
            <p className="text-gray-400 text-sm">
              To apply for a gym, go to <button onClick={() => router.push("/programming")} className="text-blue-600 hover:underline">Programming</button> and select &quot;Own a Gym&quot;
            </p>
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
