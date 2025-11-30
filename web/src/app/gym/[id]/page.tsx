"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, WorkoutGroup, AppUser, ScheduledWorkout, WorkoutLog, WorkoutType } from "@/lib/types";
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
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "coaches" | "groups" | "programming" | "requests">("members");
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Programming modal state
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [newWorkoutTitle, setNewWorkoutTitle] = useState("");
  const [newWorkoutDescription, setNewWorkoutDescription] = useState("");
  const [newWorkoutDate, setNewWorkoutDate] = useState("");
  const [newWorkoutGroupIds, setNewWorkoutGroupIds] = useState<string[]>([]);
  const [newWorkoutType, setNewWorkoutType] = useState<WorkoutType>("wod");
  const [calendarRange, setCalendarRange] = useState<"thisWeek" | "nextWeek" | "2weeks" | "month">("thisWeek");
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);

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

      // Fetch scheduled workouts for this gym's groups
      const groupIds = groupsData.map((g) => g.id);
      if (groupIds.length > 0) {
        // Get workouts for the next 30 days
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const workoutsQuery = query(
          collection(db, "scheduledWorkouts"),
          where("groupIds", "array-contains-any", groupIds.slice(0, 10))
        );
        const workoutsSnapshot = await getDocs(workoutsQuery);
        const workoutsData = workoutsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((w) => {
            const workoutDate = (w as ScheduledWorkout).date?.toDate?.();
            return workoutDate && workoutDate >= now;
          })
          .sort((a, b) => {
            const dateA = (a as ScheduledWorkout).date?.toDate?.() || new Date();
            const dateB = (b as ScheduledWorkout).date?.toDate?.() || new Date();
            return dateA.getTime() - dateB.getTime();
          }) as ScheduledWorkout[];
        setScheduledWorkouts(workoutsData);
      }

      // Fetch workout logs from gym members for suggestions
      const allMemberIds = [
        gymData.ownerId,
        ...(gymData.coachIds || []),
        ...(gymData.memberIds || []),
      ].filter(Boolean);

      if (allMemberIds.length > 0) {
        // Fetch workout logs from gym members (limit to first 10 members due to Firestore limit)
        const logsQuery = query(
          collection(db, "workoutLogs"),
          where("userId", "in", allMemberIds.slice(0, 10))
        );
        const logsSnapshot = await getDocs(logsQuery);
        const logsData = logsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WorkoutLog[];
        setWorkoutLogs(logsData);
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
        membershipType: "invite-only",
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

  const handleCreateWorkout = async () => {
    if (!user || !newWorkoutTitle.trim() || !newWorkoutDate || newWorkoutGroupIds.length === 0) return;
    try {
      const workoutDate = new Date(newWorkoutDate);
      await addDoc(collection(db, "scheduledWorkouts"), {
        wodTitle: newWorkoutTitle.trim(),
        wodDescription: newWorkoutDescription.trim(),
        date: Timestamp.fromDate(workoutDate),
        workoutType: newWorkoutType,
        groupIds: newWorkoutGroupIds,
        createdBy: user.id,
        recurrenceType: "none",
        hideDetails: false,
        gymId: gymId,
      });
      setShowAddWorkoutModal(false);
      setNewWorkoutTitle("");
      setNewWorkoutDescription("");
      setNewWorkoutDate("");
      setNewWorkoutGroupIds([]);
      setNewWorkoutType("wod");
      fetchGymData();
    } catch (error) {
      console.error("Error creating workout:", error);
    }
  };

  const handleDeleteWorkout = async (workout: ScheduledWorkout) => {
    if (!confirm(`Delete "${workout.wodTitle}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "scheduledWorkouts", workout.id));
      fetchGymData();
    } catch (error) {
      console.error("Error deleting workout:", error);
    }
  };

  const formatWorkoutDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.name || "Unknown";
  };

  // Get unique workout titles and their descriptions for autocomplete
  const getUniqueWorkouts = () => {
    const workoutMap = new Map<string, { title: string; description: string }>();

    // Add from scheduled workouts
    scheduledWorkouts.forEach((w) => {
      if (w.wodTitle && !workoutMap.has(w.wodTitle.toLowerCase())) {
        workoutMap.set(w.wodTitle.toLowerCase(), {
          title: w.wodTitle,
          description: w.wodDescription || "",
        });
      }
    });

    // Add from workout logs
    workoutLogs.forEach((w) => {
      if (w.wodTitle && !workoutMap.has(w.wodTitle.toLowerCase())) {
        workoutMap.set(w.wodTitle.toLowerCase(), {
          title: w.wodTitle,
          description: w.wodDescription || "",
        });
      }
    });

    return Array.from(workoutMap.values());
  };

  const uniqueWorkouts = getUniqueWorkouts();

  const filteredSuggestions = newWorkoutTitle.trim().length > 0
    ? uniqueWorkouts.filter((w) =>
        w.title.toLowerCase().includes(newWorkoutTitle.toLowerCase())
      )
    : [];

  const handleSelectSuggestion = (workout: { title: string; description: string }) => {
    setNewWorkoutTitle(workout.title);
    setNewWorkoutDescription(workout.description);
    setShowTitleSuggestions(false);
  };

  // Calendar helper functions
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfThisWeek = getStartOfWeek(today);

    let start: Date;
    let end: Date;

    switch (calendarRange) {
      case "thisWeek":
        start = startOfThisWeek;
        end = new Date(startOfThisWeek);
        end.setDate(end.getDate() + 6);
        break;
      case "nextWeek":
        start = new Date(startOfThisWeek);
        start.setDate(start.getDate() + 7);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;
      case "2weeks":
        start = startOfThisWeek;
        end = new Date(startOfThisWeek);
        end.setDate(end.getDate() + 13);
        break;
      case "month":
        start = startOfThisWeek;
        end = new Date(startOfThisWeek);
        end.setDate(end.getDate() + 29);
        break;
      default:
        start = startOfThisWeek;
        end = new Date(startOfThisWeek);
        end.setDate(end.getDate() + 6);
    }
    return { start, end };
  };

  const getDaysInRange = () => {
    const { start, end } = getDateRange();
    const days: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const getWorkoutsForDate = (date: Date) => {
    return scheduledWorkouts.filter((w) => {
      const workoutDate = w.date?.toDate?.();
      if (!workoutDate) return false;
      return workoutDate.toDateString() === date.toDateString();
    });
  };

  const formatDayHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return { day: "Today", date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return { day: "Tomorrow", date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    }
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const calendarDays = getDaysInRange();
  const filteredWorkouts = scheduledWorkouts.filter((w) => {
    const workoutDate = w.date?.toDate?.();
    if (!workoutDate) return false;
    return workoutDate >= rangeStart && workoutDate <= rangeEnd;
  });

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
            ...(isCoach ? [{ id: "programming", label: "Programming", count: scheduledWorkouts.length }] : []),
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
                            {group.name === "Members" && (
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

          {activeTab === "programming" && isCoach && (
            <div className="p-6">
              {/* Header with title and add button */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Programming Calendar</h2>
                <button
                  onClick={() => setShowAddWorkoutModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  + Schedule Workout
                </button>
              </div>

              {/* Time Range Selector */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {[
                  { id: "thisWeek", label: "This Week" },
                  { id: "nextWeek", label: "Next Week" },
                  { id: "2weeks", label: "2 Weeks" },
                  { id: "month", label: "Month" },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setCalendarRange(range.id as typeof calendarRange)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                      calendarRange === range.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Date Range Display */}
              <div className="text-sm text-gray-500 mb-4">
                {rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                <span className="ml-2 text-gray-400">({filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? "s" : ""})</span>
              </div>

              {/* Calendar View */}
              <div className="space-y-3">
                {calendarDays.map((day) => {
                  const dayWorkouts = getWorkoutsForDate(day);
                  const { day: dayLabel, date: dateLabel } = formatDayHeader(day);
                  const isToday = day.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={day.toISOString()}
                      className={`rounded-lg border ${isToday ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
                    >
                      {/* Day Header */}
                      <div className={`flex items-center justify-between px-4 py-2 border-b ${isToday ? "border-blue-200" : "border-gray-100"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isToday ? "text-blue-700" : "text-gray-900"}`}>
                            {dayLabel}
                          </span>
                          <span className={`text-sm ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                            {dateLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {dayWorkouts.length > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                              {dayWorkouts.length} workout{dayWorkouts.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const dateStr = day.toISOString().split("T")[0];
                              setNewWorkoutDate(dateStr);
                              setShowAddWorkoutModal(true);
                            }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                              isToday
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Workouts for this day */}
                      <div className="p-2">
                        {dayWorkouts.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-2">No workouts scheduled</p>
                        ) : (
                          <div className="space-y-2">
                            {dayWorkouts.map((workout) => (
                              <div
                                key={workout.id}
                                className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                        workout.workoutType === "lift"
                                          ? "bg-purple-100 text-purple-700"
                                          : "bg-orange-100 text-orange-700"
                                      }`}>
                                        {workout.workoutType === "lift" ? "Lift" : "WOD"}
                                      </span>
                                      {workout.groupIds?.map((gId) => (
                                        <span key={gId} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                          {getGroupName(gId)}
                                        </span>
                                      ))}
                                    </div>
                                    <h4 className="font-medium text-gray-900">{workout.wodTitle}</h4>
                                    {workout.wodDescription && (
                                      <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap line-clamp-2">{workout.wodDescription}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteWorkout(workout)}
                                    className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* Add Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule Workout</h2>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workout Title *
                </label>
                <input
                  type="text"
                  value={newWorkoutTitle}
                  onChange={(e) => {
                    setNewWorkoutTitle(e.target.value);
                    setShowTitleSuggestions(true);
                  }}
                  onFocus={() => setShowTitleSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowTitleSuggestions(false), 200);
                  }}
                  placeholder="e.g., Monday WOD, Fran"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoComplete="off"
                />
                {/* Suggestions Dropdown */}
                {showTitleSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((workout, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectSuggestion(workout)}
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">{workout.title}</span>
                        {workout.description && (
                          <p className="text-gray-500 text-sm truncate">{workout.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workout Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewWorkoutType("wod")}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      newWorkoutType === "wod"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    WOD
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewWorkoutType("lift")}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      newWorkoutType === "lift"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Lift
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newWorkoutDescription}
                  onChange={(e) => setNewWorkoutDescription(e.target.value)}
                  placeholder="e.g., 21-15-9&#10;Thrusters (95/65)&#10;Pull-ups"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={newWorkoutDate}
                  onChange={(e) => setNewWorkoutDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Groups *
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWorkoutGroupIds.includes(group.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWorkoutGroupIds([...newWorkoutGroupIds, group.id]);
                          } else {
                            setNewWorkoutGroupIds(newWorkoutGroupIds.filter((id) => id !== group.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">{group.name}</span>
                    </label>
                  ))}
                </div>
                {groups.length === 0 && (
                  <p className="text-gray-500 text-sm mt-2">No groups available. Create groups first.</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddWorkoutModal(false);
                  setNewWorkoutTitle("");
                  setNewWorkoutDescription("");
                  setNewWorkoutDate("");
                  setNewWorkoutGroupIds([]);
                  setNewWorkoutType("wod");
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkout}
                disabled={!newWorkoutTitle.trim() || !newWorkoutDate || newWorkoutGroupIds.length === 0}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
