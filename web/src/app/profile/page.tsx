"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, collection, query, where, getDocs, arrayRemove } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, Gender, WorkoutGroup, AICoachPreferences } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Navigation from "@/components/Navigation";

// Subscription type for member's gym memberships
interface Subscription {
  id: string;
  gymId: string;
  gymName: string;
  planName: string;
  billingCycle: "monthly" | "yearly" | "one-time";
  price: number;
  status: "active" | "cancelled" | "paused";
  startDate: Date;
  nextBillingDate?: Date;
  classesRemaining?: number; // For class pack subscriptions
  classesTotal?: number;
}

// Group add-on for subscription display
interface GroupAddOn {
  id: string;
  gymId: string;
  gymName: string;
  groupName: string;
  additionalFee: number;
}

export default function ProfilePage() {
  const { user, loading, switching, signOut } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myGyms, setMyGyms] = useState<(Gym & { role: string })[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [groupAddOns, setGroupAddOns] = useState<GroupAddOn[]>([]);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showLeaveGymModal, setShowLeaveGymModal] = useState<(Gym & { role: string }) | null>(null);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState<GroupAddOn | null>(null);
  const [leavingGym, setLeavingGym] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [editingAIPrefs, setEditingAIPrefs] = useState(false);
  const [savingAIPrefs, setSavingAIPrefs] = useState(false);
  const [aiPrefsForm, setAiPrefsForm] = useState<AICoachPreferences>({
    goals: "",
    injuries: "",
    experienceLevel: "intermediate",
    focusAreas: [],
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: "Male" as Gender,
    hideFromLeaderboards: false,
  });

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
        gender: user.gender || "Male",
        hideFromLeaderboards: user.hideFromLeaderboards || false,
      });
      // Load AI Coach preferences
      if (user.aiCoachPreferences) {
        setAiPrefsForm({
          goals: user.aiCoachPreferences.goals || "",
          injuries: user.aiCoachPreferences.injuries || "",
          experienceLevel: user.aiCoachPreferences.experienceLevel || "intermediate",
          focusAreas: user.aiCoachPreferences.focusAreas || [],
        });
      }
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

      const userGyms = gyms
        .filter(
          (gym) =>
            gym.ownerId === user.id ||
            gym.coachIds?.includes(user.id) ||
            gym.memberIds?.includes(user.id)
        )
        .map((gym) => ({
          ...gym,
          role: gym.ownerId === user.id
            ? "Owner"
            : gym.coachIds?.includes(user.id)
            ? "Coach"
            : "Member",
        }));
      setMyGyms(userGyms);

      // Generate mockup subscriptions for gyms where user is a member
      const memberGyms = userGyms.filter((g) => g.role === "Member");
      const mockSubscriptions: Subscription[] = memberGyms.map((gym, idx) => ({
        id: `sub_${gym.id}`,
        gymId: gym.id,
        gymName: gym.name,
        planName: idx === 0 ? "Monthly Unlimited" : "10-Class Pack",
        billingCycle: idx === 0 ? "monthly" : "one-time",
        price: idx === 0 ? 150 : 200,
        status: "active",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        nextBillingDate: idx === 0 ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) : undefined, // 5 days from now
        classesRemaining: idx === 0 ? undefined : 7,
        classesTotal: idx === 0 ? undefined : 10,
      }));
      setSubscriptions(mockSubscriptions);

      // Fetch groups user is a member of (with additional fees)
      const groupsSnapshot = await getDocs(collection(db, "groups"));
      const allGroups = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutGroup[];

      // Filter groups where user is a member and has additional fee
      const userGroupAddOns: GroupAddOn[] = [];
      allGroups.forEach((group) => {
        if (group.memberIds?.includes(user.id) && group.additionalFee && group.additionalFee > 0) {
          const gym = gyms.find((g) => g.id === group.gymId);
          userGroupAddOns.push({
            id: group.id,
            gymId: group.gymId || "",
            gymName: gym?.name || "Unknown Gym",
            groupName: group.name,
            additionalFee: group.additionalFee,
          });
        }
      });
      setGroupAddOns(userGroupAddOns);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: `${formData.firstName} ${formData.lastName}`,
        username: formData.username.toLowerCase(),
        gender: formData.gender,
        hideFromLeaderboards: formData.hideFromLeaderboards,
      });
      setEditing(false);
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAIPrefs = async () => {
    if (!user) return;

    setSavingAIPrefs(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        aiCoachPreferences: {
          ...aiPrefsForm,
          updatedAt: Timestamp.now(),
        },
      });
      setEditingAIPrefs(false);
    } catch (error) {
      console.error("Error updating AI preferences:", error);
    } finally {
      setSavingAIPrefs(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    setAiPrefsForm(prev => ({
      ...prev,
      focusAreas: prev.focusAreas?.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...(prev.focusAreas || []), area],
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleCancelSubscription = (subId: string) => {
    // Mockup - in real implementation would call API
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subId ? { ...sub, status: "cancelled" as const } : sub
      )
    );
    setShowCancelModal(null);
  };

  const handleReactivateSubscription = (subId: string) => {
    // Mockup - in real implementation would call API
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subId ? { ...sub, status: "active" as const } : sub
      )
    );
  };

  const handleLeaveGym = async () => {
    if (!user || !showLeaveGymModal) return;

    setLeavingGym(true);
    try {
      const gym = showLeaveGymModal;
      const gymRef = doc(db, "gyms", gym.id);

      // Remove user from the appropriate array based on role
      if (gym.role === "Coach") {
        await updateDoc(gymRef, {
          coachIds: arrayRemove(user.id),
        });
      } else if (gym.role === "Member") {
        await updateDoc(gymRef, {
          memberIds: arrayRemove(user.id),
        });
      }

      // Also remove from all groups in this gym
      const groupsSnapshot = await getDocs(collection(db, "groups"));
      const gymGroups = groupsSnapshot.docs.filter(
        (doc) => doc.data().gymId === gym.id
      );
      for (const groupDoc of gymGroups) {
        await updateDoc(doc(db, "groups", groupDoc.id), {
          memberIds: arrayRemove(user.id),
          coachIds: arrayRemove(user.id),
        });
      }

      setShowLeaveGymModal(null);
      fetchGyms(); // Refresh the data
    } catch (error) {
      console.error("Error leaving gym:", error);
    } finally {
      setLeavingGym(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !showLeaveGroupModal) return;

    setLeavingGroup(true);
    try {
      const groupRef = doc(db, "groups", showLeaveGroupModal.id);
      await updateDoc(groupRef, {
        memberIds: arrayRemove(user.id),
      });

      setShowLeaveGroupModal(null);
      fetchGyms(); // Refresh the data
    } catch (error) {
      console.error("Error leaving group:", error);
    } finally {
      setLeavingGroup(false);
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
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Profile</h1>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl text-gray-500">
              👤
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.displayName}</h2>
              <p className="text-gray-500">@{user.username}</p>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hideFromLeaderboards}
                  onChange={(e) =>
                    setFormData({ ...formData, hideFromLeaderboards: e.target.checked })
                  }
                  className="rounded text-blue-600"
                />
                <span className="text-gray-700">Hide from leaderboards</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">First Name</div>
                  <div className="font-medium text-gray-900">{user.firstName || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Last Name</div>
                  <div className="font-medium text-gray-900">{user.lastName || "-"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Gender</div>
                  <div className="font-medium text-gray-900">{user.gender || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Role</div>
                  <div className="font-medium text-gray-900 capitalize">{user.role}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Leaderboard Visibility</div>
                <div className="font-medium text-gray-900">
                  {user.hideFromLeaderboards ? "Hidden" : "Visible"}
                </div>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                ✏️ Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* My Gyms */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Gyms</h3>
          {myGyms.length === 0 ? (
            <p className="text-gray-500 text-sm">Not a member of any gym</p>
          ) : (
            <div className="space-y-3">
              {myGyms.map((gym) => (
                <div key={gym.id} className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{gym.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleColor(gym.role)}`}>
                      {gym.role}
                    </span>
                    {gym.role !== "Owner" && (
                      <button
                        onClick={() => setShowLeaveGymModal(gym)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Subscriptions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Subscriptions</h3>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-3xl mb-2">💳</p>
              <p className="text-sm">No active subscriptions</p>
              <p className="text-xs text-gray-400 mt-1">Join a gym to start a membership</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border-2 ${
                    sub.status === "active"
                      ? "border-green-200 bg-green-50/50"
                      : sub.status === "cancelled"
                      ? "border-gray-200 bg-gray-50"
                      : "border-yellow-200 bg-yellow-50/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{sub.gymName}</h4>
                      <p className="text-sm text-gray-600">{sub.planName}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        sub.status === "active"
                          ? "bg-green-100 text-green-700"
                          : sub.status === "cancelled"
                          ? "bg-gray-200 text-gray-600"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {sub.status === "active" ? "Active" : sub.status === "cancelled" ? "Cancelled" : "Paused"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-gray-500">Price</div>
                      <div className="font-medium text-gray-900">
                        ${sub.price}
                        {sub.billingCycle === "monthly" && "/mo"}
                        {sub.billingCycle === "yearly" && "/yr"}
                        {sub.billingCycle === "one-time" && " (one-time)"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Started</div>
                      <div className="font-medium text-gray-900">
                        {sub.startDate.toLocaleDateString()}
                      </div>
                    </div>
                    {sub.nextBillingDate && sub.status === "active" && (
                      <div>
                        <div className="text-gray-500">Next Billing</div>
                        <div className="font-medium text-gray-900">
                          {sub.nextBillingDate.toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {sub.classesRemaining !== undefined && (
                      <div>
                        <div className="text-gray-500">Classes Remaining</div>
                        <div className="font-medium text-gray-900">
                          {sub.classesRemaining} / {sub.classesTotal}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar for class packs */}
                  {sub.classesRemaining !== undefined && sub.classesTotal && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(sub.classesRemaining / sub.classesTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {sub.classesTotal - sub.classesRemaining} classes used
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {sub.status === "active" ? (
                      <>
                        <button
                          onClick={() => router.push(`/gym/${sub.gymId}`)}
                          className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Gym
                        </button>
                        {sub.billingCycle !== "one-time" && (
                          <button
                            onClick={() => setShowCancelModal(sub.id)}
                            className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    ) : sub.status === "cancelled" ? (
                      <button
                        onClick={() => handleReactivateSubscription(sub.id)}
                        className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Reactivate Subscription
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Group Add-Ons */}
          {groupAddOns.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Group Add-Ons</h4>
              <div className="space-y-2">
                {groupAddOns.map((addOn) => (
                  <div
                    key={addOn.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{addOn.groupName}</p>
                      <p className="text-xs text-gray-500">{addOn.gymName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-amber-700">+${addOn.additionalFee}/mo</span>
                      <button
                        onClick={() => setShowLeaveGroupModal(addOn)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Unsubscribe
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Add-On Fees</span>
                  <span className="font-bold text-gray-900">
                    +${groupAddOns.reduce((sum, g) => sum + g.additionalFee, 0)}/mo
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment History Link */}
          {subscriptions.length > 0 && (
            <button className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2">
              📄 View Payment History
            </button>
          )}
        </div>

        {/* AI Coach Subscription */}
        <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">AI Coach</h3>
          </div>

          {user.aiTrainerSubscription?.status === "active" || user.aiTrainerSubscription?.status === "trialing" ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  user.aiTrainerSubscription.status === "trialing"
                    ? "bg-yellow-400 text-yellow-900"
                    : "bg-green-400 text-green-900"
                }`}>
                  {user.aiTrainerSubscription.status === "trialing" ? "Free Trial" : "Active"}
                </span>
                <span className="text-purple-200 text-sm">
                  {user.aiTrainerSubscription.tier === "pro" ? "Pro Plan" : "Elite Plan"}
                </span>
              </div>

              {user.aiTrainerSubscription.trialEndsAt && (
                <p className="text-sm text-purple-200 mb-3">
                  Trial ends: {user.aiTrainerSubscription.trialEndsAt.toDate().toLocaleDateString()}
                </p>
              )}

              {user.aiTrainerSubscription.endDate && user.aiTrainerSubscription.status === "active" && (
                <p className="text-sm text-purple-200 mb-3">
                  Renews: {user.aiTrainerSubscription.endDate.toDate().toLocaleDateString()}
                </p>
              )}

              <div className="text-sm text-purple-100">
                <p>You have access to:</p>
                <ul className="mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Personalized weight recommendations
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    AI scaling analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Unlimited AI programming
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-purple-200 text-sm mb-4">
                Get personalized coaching powered by AI that learns from your workout history.
              </p>
              <button
                onClick={() => router.push("/subscribe")}
                className="w-full py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-colors"
              >
                Start Free Trial
              </button>
            </div>
          )}
        </div>

        {/* AI Coach Goals & Preferences - Only show if subscribed */}
        {(user.aiTrainerSubscription?.status === "active" || user.aiTrainerSubscription?.status === "trialing") && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h3 className="text-lg font-semibold text-gray-900">AI Coach Goals</h3>
              </div>
              {!editingAIPrefs && (
                <button
                  onClick={() => setEditingAIPrefs(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Tell your AI Coach about your goals so it can give you better personalized advice.
            </p>

            {editingAIPrefs ? (
              <div className="space-y-4">
                {/* Goals */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What are your fitness goals?
                  </label>
                  <textarea
                    value={aiPrefsForm.goals || ""}
                    onChange={(e) => setAiPrefsForm({ ...aiPrefsForm, goals: e.target.value })}
                    placeholder="e.g., Get my first muscle-up, improve my 5K time, increase my back squat to 300lbs..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* Injuries/Limitations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Any injuries or limitations?
                  </label>
                  <textarea
                    value={aiPrefsForm.injuries || ""}
                    onChange={(e) => setAiPrefsForm({ ...aiPrefsForm, injuries: e.target.value })}
                    placeholder="e.g., Recovering from shoulder surgery, bad knees, avoid overhead movements..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={aiPrefsForm.experienceLevel || "intermediate"}
                    onChange={(e) => setAiPrefsForm({ ...aiPrefsForm, experienceLevel: e.target.value as AICoachPreferences["experienceLevel"] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner (0-1 years)</option>
                    <option value="intermediate">Intermediate (1-3 years)</option>
                    <option value="advanced">Advanced (3-5 years)</option>
                    <option value="competitor">Competitor (5+ years)</option>
                  </select>
                </div>

                {/* Focus Areas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Focus Areas (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["Strength", "Cardio/Endurance", "Gymnastics", "Olympic Lifting", "Mobility", "Weight Loss", "Competition Prep"].map((area) => (
                      <button
                        key={area}
                        onClick={() => toggleFocusArea(area)}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          aiPrefsForm.focusAreas?.includes(area)
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save/Cancel Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setEditingAIPrefs(false);
                      // Reset form to current values
                      if (user.aiCoachPreferences) {
                        setAiPrefsForm(user.aiCoachPreferences);
                      }
                    }}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAIPrefs}
                    disabled={savingAIPrefs}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
                  >
                    {savingAIPrefs ? "Saving..." : "Save Goals"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {aiPrefsForm.goals ? (
                  <>
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Goals</div>
                      <p className="text-gray-900 text-sm">{aiPrefsForm.goals}</p>
                    </div>
                    {aiPrefsForm.injuries && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Injuries/Limitations</div>
                        <p className="text-gray-900 text-sm">{aiPrefsForm.injuries}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {aiPrefsForm.experienceLevel || "Intermediate"}
                      </span>
                      {aiPrefsForm.focusAreas?.map((area) => (
                        <span key={area} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {area}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-3">No goals set yet</p>
                    <button
                      onClick={() => setEditingAIPrefs(true)}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Set Your Goals
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Account Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Member since</span>
              <span className="text-gray-900">
                {user.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
              </span>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </main>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription?</h2>
              <p className="text-gray-600 text-sm">
                Are you sure you want to cancel your subscription? You&apos;ll lose access at the end of your current billing period.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">What happens when you cancel:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Your subscription will remain active until the end of your billing period</li>
                <li>• You won&apos;t be charged again</li>
                <li>• You can reactivate anytime</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => handleCancelSubscription(showCancelModal)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Gym Modal */}
      {showLeaveGymModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏢</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Leave {showLeaveGymModal.name}?</h2>
              <p className="text-gray-600 text-sm">
                Are you sure you want to leave this gym? You&apos;ll lose access to all workouts and groups.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">What happens when you leave:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• You&apos;ll be removed from all groups at this gym</li>
                <li>• You&apos;ll lose access to the gym&apos;s workouts and schedule</li>
                <li>• Any active subscription will need to be cancelled separately</li>
                <li>• You can rejoin anytime by requesting access again</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveGymModal(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleLeaveGym}
                disabled={leavingGym}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors"
              >
                {leavingGym ? "Leaving..." : "Leave Gym"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Modal */}
      {showLeaveGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👥</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Unsubscribe from {showLeaveGroupModal.groupName}?</h2>
              <p className="text-gray-600 text-sm">
                This will remove the +${showLeaveGroupModal.additionalFee}/mo add-on from your subscription.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">What happens when you unsubscribe:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• You&apos;ll be removed from this group</li>
                <li>• You&apos;ll lose access to group-specific workouts</li>
                <li>• The additional fee will be removed from your next bill</li>
                <li>• You can rejoin anytime by requesting access again</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveGroupModal(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleLeaveGroup}
                disabled={leavingGroup}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors"
              >
                {leavingGroup ? "Unsubscribing..." : "Unsubscribe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
