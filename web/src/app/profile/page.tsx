"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, Gender } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function ProfilePage() {
  const { user, loading, switching, signOut } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myGyms, setMyGyms] = useState<(Gym & { role: string })[]>([]);
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

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleColor(gym.role)}`}>
                    {gym.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
    </div>
  );
}
