"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: "",
    hideFromLeaderboards: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
        gender: user.gender || "",
        hideFromLeaderboards: user.hideFromLeaderboards || false,
      });
    }
  }, [user]);

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
      // Refresh page to get updated user data
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>

        <div className="bg-gray-800 rounded-lg p-6">
          {/* Avatar placeholder */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center text-3xl font-bold">
              {user.firstName?.charAt(0) || user.displayName?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user.displayName}</h2>
              <p className="text-gray-400">@{user.username}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hideFromLeaderboards}
                  onChange={(e) =>
                    setFormData({ ...formData, hideFromLeaderboards: e.target.checked })
                  }
                  className="rounded text-orange-500"
                />
                <span>Hide from leaderboards</span>
              </label>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 rounded-lg font-medium transition-colors"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">First Name</div>
                  <div className="font-medium">{user.firstName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Last Name</div>
                  <div className="font-medium">{user.lastName}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Gender</div>
                <div className="font-medium">{user.gender}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Role</div>
                <div className="font-medium capitalize">{user.role}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Leaderboard Visibility</div>
                <div className="font-medium">
                  {user.hideFromLeaderboards ? "Hidden" : "Visible"}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Account Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Member since</span>
              <span>
                {user.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
