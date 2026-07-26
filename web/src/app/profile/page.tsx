"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gender, AICoachPreferences } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Navigation from "@/components/Navigation";
import { sanitizeString } from "@/lib/security";

export default function ProfilePage() {
  const { user, loading, switching, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAIPrefs, setEditingAIPrefs] = useState(false);
  const [savingAIPrefs, setSavingAIPrefs] = useState(false);
  const [showCancelAICoachModal, setShowCancelAICoachModal] = useState(false);
  const [cancelingAICoach, setCancelingAICoach] = useState(false);
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
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Sanitize all user inputs
      const sanitizedFirstName = sanitizeString(formData.firstName, 50);
      const sanitizedLastName = sanitizeString(formData.lastName, 50);
      const sanitizedUsername = sanitizeString(formData.username, 30).toLowerCase();
      const sanitizedDisplayName = `${sanitizedFirstName} ${sanitizedLastName}`.trim();

      // Update private user data
      await updateDoc(doc(db, "users", user.id), {
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        displayName: sanitizedDisplayName,
        username: sanitizedUsername,
        gender: formData.gender,
        hideFromLeaderboards: formData.hideFromLeaderboards,
      });

      // Sync public profile (for leaderboards)
      await setDoc(doc(db, "userProfiles", user.id), {
        id: user.id,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        displayName: sanitizedDisplayName,
        role: user.role,
        hideFromLeaderboards: formData.hideFromLeaderboards,
      }, { merge: true });

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
      await refreshUser();
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

  const handleCancelAICoach = async () => {
    if (!user) return;

    setCancelingAICoach(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        "aiTrainerSubscription.status": "canceled",
      });
      await refreshUser();
      setShowCancelAICoachModal(false);
    } catch (error) {
      console.error("Error canceling AI Coach:", error);
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setCancelingAICoach(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
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

              <div>
                <div className="text-sm text-gray-500">Gender</div>
                <div className="font-medium text-gray-900">{user.gender || "-"}</div>
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

              {/* Cancel Button */}
              <button
                onClick={() => setShowCancelAICoachModal(true)}
                className="mt-4 text-sm text-purple-300 hover:text-white transition-colors"
              >
                Cancel Subscription
              </button>
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

      {/* Cancel AI Coach Modal */}
      {showCancelAICoachModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel AI Coach?</h2>
              <p className="text-gray-600 text-sm">
                Are you sure you want to cancel your AI Coach subscription?
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">What you&apos;ll lose:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Personalized weight recommendations</li>
                <li>• AI-powered scaling suggestions</li>
                <li>• Smart workout analysis</li>
                <li>• Unlimited AI programming conversations</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelAICoachModal(false)}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Keep AI Coach
              </button>
              <button
                onClick={handleCancelAICoach}
                disabled={cancelingAICoach}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 transition-colors"
              >
                {cancelingAICoach ? "Canceling..." : "Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
