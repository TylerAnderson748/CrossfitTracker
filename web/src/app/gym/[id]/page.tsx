"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, WorkoutGroup, AppUser } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface MembershipRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  createdAt: Timestamp;
}

export default function GymDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gymId = params.id as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [coaches, setCoaches] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<WorkoutGroup[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "coaches" | "groups" | "requests">("members");
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const isOwner = gym?.ownerId === user?.id;
  const isCoach = gym?.coachIds?.includes(user?.id || "") || isOwner;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && gymId) {
      fetchGymData();
    }
  }, [user, gymId]);

  const fetchGymData = async () => {
    try {
      // Fetch gym
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (!gymDoc.exists()) {
        router.push("/gym");
        return;
      }
      const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
      setGym(gymData);

      // Fetch members
      const memberPromises = (gymData.memberIds || []).map(async (id) => {
        const userDoc = await getDoc(doc(db, "users", id));
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() } as AppUser;
        }
        return null;
      });
      const memberResults = await Promise.all(memberPromises);
      setMembers(memberResults.filter(Boolean) as AppUser[]);

      // Fetch coaches
      const coachPromises = (gymData.coachIds || []).map(async (id) => {
        const userDoc = await getDoc(doc(db, "users", id));
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() } as AppUser;
        }
        return null;
      });
      const coachResults = await Promise.all(coachPromises);
      setCoaches(coachResults.filter(Boolean) as AppUser[]);

      // Fetch groups
      const groupsQuery = query(collection(db, "groups"), where("gymId", "==", gymId));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutGroup[];
      // Sort groups: "Members" group first, then by name
      groupsData.sort((a, b) => {
        if (a.name === "Members" && b.name !== "Members") return -1;
        if (a.name !== "Members" && b.name === "Members") return 1;
        return a.name.localeCompare(b.name);
      });
      setGroups(groupsData);

      // Fetch membership requests (for owners)
      if (gymData.ownerId === user?.id) {
        const requestsQuery = query(
          collection(db, "gymMembershipRequests"),
          where("gymId", "==", gymId),
          where("status", "==", "pending")
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestsData = requestsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MembershipRequest[];
        setRequests(requestsData);
      }
    } catch (error) {
      console.error("Error fetching gym data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleApproveRequest = async (request: MembershipRequest) => {
    try {
      // Add user to gym members
      await updateDoc(doc(db, "gyms", gymId), {
        memberIds: arrayUnion(request.userId),
      });
      // Update request status
      await updateDoc(doc(db, "gymMembershipRequests", request.id), {
        status: "approved",
      });
      fetchGymData();
    } catch (error) {
      console.error("Error approving request:", error);
    }
  };

  const handleDenyRequest = async (request: MembershipRequest) => {
    try {
      await updateDoc(doc(db, "gymMembershipRequests", request.id), {
        status: "denied",
      });
      setRequests(requests.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error denying request:", error);
    }
  };

  const handlePromoteToCoach = async (member: AppUser) => {
    try {
      await updateDoc(doc(db, "gyms", gymId), {
        memberIds: arrayRemove(member.id),
        coachIds: arrayUnion(member.id),
      });
      fetchGymData();
    } catch (error) {
      console.error("Error promoting member:", error);
    }
  };

  const handleDemoteToMember = async (coach: AppUser) => {
    try {
      await updateDoc(doc(db, "gyms", gymId), {
        coachIds: arrayRemove(coach.id),
        memberIds: arrayUnion(coach.id),
      });
      fetchGymData();
    } catch (error) {
      console.error("Error demoting coach:", error);
    }
  };

  const handleRemoveMember = async (member: AppUser) => {
    if (!confirm(`Remove ${member.firstName || member.email} from this gym?`)) return;
    try {
      await updateDoc(doc(db, "gyms", gymId), {
        memberIds: arrayRemove(member.id),
      });
      fetchGymData();
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "groups"), {
        gymId,
        name: newGroupName.trim(),
        type: "custom",
        ownerId: user.id,
        memberIds: [],
        coachIds: [],
        membershipType: "manual",
        isPublic: false,
        isDeletable: true,
        defaultTimeSlots: [],
        hideDetailsByDefault: false,
        defaultRevealDaysBefore: 1,
        defaultRevealHour: 16,
        defaultRevealMinute: 0,
        createdAt: Timestamp.now(),
      });
      setShowAddGroupModal(false);
      setNewGroupName("");
      // Navigate to the new group's detail page
      router.push(`/gym/${gymId}/groups/${docRef.id}`);
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleDeleteGroup = async (group: WorkoutGroup) => {
    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "groups", group.id));
      fetchGymData();
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  if (loading || !user || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Gym not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/gym" className="text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl">
              🏢
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{gym.name}</h1>
              <p className="text-gray-500">
                {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
              </p>
            </div>
            {isOwner && (
              <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                Owner
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: "members", label: "Members", count: members.length },
            { id: "coaches", label: "Coaches", count: coaches.length },
            { id: "groups", label: "Groups", count: groups.length },
            ...(isOwner ? [{ id: "requests", label: "Requests", count: requests.length }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? "bg-blue-500" : "bg-gray-200"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {activeTab === "members" && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
              {members.length === 0 ? (
                <p className="text-gray-500">No members yet</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                          {member.firstName?.charAt(0) || member.email?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-gray-500 text-sm">{member.email}</p>
                        </div>
                      </div>
                      {isOwner && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePromoteToCoach(member)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                          >
                            Make Coach
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "coaches" && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Coaches</h2>
              {coaches.length === 0 ? (
                <p className="text-gray-500">No coaches yet</p>
              ) : (
                <div className="space-y-3">
                  {coaches.map((coach) => (
                    <div key={coach.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-medium">
                          {coach.firstName?.charAt(0) || coach.email?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {coach.firstName} {coach.lastName}
                          </p>
                          <p className="text-gray-500 text-sm">{coach.email}</p>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">
                          Coach
                        </span>
                      </div>
                      {isOwner && coach.id !== user?.id && (
                        <button
                          onClick={() => handleDemoteToMember(coach)}
                          className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                        >
                          Remove Coach Role
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "groups" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Workout Groups</h2>
                {isCoach && (
                  <button
                    onClick={() => setShowAddGroupModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + Add Group
                  </button>
                )}
              </div>
              {groups.length === 0 ? (
                <p className="text-gray-500">No groups yet. Create groups to organize your programming.</p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => router.push(`/gym/${gymId}/groups/${group.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{group.name}</h3>
                            {group.type === "default" && (
                              <span className="text-xs text-orange-600">★ Default</span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm">
                            {group.memberIds?.length || 0} members
                            {group.defaultTimeSlots?.length > 0 && ` • ${group.defaultTimeSlots.length} class times`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCoach && group.name !== "Members" && group.isDeletable !== false && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group);
                            }}
                            className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "requests" && isOwner && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Membership Requests</h2>
              {requests.length === 0 ? (
                <p className="text-gray-500">No pending requests</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div>
                        <p className="font-medium text-gray-900">{request.userName}</p>
                        <p className="text-gray-500 text-sm">{request.userEmail}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDenyRequest(request)}
                          className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Group</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., 6AM Class, Competition Team"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
