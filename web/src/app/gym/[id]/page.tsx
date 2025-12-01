"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, WorkoutGroup, AppUser, ScheduledWorkout, ScheduledTimeSlot, WorkoutLog, WorkoutComponent, WorkoutComponentType, workoutComponentLabels, workoutComponentColors, LiftResult, LeaderboardEntry, formatTimeSlot, GroupMembershipRequest, PricingTier, BillingCycle, ClassLimitType, DiscountCode, DiscountType } from "@/lib/types";
import { getAllWods, getAllLifts } from "@/lib/workoutData";
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
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gymId = params.id as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [coaches, setCoaches] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<WorkoutGroup[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [groupRequests, setGroupRequests] = useState<GroupMembershipRequest[]>([]);
  const [userGroupRequests, setUserGroupRequests] = useState<GroupMembershipRequest[]>([]); // User's own pending requests
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [liftResults, setLiftResults] = useState<LiftResult[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [allScheduledWorkouts, setAllScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "coaches" | "groups" | "programming" | "requests" | "pricing">("members");
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showDeleteGymModal, setShowDeleteGymModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Programming modal state
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [newWorkoutDate, setNewWorkoutDate] = useState("");
  const [newWorkoutGroupIds, setNewWorkoutGroupIds] = useState<string[]>([]);
  const [calendarRange, setCalendarRange] = useState<"thisWeek" | "nextWeek" | "2weeks" | "month">("thisWeek");
  // Workout components state
  const [workoutComponents, setWorkoutComponents] = useState<WorkoutComponent[]>([]);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingComponentTitle, setEditingComponentTitle] = useState("");
  const [editingComponentDescription, setEditingComponentDescription] = useState("");
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [repeatDays, setRepeatDays] = useState<number[]>([1]); // 0=Sun, 1=Mon, etc.
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  // Edit mode state
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [showEditSeriesModal, setShowEditSeriesModal] = useState(false);
  const [pendingEditWorkout, setPendingEditWorkout] = useState<ScheduledWorkout | null>(null);
  // Delete mode state
  const [showDeleteSeriesModal, setShowDeleteSeriesModal] = useState(false);
  const [pendingDeleteWorkout, setPendingDeleteWorkout] = useState<ScheduledWorkout | null>(null);
  // Time slots state
  const [workoutTimeSlots, setWorkoutTimeSlots] = useState<ScheduledTimeSlot[]>([]);
  const [newSlotHour, setNewSlotHour] = useState(6);
  const [newSlotMinute, setNewSlotMinute] = useState(0);
  const [newSlotCapacity, setNewSlotCapacity] = useState(20);
  // User cache for displaying signup names
  const [userCache, setUserCache] = useState<Record<string, string>>({});

  // Pricing state (mockup)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([
    { id: "tier_1", name: "Monthly Unlimited", monthlyPrice: 150, yearlyPrice: 1500, classLimitType: "unlimited", description: "Unlimited access to all classes", features: ["Unlimited classes", "Open gym access", "Member app access"], isActive: true },
    { id: "tier_2", name: "Drop-In", oneTimePrice: 25, classLimitType: "fixed", totalClasses: 1, description: "Single class visit", features: ["1 class access"], isActive: true },
    { id: "tier_3", name: "10-Class Pack", oneTimePrice: 200, classLimitType: "fixed", totalClasses: 10, description: "10 class punch card", features: ["10 class credits", "Never expires"], isActive: true },
    { id: "tier_4", name: "8x Monthly", monthlyPrice: 120, yearlyPrice: 1200, classLimitType: "per-month", classesPerMonth: 8, description: "8 classes per month", features: ["8 classes/month", "Open gym access"], isActive: true },
  ]);
  const [showAddPricingModal, setShowAddPricingModal] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [newTierName, setNewTierName] = useState("");
  const [newTierMonthlyPrice, setNewTierMonthlyPrice] = useState("");
  const [newTierYearlyPrice, setNewTierYearlyPrice] = useState("");
  const [newTierOneTimePrice, setNewTierOneTimePrice] = useState("");
  const [newTierClassLimitType, setNewTierClassLimitType] = useState<ClassLimitType>("unlimited");
  const [newTierClassesPerMonth, setNewTierClassesPerMonth] = useState("");
  const [newTierTotalClasses, setNewTierTotalClasses] = useState("");
  const [newTierDescription, setNewTierDescription] = useState("");
  const [newTierFeatures, setNewTierFeatures] = useState("");
  const [newTierIsHidden, setNewTierIsHidden] = useState(false);
  const [newTierSignupCode, setNewTierSignupCode] = useState("");

  // Discount codes state (mockup)
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([
    { id: "disc_1", code: "SUMMER20", discountType: "percentage", discountValue: 20, description: "Summer sale - 20% off", isActive: true, usageCount: 0 },
    { id: "disc_2", code: "FIRST10", discountType: "fixed", discountValue: 10, description: "$10 off first month", isActive: true, usageCount: 0 },
  ]);
  const [showAddDiscountModal, setShowAddDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [newDiscountCode, setNewDiscountCode] = useState("");
  const [newDiscountType, setNewDiscountType] = useState<DiscountType>("percentage");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newDiscountDescription, setNewDiscountDescription] = useState("");

  // Member subscription tracking (mockup)
  interface MemberPlan {
    oderId: string;
    planName: string;
    monthlyLimit: number | null; // null = unlimited
    checkInsThisMonth: number;
  }
  const [memberPlans, setMemberPlans] = useState<Record<string, MemberPlan>>({});

  const isOwner = gym?.ownerId === user?.id;
  const isCoach = gym?.coachIds?.includes(user?.id || "") || isOwner;

  // Helper to parse date string as local time (not UTC) to avoid timezone issues
  const parseDateLocal = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user && gymId) {
      fetchGymData();
    }
  }, [user, gymId]);

  // Auto-load default time slots when groups are selected
  useEffect(() => {
    if (newWorkoutGroupIds.length > 0 && showAddWorkoutModal && !editingWorkoutId) {
      const selectedGroups = groups.filter((g) => newWorkoutGroupIds.includes(g.id));
      const allDefaultSlots: ScheduledTimeSlot[] = [];
      const seenTimes = new Set<string>();

      selectedGroups.forEach((group) => {
        if (group.defaultTimeSlots?.length > 0) {
          group.defaultTimeSlots.forEach((slot) => {
            // Explicitly extract hour and minute to ensure they're copied
            const hour = typeof slot.hour === 'number' ? slot.hour : parseInt(slot.hour as unknown as string) || 0;
            const minute = typeof slot.minute === 'number' ? slot.minute : parseInt(slot.minute as unknown as string) || 0;
            const timeKey = `${hour}:${minute}`;
            if (!seenTimes.has(timeKey)) {
              seenTimes.add(timeKey);
              allDefaultSlots.push({
                id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                hour: hour,
                minute: minute,
                capacity: slot.capacity || 20,
                signups: [],
              });
            }
          });
        }
      });

      if (allDefaultSlots.length > 0) {
        setWorkoutTimeSlots(
          allDefaultSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
        );
      }
    }
  }, [newWorkoutGroupIds, groups, showAddWorkoutModal, editingWorkoutId]);

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

      // Fetch group membership requests (for coaches/owners)
      const isCoachOrOwner = gymData.ownerId === user?.id || gymData.coachIds?.includes(user?.id || "");
      if (isCoachOrOwner) {
        const groupRequestsQuery = query(
          collection(db, "groupMembershipRequests"),
          where("gymId", "==", gymId),
          where("status", "==", "pending")
        );
        const groupRequestsSnapshot = await getDocs(groupRequestsQuery);
        const groupRequestsData = groupRequestsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GroupMembershipRequest[];
        setGroupRequests(groupRequestsData);
      }

      // Fetch user's own pending group requests
      if (user?.id) {
        const userGroupRequestsQuery = query(
          collection(db, "groupMembershipRequests"),
          where("gymId", "==", gymId),
          where("userId", "==", user.id),
          where("status", "==", "pending")
        );
        const userGroupRequestsSnapshot = await getDocs(userGroupRequestsQuery);
        const userGroupRequestsData = userGroupRequestsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GroupMembershipRequest[];
        setUserGroupRequests(userGroupRequestsData);
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

        // Fetch user names for all signed up users
        const allSignupUserIds = new Set<string>();
        workoutsData.forEach((workout) => {
          workout.timeSlots?.forEach((slot: any) => {
            const signups = slot.signups || slot.signedUpUserIds || [];
            signups.forEach((userId: string) => allSignupUserIds.add(userId));
          });
        });

        if (allSignupUserIds.size > 0) {
          const userIds = Array.from(allSignupUserIds);
          const userCacheMap: Record<string, string> = {};
          // Fetch users in batches of 10 (Firestore limit for 'in' queries)
          for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const usersQuery = query(collection(db, "users"), where("__name__", "in", batch));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.docs.forEach((doc) => {
              const userData = doc.data();
              userCacheMap[doc.id] = userData.displayName || userData.name || userData.email || 'Unknown User';
            });
          }
          setUserCache(userCacheMap);
        }

        // Count check-ins per member for current month (mockup)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const memberCheckIns: Record<string, number> = {};

        workoutsData.forEach((workout) => {
          const workoutDate = workout.date?.toDate?.();
          if (workoutDate && workoutDate.getMonth() === currentMonth && workoutDate.getFullYear() === currentYear) {
            workout.timeSlots?.forEach((slot: any) => {
              const signups = slot.signups || slot.signedUpUserIds || [];
              signups.forEach((userId: string) => {
                memberCheckIns[userId] = (memberCheckIns[userId] || 0) + 1;
              });
            });
          }
        });

        // Assign mockup membership plans to members
        const plans: Record<string, MemberPlan> = {};
        const planTypes = [
          { planName: "Monthly Unlimited", monthlyLimit: null },
          { planName: "8x Monthly", monthlyLimit: 8 },
          { planName: "10-Class Pack", monthlyLimit: 10 },
          { planName: "Drop-In", monthlyLimit: 1 },
        ];
        (gymData.memberIds || []).forEach((memberId, index) => {
          // Distribute plans - first few get unlimited, rest get limited plans
          const planType = planTypes[index % planTypes.length];
          plans[memberId] = {
            oderId: `order_${memberId}`,
            planName: planType.planName,
            monthlyLimit: planType.monthlyLimit,
            checkInsThisMonth: memberCheckIns[memberId] || 0,
          };
        });
        setMemberPlans(plans);
      }

      // Fetch ALL workout logs for suggestions (not limited to gym members)
      const logsQuery = query(collection(db, "workoutLogs"));
      const logsSnapshot = await getDocs(logsQuery);
      const logsData = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      setWorkoutLogs(logsData);

      // Fetch ALL lift results for suggestions
      const liftsQuery = query(collection(db, "liftResults"));
      const liftsSnapshot = await getDocs(liftsQuery);
      const liftsData = liftsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LiftResult[];
      setLiftResults(liftsData);

      // Fetch ALL leaderboard entries for suggestions (contains benchmark WOD names like Fran)
      const leaderboardQuery = query(collection(db, "leaderboardEntries"));
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      const leaderboardData = leaderboardSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];
      setLeaderboardEntries(leaderboardData);

      // Fetch ALL scheduled workouts for suggestions (not just current gym)
      const allWorkoutsQuery = query(collection(db, "scheduledWorkouts"));
      const allWorkoutsSnapshot = await getDocs(allWorkoutsQuery);
      const allWorkoutsData = allWorkoutsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledWorkout[];
      setAllScheduledWorkouts(allWorkoutsData);
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
      // Add user to all auto-assign groups (like Members)
      const autoAssignGroups = groups.filter((g) => g.membershipType === "auto-assign-all");
      for (const group of autoAssignGroups) {
        await updateDoc(doc(db, "groups", group.id), {
          memberIds: arrayUnion(request.userId),
        });
      }
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

  // Group membership request handlers
  const handleRequestGroupAccess = async (group: WorkoutGroup) => {
    if (!user || !gym) return;
    try {
      await addDoc(collection(db, "groupMembershipRequests"), {
        groupId: group.id,
        groupName: group.name,
        gymId: gymId,
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        status: "pending",
        createdAt: Timestamp.now(),
      });
      fetchGymData();
    } catch (error) {
      console.error("Error requesting group access:", error);
    }
  };

  const handleApproveGroupRequest = async (request: GroupMembershipRequest) => {
    try {
      // Add user to group members
      await updateDoc(doc(db, "groups", request.groupId), {
        memberIds: arrayUnion(request.userId),
      });
      // Update request status
      await updateDoc(doc(db, "groupMembershipRequests", request.id), {
        status: "approved",
      });
      fetchGymData();
    } catch (error) {
      console.error("Error approving group request:", error);
    }
  };

  const handleDenyGroupRequest = async (request: GroupMembershipRequest) => {
    try {
      await updateDoc(doc(db, "groupMembershipRequests", request.id), {
        status: "denied",
      });
      setGroupRequests(groupRequests.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error denying group request:", error);
    }
  };

  const hasRequestedGroup = (groupId: string) => {
    return userGroupRequests.some((r) => r.groupId === groupId);
  };

  const isGroupMember = (group: WorkoutGroup) => {
    // Gym owners and coaches have access to all groups
    if (isOwner || isCoach) return true;
    return group.memberIds?.includes(user?.id || "") || group.coachIds?.includes(user?.id || "") || group.ownerId === user?.id;
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
        signupCutoffMinutes: 0,
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

  const handleDeleteGym = async () => {
    if (!gym || !isOwner) return;
    try {
      // Delete all groups associated with this gym
      const groupsQuery = query(collection(db, "groups"), where("gymId", "==", gymId));
      const groupsSnapshot = await getDocs(groupsQuery);
      for (const groupDoc of groupsSnapshot.docs) {
        await deleteDoc(doc(db, "groups", groupDoc.id));
      }

      // Delete all scheduled workouts for this gym's groups
      const groupIds = groupsSnapshot.docs.map(d => d.id);
      if (groupIds.length > 0) {
        const workoutsQuery = query(
          collection(db, "scheduledWorkouts"),
          where("groupIds", "array-contains-any", groupIds.slice(0, 10))
        );
        const workoutsSnapshot = await getDocs(workoutsQuery);
        for (const workoutDoc of workoutsSnapshot.docs) {
          await deleteDoc(doc(db, "scheduledWorkouts", workoutDoc.id));
        }
      }

      // Delete membership requests for this gym
      const requestsQuery = query(collection(db, "gymMembershipRequests"), where("gymId", "==", gymId));
      const requestsSnapshot = await getDocs(requestsQuery);
      for (const requestDoc of requestsSnapshot.docs) {
        await deleteDoc(doc(db, "gymMembershipRequests", requestDoc.id));
      }

      // Delete group membership requests for this gym
      const groupRequestsQuery = query(collection(db, "groupMembershipRequests"), where("gymId", "==", gymId));
      const groupRequestsSnapshot = await getDocs(groupRequestsQuery);
      for (const requestDoc of groupRequestsSnapshot.docs) {
        await deleteDoc(doc(db, "groupMembershipRequests", requestDoc.id));
      }

      // Delete the gym itself
      await deleteDoc(doc(db, "gyms", gymId));

      // Redirect to gym list
      router.push("/gym");
    } catch (error) {
      console.error("Error deleting gym:", error);
    }
  };

  const handleCreateWorkout = async () => {
    if (!user || workoutComponents.length === 0 || !newWorkoutDate || newWorkoutGroupIds.length === 0) return;
    try {
      const startDate = parseDateLocal(newWorkoutDate);
      const workoutDates: Date[] = [];

      if (recurrenceType === "none") {
        workoutDates.push(startDate);
      } else {
        const finalEndDate = hasEndDate && endDate
          ? parseDateLocal(endDate)
          : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year max

        const currentDate = new Date(startDate);

        while (currentDate <= finalEndDate) {
          if (recurrenceType === "daily") {
            workoutDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrenceType === "weekly") {
            if (repeatDays.includes(currentDate.getDay())) {
              workoutDates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrenceType === "monthly") {
            workoutDates.push(new Date(currentDate));
            currentDate.setMonth(currentDate.getMonth() + 1);
          }

          // Safety limit: max 100 workouts
          if (workoutDates.length >= 100) break;
        }
      }

      // Generate title from components
      const mainComponent = workoutComponents.find(c => c.type === "wod") || workoutComponents[0];
      const wodTitle = mainComponent?.title || workoutComponents.map(c => workoutComponentLabels[c.type]).join(" + ");

      // Generate seriesId for recurring workouts
      const seriesId = recurrenceType !== "none" ? `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined;

      // Check if any selected group has hideDetailsByDefault enabled
      const selectedGroups = groups.filter(g => newWorkoutGroupIds.includes(g.id));
      const groupWithHiddenDetails = selectedGroups.find(g => g.hideDetailsByDefault);
      const shouldHideDetails = !!groupWithHiddenDetails;

      // Create all workout documents
      for (const date of workoutDates) {
        // Calculate reveal date if details should be hidden
        let revealDate: Timestamp | undefined;
        if (shouldHideDetails && groupWithHiddenDetails) {
          const revealDateTime = new Date(date);
          revealDateTime.setDate(revealDateTime.getDate() - (groupWithHiddenDetails.defaultRevealDaysBefore || 0));
          revealDateTime.setHours(
            groupWithHiddenDetails.defaultRevealHour || 0,
            groupWithHiddenDetails.defaultRevealMinute || 0,
            0,
            0
          );
          revealDate = Timestamp.fromDate(revealDateTime);
        }

        await addDoc(collection(db, "scheduledWorkouts"), {
          wodTitle,
          wodDescription: workoutComponents.map(c => `${workoutComponentLabels[c.type]}: ${c.description}`).join("\n\n"),
          date: Timestamp.fromDate(date),
          workoutType: workoutComponents.some(c => c.type === "wod") ? "wod" : "lift",
          groupIds: newWorkoutGroupIds,
          createdBy: user.id,
          recurrenceType: recurrenceType,
          hideDetails: shouldHideDetails,
          ...(revealDate && { revealDate }),
          gymId: gymId,
          components: workoutComponents,
          ...(seriesId && { seriesId }),
          ...(workoutTimeSlots.length > 0 && { timeSlots: workoutTimeSlots }),
        });
      }

      // Reset form
      resetWorkoutModal();
      fetchGymData();
    } catch (error) {
      console.error("Error creating workout:", error);
    }
  };

  const handleSyncVisibilitySettings = async () => {
    if (!isOwner && !isCoach) return;

    try {
      let updatedCount = 0;

      // Debug: Log groups and their visibility settings
      console.log("Groups:", groups.map(g => ({
        id: g.id,
        name: g.name,
        hideDetailsByDefault: g.hideDetailsByDefault,
        defaultRevealDaysBefore: g.defaultRevealDaysBefore
      })));

      // Fetch ALL workouts for this gym's groups (not just the ones in state)
      const groupIds = groups.map(g => g.id);
      if (groupIds.length === 0) {
        alert("No groups found.");
        return;
      }

      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("groupIds", "array-contains-any", groupIds.slice(0, 10))
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const allWorkouts = workoutsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as ScheduledWorkout[];

      console.log(`Found ${allWorkouts.length} workouts to sync`);

      for (const workout of allWorkouts) {
        // Find groups for this workout
        const workoutGroups = groups.filter(g => workout.groupIds?.includes(g.id));
        const groupWithHiddenDetails = workoutGroups.find(g => g.hideDetailsByDefault === true);
        const shouldHideDetails = !!groupWithHiddenDetails;

        console.log(`Workout "${workout.wodTitle}": groups=${workoutGroups.map(g => g.name).join(", ")}, shouldHide=${shouldHideDetails}`);

        // Calculate reveal date if details should be hidden
        let revealDate: Timestamp | undefined;
        if (shouldHideDetails && groupWithHiddenDetails) {
          const workoutDate = workout.date.toDate();
          const revealDateTime = new Date(workoutDate);
          revealDateTime.setDate(revealDateTime.getDate() - (groupWithHiddenDetails.defaultRevealDaysBefore || 0));
          revealDateTime.setHours(
            groupWithHiddenDetails.defaultRevealHour || 0,
            groupWithHiddenDetails.defaultRevealMinute || 0,
            0,
            0
          );
          revealDate = Timestamp.fromDate(revealDateTime);
          console.log(`  -> revealDate: ${revealDateTime.toISOString()}`);
        }

        // Update the workout
        await updateDoc(doc(db, "scheduledWorkouts", workout.id), {
          hideDetails: shouldHideDetails,
          ...(revealDate ? { revealDate } : {}),
        });
        updatedCount++;
      }

      alert(`Updated visibility settings for ${updatedCount} workout(s).`);
      fetchGymData();
    } catch (error) {
      console.error("Error syncing visibility settings:", error);
      alert("Error syncing visibility settings. Please try again.");
    }
  };

  const resetWorkoutModal = () => {
    setShowAddWorkoutModal(false);
    setNewWorkoutDate("");
    setNewWorkoutGroupIds([]);
    setWorkoutComponents([]);
    setEditingComponentId(null);
    setEditingComponentTitle("");
    setEditingComponentDescription("");
    setRecurrenceType("none");
    setRepeatDays([1]);
    setHasEndDate(false);
    setEndDate("");
    setEditingWorkoutId(null);
    setEditingSeriesId(null);
    setPendingEditWorkout(null);
    setWorkoutTimeSlots([]);
    setNewSlotHour(6);
    setNewSlotMinute(0);
    setNewSlotCapacity(20);
  };

  const handleEditWorkout = (workout: ScheduledWorkout) => {
    // If workout is part of a series, show dialog to choose edit type
    if (workout.seriesId) {
      setPendingEditWorkout(workout);
      setShowEditSeriesModal(true);
      return;
    }
    // Otherwise, proceed with single workout edit
    startEditingWorkout(workout, false);
  };

  const startEditingWorkout = (workout: ScheduledWorkout, editSeries: boolean) => {
    setEditingWorkoutId(workout.id);
    if (editSeries && workout.seriesId) {
      setEditingSeriesId(workout.seriesId);
    } else {
      setEditingSeriesId(null);
    }

    // Convert Timestamp to date string for the input
    const workoutDate = workout.date.toDate();
    const dateStr = workoutDate.toISOString().split("T")[0];
    setNewWorkoutDate(dateStr);
    setNewWorkoutGroupIds(workout.groupIds || []);

    // Load components if available, otherwise create from legacy data
    if (workout.components && workout.components.length > 0) {
      setWorkoutComponents(workout.components);
    } else {
      // Legacy workout - create single component
      const legacyComponent: WorkoutComponent = {
        id: `legacy_${Date.now()}`,
        type: workout.workoutType === "lift" ? "lift" : "wod",
        title: workout.wodTitle,
        description: workout.wodDescription,
      };
      setWorkoutComponents([legacyComponent]);
    }

    // Load time slots if available
    setWorkoutTimeSlots(workout.timeSlots || []);

    setRecurrenceType("none"); // Don't allow recurrence when editing
    setShowEditSeriesModal(false);
    setPendingEditWorkout(null);
    setShowAddWorkoutModal(true);
  };

  const handleUpdateWorkout = async () => {
    if (!user || !editingWorkoutId || workoutComponents.length === 0 || !newWorkoutDate || newWorkoutGroupIds.length === 0) return;
    try {
      // Generate title from components
      const mainComponent = workoutComponents.find(c => c.type === "wod") || workoutComponents[0];
      const wodTitle = mainComponent?.title || workoutComponents.map(c => workoutComponentLabels[c.type]).join(" + ");

      const updateData = {
        wodTitle,
        wodDescription: workoutComponents.map(c => `${workoutComponentLabels[c.type]}: ${c.description}`).join("\n\n"),
        workoutType: workoutComponents.some(c => c.type === "wod") ? "wod" : "lift",
        groupIds: newWorkoutGroupIds,
        components: workoutComponents,
        timeSlots: workoutTimeSlots,
      };

      if (editingSeriesId) {
        // Update all workouts in the series
        const seriesQuery = query(
          collection(db, "scheduledWorkouts"),
          where("seriesId", "==", editingSeriesId)
        );
        const seriesSnapshot = await getDocs(seriesQuery);

        const updatePromises = seriesSnapshot.docs.map((docSnap) =>
          updateDoc(doc(db, "scheduledWorkouts", docSnap.id), updateData)
        );
        await Promise.all(updatePromises);
      } else {
        // Update single workout (also update date for single edits)
        const workoutDate = parseDateLocal(newWorkoutDate);
        await updateDoc(doc(db, "scheduledWorkouts", editingWorkoutId), {
          ...updateData,
          date: Timestamp.fromDate(workoutDate),
        });
      }

      resetWorkoutModal();
      fetchGymData();
    } catch (error) {
      console.error("Error updating workout:", error);
    }
  };

  const addComponent = (type: WorkoutComponentType) => {
    const newComponent: WorkoutComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: "",
      description: "",
    };
    setWorkoutComponents([...workoutComponents, newComponent]);
  };

  const removeComponent = (id: string) => {
    setWorkoutComponents(workoutComponents.filter(c => c.id !== id));
  };

  const updateComponent = (id: string, field: "title" | "description", value: string) => {
    setWorkoutComponents(workoutComponents.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  // For autocomplete dropdown
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);

  const handleDeleteWorkout = (workout: ScheduledWorkout) => {
    // If workout is part of a series, show dialog to choose delete type
    if (workout.seriesId) {
      setPendingDeleteWorkout(workout);
      setShowDeleteSeriesModal(true);
      return;
    }
    // Otherwise, confirm and delete single workout
    confirmDeleteWorkout(workout, false);
  };

  const confirmDeleteWorkout = async (workout: ScheduledWorkout, deleteSeries: boolean) => {
    const message = deleteSeries
      ? `Delete all workouts in this series? This cannot be undone.`
      : `Delete "${workout.wodTitle}"? This cannot be undone.`;

    if (!confirm(message)) {
      setShowDeleteSeriesModal(false);
      setPendingDeleteWorkout(null);
      return;
    }

    try {
      if (deleteSeries && workout.seriesId) {
        // Delete all workouts in the series
        const seriesQuery = query(
          collection(db, "scheduledWorkouts"),
          where("seriesId", "==", workout.seriesId)
        );
        const seriesSnapshot = await getDocs(seriesQuery);

        const deletePromises = seriesSnapshot.docs.map((docSnap) =>
          deleteDoc(doc(db, "scheduledWorkouts", docSnap.id))
        );
        await Promise.all(deletePromises);
      } else {
        // Delete single workout
        await deleteDoc(doc(db, "scheduledWorkouts", workout.id));
      }

      setShowDeleteSeriesModal(false);
      setPendingDeleteWorkout(null);
      fetchGymData();
    } catch (error) {
      console.error("Error deleting workout:", error);
    }
  };

  const handleBackfillTimeSlots = async (forceAll: boolean = false) => {
    const message = forceAll
      ? "This will REPLACE all time slots on all workouts with fresh defaults from groups. Continue?"
      : "Add/fix time slots for workouts missing them? This will use the time slots from each workout's assigned groups.";

    if (!confirm(message)) {
      return;
    }

    try {
      // Find workouts to update
      const workoutsToUpdate = forceAll
        ? scheduledWorkouts
        : scheduledWorkouts.filter((w) => {
            // No time slots at all
            if (!w.timeSlots || w.timeSlots.length === 0) return true;
            // Has time slots but they're corrupted (check if any slot has valid hour > 0)
            const hasValidSlot = w.timeSlots.some(
              (slot) => typeof slot.hour === 'number' && slot.hour > 0
            );
            return !hasValidSlot;
          });

      if (workoutsToUpdate.length === 0) {
        alert("All workouts already have valid time slots!");
        return;
      }

      let updatedCount = 0;

      for (const workout of workoutsToUpdate) {
        // Get default time slots from the workout's groups
        const workoutGroups = groups.filter((g) => workout.groupIds?.includes(g.id));
        const allDefaultSlots: ScheduledTimeSlot[] = [];
        const seenTimes = new Set<string>();

        workoutGroups.forEach((group) => {
          if (group.defaultTimeSlots?.length > 0) {
            group.defaultTimeSlots.forEach((slot: any) => {
              // Explicitly extract hour and minute to ensure they're copied
              const hour = typeof slot.hour === 'number' ? slot.hour : parseInt(slot.hour) || 0;
              const minute = typeof slot.minute === 'number' ? slot.minute : parseInt(slot.minute) || 0;
              const timeKey = `${hour}:${minute}`;
              if (!seenTimes.has(timeKey)) {
                seenTimes.add(timeKey);
                allDefaultSlots.push({
                  id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  hour: hour,
                  minute: minute,
                  capacity: slot.capacity || 20,
                  signups: [],
                });
              }
            });
          }
        });

        if (allDefaultSlots.length > 0) {
          const sortedSlots = allDefaultSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
          await updateDoc(doc(db, "scheduledWorkouts", workout.id), {
            timeSlots: sortedSlots,
          });
          updatedCount++;
        }
      }

      alert(`Added time slots to ${updatedCount} workout${updatedCount !== 1 ? "s" : ""}!`);
      fetchGymData();
    } catch (error) {
      console.error("Error backfilling time slots:", error);
      alert("Error adding time slots. Please try again.");
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

    // First, add all WODs from workoutData (Girls, Heroes, etc.)
    getAllWods().forEach((w) => {
      workoutMap.set(w.name.toLowerCase(), {
        title: w.name,
        description: w.description,
      });
    });

    // Add all lifts from workoutData
    getAllLifts().forEach((w) => {
      workoutMap.set(w.name.toLowerCase(), {
        title: w.name,
        description: w.description,
      });
    });

    // Add from ALL scheduled workouts (entire database) - custom workouts
    allScheduledWorkouts.forEach((w) => {
      if (w.wodTitle && !workoutMap.has(w.wodTitle.toLowerCase())) {
        workoutMap.set(w.wodTitle.toLowerCase(), {
          title: w.wodTitle,
          description: w.wodDescription || "",
        });
      }
    });

    // Add from current gym's scheduled workouts
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

    // Add from lift results
    liftResults.forEach((lift) => {
      if (lift.liftName && !workoutMap.has(lift.liftName.toLowerCase())) {
        workoutMap.set(lift.liftName.toLowerCase(), {
          title: lift.liftName,
          description: "",
        });
      }
    });

    // Add from leaderboard entries
    leaderboardEntries.forEach((entry) => {
      if (entry.originalWorkoutName && !workoutMap.has(entry.originalWorkoutName.toLowerCase())) {
        workoutMap.set(entry.originalWorkoutName.toLowerCase(), {
          title: entry.originalWorkoutName,
          description: "",
        });
      }
    });

    return Array.from(workoutMap.values());
  };

  const uniqueWorkouts = getUniqueWorkouts();

  // Show all suggestions when empty, or filter when typing
  const filteredSuggestions = editingComponentTitle.trim().length > 0
    ? uniqueWorkouts.filter((w) =>
        w.title.toLowerCase().includes(editingComponentTitle.toLowerCase())
      ).slice(0, 10)
    : uniqueWorkouts.slice(0, 10); // Show first 10 when empty

  const handleSelectSuggestion = (workout: { title: string; description: string }) => {
    setEditingComponentTitle(workout.title);
    setEditingComponentDescription(workout.description);
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
              <div className="ml-auto flex items-center gap-2">
                <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                  Owner
                </span>
                <button
                  onClick={() => setShowDeleteGymModal(true)}
                  className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-medium"
                >
                  Delete Gym
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: "members", label: "Members", count: members.length },
            { id: "coaches", label: "Coaches", count: coaches.length },
            { id: "groups", label: "Groups", count: groups.length, badge: isCoach && groupRequests.length > 0 ? groupRequests.length : undefined },
            ...(isCoach ? [{ id: "programming", label: "Programming", count: scheduledWorkouts.length }] : []),
            ...(isOwner ? [{ id: "requests", label: "Requests", count: requests.length }] : []),
            ...(isOwner ? [{ id: "pricing", label: "Pricing", count: pricingTiers.filter(t => t.isActive).length }] : []),
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
              {"badge" in tab && tab.badge && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-yellow-400 text-yellow-900">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {activeTab === "members" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                {isOwner && members.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Check-ins
                  </span>
                )}
              </div>
              {members.length === 0 ? (
                <p className="text-gray-500">No members yet</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => {
                    const plan = memberPlans[member.id];
                    const checkIns = plan?.checkInsThisMonth || 0;
                    const limit = plan?.monthlyLimit;
                    const isUnlimited = limit === null;
                    const remaining = isUnlimited ? null : Math.max(0, (limit || 0) - checkIns);
                    const isOverLimit = !isUnlimited && remaining === 0 && checkIns > 0;

                    return (
                      <div key={member.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
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

                        {/* Membership Info - Only visible to owner */}
                        {isOwner && plan && (
                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Plan</span>
                                <p className="font-medium text-gray-900">{plan.planName}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Check-ins</span>
                                <p className={`font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
                                  {isUnlimited ? (
                                    <span>{checkIns} / <span className="text-green-600">Unlimited</span></span>
                                  ) : (
                                    <span>
                                      {checkIns} / {limit}
                                      {remaining !== null && remaining > 0 && (
                                        <span className="text-gray-500 text-sm ml-1">({remaining} left)</span>
                                      )}
                                      {isOverLimit && (
                                        <span className="text-red-500 text-sm ml-1">(limit reached)</span>
                                      )}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                              isUnlimited
                                ? 'bg-green-100 text-green-700'
                                : isOverLimit
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isUnlimited ? 'Unlimited' : isOverLimit ? 'At Limit' : `${remaining} remaining`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
              {/* Pending Group Requests Section (for coaches/owners) */}
              {isCoach && groupRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Pending Group Access Requests</h3>
                  <div className="space-y-2">
                    {groupRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div>
                          <p className="font-medium text-gray-900">{request.userName}</p>
                          <p className="text-gray-500 text-sm">
                            Requesting access to <span className="font-medium">{request.groupName}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveGroupRequest(request)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDenyGroupRequest(request)}
                            className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg transition-colors ${isCoach ? "hover:bg-gray-100 cursor-pointer" : ""}`}
                      onClick={() => isCoach && router.push(`/gym/${gymId}/groups/${group.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGroupMember(group) ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
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
                            {isGroupMember(group) && (
                              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Member</span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm">
                            {group.memberIds?.length || 0} members
                            {group.defaultTimeSlots?.length > 0 && ` • ${group.defaultTimeSlots.length} class times`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Request Access button for non-members */}
                        {!isCoach && !isGroupMember(group) && group.name !== "Members" && (
                          hasRequestedGroup(group.id) ? (
                            <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg">
                              Pending
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestGroupAccess(group);
                              }}
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                            >
                              Request Access
                            </button>
                          )
                        )}
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
                        {isCoach && (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
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
                <div className="flex gap-2">
                  {scheduledWorkouts.length > 0 && (
                    <button
                      onClick={() => handleBackfillTimeSlots(true)}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-sm flex items-center gap-1"
                      title="Force refresh all time slots from group defaults"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Slots
                    </button>
                  )}
                  <button
                    onClick={handleSyncVisibilitySettings}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                    title="Update all workouts to match group visibility settings"
                  >
                    Sync Visibility
                  </button>
                  <button
                    onClick={() => setShowAddWorkoutModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + Schedule Workout
                  </button>
                </div>
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
                                    {/* Group badges */}
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      {workout.groupIds?.map((gId) => (
                                        <span key={gId} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                          {getGroupName(gId)}
                                        </span>
                                      ))}
                                    </div>
                                    {/* Show components if available */}
                                    {workout.components && workout.components.length > 0 ? (
                                      <div className="space-y-2">
                                        {workout.components.map((comp) => (
                                          <div key={comp.id} className="border-l-2 border-gray-200 pl-2">
                                            <div className="flex items-center gap-2">
                                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                                {workoutComponentLabels[comp.type] || comp.type}
                                              </span>
                                              <span className="font-medium text-gray-900 text-sm">{comp.title}</span>
                                            </div>
                                            {comp.description && (
                                              <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap line-clamp-2 ml-1">{comp.description}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <>
                                        {/* Legacy single workout display */}
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                            workout.workoutType === "lift"
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-orange-100 text-orange-700"
                                          }`}>
                                            {workout.workoutType === "lift" ? "Lift" : "WOD"}
                                          </span>
                                        </div>
                                        <h4 className="font-medium text-gray-900">{workout.wodTitle}</h4>
                                        {workout.wodDescription && (
                                          <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap line-clamp-2">{workout.wodDescription}</p>
                                        )}
                                      </>
                                    )}
                                    {/* Time Slots Display with Group Tags */}
                                    {workout.timeSlots && workout.timeSlots.length > 0 && (() => {
                                      // Build map of time -> groups for this workout
                                      const timeSlotGroupMap: Record<string, { groupIds: string[]; maxCapacity: number }> = {};

                                      workout.groupIds?.forEach((gId) => {
                                        const group = groups.find(g => g.id === gId);
                                        group?.defaultTimeSlots?.forEach((slot: any) => {
                                          const timeKey = `${slot.hour}:${slot.minute}`;
                                          if (!timeSlotGroupMap[timeKey]) {
                                            timeSlotGroupMap[timeKey] = { groupIds: [], maxCapacity: 0 };
                                          }
                                          if (!timeSlotGroupMap[timeKey].groupIds.includes(gId)) {
                                            timeSlotGroupMap[timeKey].groupIds.push(gId);
                                          }
                                          timeSlotGroupMap[timeKey].maxCapacity = Math.max(
                                            timeSlotGroupMap[timeKey].maxCapacity,
                                            slot.capacity || 20
                                          );
                                        });
                                      });

                                      // Process and deduplicate time slots
                                      const seenTimes = new Set<string>();
                                      const processedSlots = workout.timeSlots
                                        .filter((slot: any) => slot && slot.hour !== undefined)
                                        .map((slot: any) => {
                                          const timeKey = `${slot.hour}:${slot.minute}`;
                                          return {
                                            ...slot,
                                            groupIds: timeSlotGroupMap[timeKey]?.groupIds || [],
                                            displayCapacity: timeSlotGroupMap[timeKey]?.maxCapacity || slot.capacity || 20
                                          };
                                        })
                                        .filter((slot: any) => {
                                          const timeKey = `${slot.hour}:${slot.minute}`;
                                          if (seenTimes.has(timeKey)) return false;
                                          seenTimes.add(timeKey);
                                          return true;
                                        })
                                        .sort((a: any, b: any) => (a.hour ?? 0) * 60 + (a.minute ?? 0) - ((b.hour ?? 0) * 60 + (b.minute ?? 0)));

                                      if (processedSlots.length === 0) return null;

                                      // Helper to get user name from ID
                                      const getUserName = (userId: string) => {
                                        // First check the user cache
                                        if (userCache[userId]) return userCache[userId];
                                        // Fallback to members/coaches
                                        const member = members.find(m => m.id === userId);
                                        const coach = coaches.find(c => c.id === userId);
                                        return member?.firstName || coach?.firstName || 'Unknown User';
                                      };

                                      return (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <div className="space-y-1">
                                            {processedSlots.map((slot: any, idx: number) => {
                                              const signups = slot.signups || slot.signedUpUserIds || [];
                                              const signupCount = signups.length;
                                              const signupNames = signups.map((id: string) => getUserName(id));

                                              return (
                                                <div key={slot.id || idx} className="flex items-center gap-1 flex-wrap">
                                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">
                                                    {formatTimeSlot(slot.hour, slot.minute)}
                                                  </span>
                                                  {/* Signup count bubble with hover tooltip */}
                                                  <div className="relative group/signup">
                                                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full cursor-default ${
                                                      signupCount > 0
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                      {signupCount} signed up
                                                    </span>
                                                    {signupCount > 0 && (
                                                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover/signup:block z-50">
                                                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                                          {signupNames.join(', ')}
                                                        </div>
                                                        <div className="absolute top-full left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                                      </div>
                                                    )}
                                                  </div>
                                                  {slot.groupIds.map((gId: string) => {
                                                    const group = groups.find(g => g.id === gId);
                                                    return (
                                                      <span key={gId} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded">
                                                        {group?.name || 'Unknown'}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleEditWorkout(workout)}
                                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                      title="Edit workout"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWorkout(workout)}
                                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                      title="Delete workout"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
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

          {activeTab === "pricing" && isOwner && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Pricing Plans</h2>
                  <p className="text-sm text-gray-500 mt-1">Set up membership pricing for your gym (mockup)</p>
                </div>
                <button
                  onClick={() => {
                    setEditingTier(null);
                    setNewTierName("");
                    setNewTierMonthlyPrice("");
                    setNewTierYearlyPrice("");
                    setNewTierOneTimePrice("");
                    setNewTierClassLimitType("unlimited");
                    setNewTierClassesPerMonth("");
                    setNewTierTotalClasses("");
                    setNewTierDescription("");
                    setNewTierFeatures("");
                    setNewTierIsHidden(false);
                    setNewTierSignupCode("");
                    setShowAddPricingModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  + Add Plan
                </button>
              </div>

              {/* Mockup Banner */}
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-600 text-xl">⚠️</span>
                  <div>
                    <p className="font-medium text-yellow-800">Mockup Mode</p>
                    <p className="text-sm text-yellow-700">This is a preview of pricing features. Payment processing is not yet connected. Changes are for demonstration only.</p>
                  </div>
                </div>
              </div>

              {/* Pricing Tiers */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`p-5 rounded-xl border-2 ${
                      tier.isActive ? "border-blue-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                        <div className="flex gap-1 mt-1">
                          {!tier.isActive && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                          )}
                          {tier.isHidden && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Hidden</span>
                          )}
                          {tier.signupCode && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Code: {tier.signupCode}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingTier(tier);
                            setNewTierName(tier.name);
                            setNewTierMonthlyPrice(tier.monthlyPrice?.toString() || "");
                            setNewTierYearlyPrice(tier.yearlyPrice?.toString() || "");
                            setNewTierOneTimePrice(tier.oneTimePrice?.toString() || "");
                            setNewTierClassLimitType(tier.classLimitType);
                            setNewTierClassesPerMonth(tier.classesPerMonth?.toString() || "");
                            setNewTierTotalClasses(tier.totalClasses?.toString() || "");
                            setNewTierDescription(tier.description || "");
                            setNewTierFeatures(tier.features?.join("\n") || "");
                            setNewTierIsHidden(tier.isHidden || false);
                            setNewTierSignupCode(tier.signupCode || "");
                            setShowAddPricingModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            setPricingTiers(prev => prev.map(t =>
                              t.id === tier.id ? { ...t, isActive: !t.isActive } : t
                            ));
                          }}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title={tier.isActive ? "Deactivate" : "Activate"}
                        >
                          {tier.isActive ? "🚫" : "✅"}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${tier.name}" pricing plan?`)) {
                              setPricingTiers(prev => prev.filter(t => t.id !== tier.id));
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Pricing Display */}
                    <div className="mb-3 space-y-1">
                      {tier.monthlyPrice && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-gray-900">${tier.monthlyPrice}</span>
                          <span className="text-gray-500 text-sm">/month</span>
                        </div>
                      )}
                      {tier.yearlyPrice && (
                        <div className="flex items-baseline gap-1">
                          <span className={`${tier.monthlyPrice ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>${tier.yearlyPrice}</span>
                          <span className="text-gray-500 text-sm">/year</span>
                          {tier.monthlyPrice && (
                            <span className="text-green-600 text-xs ml-1">
                              (save ${(tier.monthlyPrice * 12) - tier.yearlyPrice})
                            </span>
                          )}
                        </div>
                      )}
                      {tier.oneTimePrice && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-gray-900">${tier.oneTimePrice}</span>
                          <span className="text-gray-500 text-sm">one-time</span>
                        </div>
                      )}
                    </div>

                    {/* Class Limit Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        tier.classLimitType === "unlimited"
                          ? "bg-green-100 text-green-700"
                          : tier.classLimitType === "per-month"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                      }`}>
                        {tier.classLimitType === "unlimited" && "Unlimited Classes"}
                        {tier.classLimitType === "per-month" && `${tier.classesPerMonth} classes/month`}
                        {tier.classLimitType === "fixed" && `${tier.totalClasses} class${(tier.totalClasses || 0) > 1 ? 'es' : ''} total`}
                      </span>
                    </div>

                    {tier.description && (
                      <p className="text-sm text-gray-600 mb-3">{tier.description}</p>
                    )}

                    {tier.features && tier.features.length > 0 && (
                      <ul className="space-y-1.5">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="text-green-500">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Mockup stats */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        {Math.floor(Math.random() * 20 + 5)} active subscribers (mockup)
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {pricingTiers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-3">💳</p>
                  <p className="font-medium">No pricing plans yet</p>
                  <p className="text-sm">Create your first plan to start accepting payments</p>
                </div>
              )}

              {/* Discount Codes Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Discount Codes</h3>
                    <p className="text-sm text-gray-500">Create promo codes for member discounts</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingDiscount(null);
                      setNewDiscountCode("");
                      setNewDiscountType("percentage");
                      setNewDiscountValue("");
                      setNewDiscountDescription("");
                      setShowAddDiscountModal(true);
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    + Add Code
                  </button>
                </div>

                {discountCodes.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {discountCodes.map((discount) => (
                      <div key={discount.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            discount.isActive ? "bg-green-100" : "bg-gray-100"
                          }`}>
                            <span className={discount.isActive ? "text-green-600" : "text-gray-400"}>🏷️</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-medium text-gray-900">{discount.code}</p>
                              {!discount.isActive && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {discount.discountType === "percentage"
                                ? `${discount.discountValue}% off`
                                : `$${discount.discountValue} off`}
                              {discount.description && ` • ${discount.description}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{discount.usageCount} uses</span>
                          <button
                            onClick={() => {
                              setEditingDiscount(discount);
                              setNewDiscountCode(discount.code);
                              setNewDiscountType(discount.discountType);
                              setNewDiscountValue(discount.discountValue.toString());
                              setNewDiscountDescription(discount.description || "");
                              setShowAddDiscountModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              setDiscountCodes(prev => prev.map(d =>
                                d.id === discount.id ? { ...d, isActive: !d.isActive } : d
                              ));
                            }}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title={discount.isActive ? "Deactivate" : "Activate"}
                          >
                            {discount.isActive ? "🚫" : "✅"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete discount code "${discount.code}"?`)) {
                                setDiscountCodes(prev => prev.filter(d => d.id !== discount.id));
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
                    <p className="text-3xl mb-2">🏷️</p>
                    <p className="text-sm">No discount codes yet</p>
                  </div>
                )}
              </div>

              {/* Group Pricing Section */}
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-4">Group Add-on Pricing</h3>
                <p className="text-sm text-gray-500 mb-4">Set additional monthly fees for specific groups (e.g., Competition Team, Personal Training)</p>

                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {groups.map((group) => (
                    <div key={group.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          group.requiresPayment ? "bg-green-100" : "bg-gray-100"
                        }`}>
                          <span className={group.requiresPayment ? "text-green-600" : "text-gray-400"}>
                            {group.requiresPayment ? "💰" : "👥"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{group.name}</p>
                          <p className="text-xs text-gray-500">{group.memberIds?.length || 0} members</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {group.requiresPayment ? (
                          <span className="text-green-600 font-semibold">+${group.additionalFee || 0}/mo</span>
                        ) : (
                          <span className="text-gray-400 text-sm">No fee</span>
                        )}
                        <button
                          onClick={async () => {
                            const newRequiresPayment = !group.requiresPayment;
                            const newFee = newRequiresPayment && !group.additionalFee ? 50 : (group.additionalFee || 0);

                            // Update local state
                            setGroups(prev => prev.map(g =>
                              g.id === group.id
                                ? { ...g, requiresPayment: newRequiresPayment, additionalFee: newFee }
                                : g
                            ));

                            // Update Firestore
                            try {
                              await updateDoc(doc(db, "groups", group.id), {
                                requiresPayment: newRequiresPayment,
                                additionalFee: newFee,
                              });
                            } catch (err) {
                              console.error("Error updating group pricing:", err);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            group.requiresPayment
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {group.requiresPayment ? "Enabled" : "Enable"}
                        </button>

                        {group.requiresPayment && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400">$</span>
                            <input
                              type="number"
                              value={group.additionalFee || 0}
                              onChange={async (e) => {
                                const newFee = Math.max(0, parseFloat(e.target.value) || 0);

                                // Update local state
                                setGroups(prev => prev.map(g =>
                                  g.id === group.id ? { ...g, additionalFee: newFee } : g
                                ));

                                // Update Firestore
                                try {
                                  await updateDoc(doc(db, "groups", group.id), {
                                    additionalFee: newFee,
                                  });
                                } catch (err) {
                                  console.error("Error updating group fee:", err);
                                }
                              }}
                              min="0"
                              step="5"
                              className="w-16 text-right text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {groups.length === 0 && (
                    <div className="p-6 text-center text-gray-500">
                      <p>No groups yet. Create groups in the Groups tab first.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Summary Mockup */}
              <div className="mt-8 p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-4">Revenue Summary (Mockup)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-green-600">$4,500</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active Members</p>
                    <p className="text-2xl font-bold text-blue-600">32</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg. per Member</p>
                    <p className="text-2xl font-bold text-purple-600">$140</p>
                  </div>
                </div>
              </div>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* Edit Series Choice Modal */}
      {showEditSeriesModal && pendingEditWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Edit Recurring Workout</h2>
            <p className="text-gray-600 text-sm mb-6">
              This workout is part of a recurring series. Would you like to edit just this occurrence or all workouts in the series?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => startEditingWorkout(pendingEditWorkout, false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors text-left"
              >
                <div className="font-semibold">This workout only</div>
                <div className="text-sm text-gray-500">Edit only the selected date</div>
              </button>
              <button
                onClick={() => startEditingWorkout(pendingEditWorkout, true)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-left"
              >
                <div className="font-semibold">All workouts in series</div>
                <div className="text-sm text-blue-100">Edit all occurrences at once</div>
              </button>
              <button
                onClick={() => {
                  setShowEditSeriesModal(false);
                  setPendingEditWorkout(null);
                }}
                className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Series Choice Modal */}
      {showDeleteSeriesModal && pendingDeleteWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Recurring Workout</h2>
            <p className="text-gray-600 text-sm mb-6">
              This workout is part of a recurring series. Would you like to delete just this occurrence or all workouts in the series?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => confirmDeleteWorkout(pendingDeleteWorkout, false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors text-left"
              >
                <div className="font-semibold">This workout only</div>
                <div className="text-sm text-gray-500">Delete only the selected date</div>
              </button>
              <button
                onClick={() => confirmDeleteWorkout(pendingDeleteWorkout, true)}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-left"
              >
                <div className="font-semibold">All workouts in series</div>
                <div className="text-sm text-red-100">Delete all occurrences</div>
              </button>
              <button
                onClick={() => {
                  setShowDeleteSeriesModal(false);
                  setPendingDeleteWorkout(null);
                }}
                className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingWorkoutId
                ? (editingSeriesId ? "Edit Workout Series" : "Edit Workout")
                : "Schedule Workout"}
            </h2>
            {editingSeriesId && (
              <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg mb-4">
                Changes will apply to all workouts in this series
              </p>
            )}
            <div className="space-y-4">
              {/* Date - hide when editing series since dates remain unchanged */}
              {!editingSeriesId && (
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
              )}

              {/* Groups */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Groups *
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
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
              </div>

              {/* Workout Components Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workout Components</p>
                  <span className="text-xs text-gray-400">
                    {workoutComponents.length} added • {uniqueWorkouts.length} suggestions available
                  </span>
                </div>

                {/* Add Component Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["warmup", "wod", "lift", "skill", "cooldown"] as WorkoutComponentType[]).map((type) => {
                    const hasType = workoutComponents.some(c => c.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addComponent(type)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          hasType
                            ? `${workoutComponentColors[type].bg} ${workoutComponentColors[type].text}`
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <span>+</span>
                        {workoutComponentLabels[type]}
                      </button>
                    );
                  })}
                </div>

                {/* Added Components List */}
                {workoutComponents.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    Add workout components above
                  </p>
                ) : (
                  <div className="space-y-3">
                    {workoutComponents.map((comp) => (
                      <div key={comp.id} className={`border-l-4 ${workoutComponentColors[comp.type].bg.replace("100", "300")} bg-gray-50 rounded-r-lg p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type].bg} ${workoutComponentColors[comp.type].text}`}>
                            {workoutComponentLabels[comp.type]}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeComponent(comp.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Always show editable fields */}
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              value={comp.title}
                              onChange={(e) => updateComponent(comp.id, "title", e.target.value)}
                              onFocus={() => setActiveComponentId(comp.id)}
                              onBlur={() => setTimeout(() => setActiveComponentId(null), 200)}
                              placeholder="Title (e.g., Fran, Back Squat)"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                              autoComplete="off"
                            />
                            {activeComponentId === comp.id && comp.title && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {uniqueWorkouts.filter(w => w.title.toLowerCase().includes(comp.title.toLowerCase())).slice(0, 10).length > 0 ? (
                                  uniqueWorkouts.filter(w => w.title.toLowerCase().includes(comp.title.toLowerCase())).slice(0, 10).map((workout, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        updateComponent(comp.id, "title", workout.title);
                                        updateComponent(comp.id, "description", workout.description || "");
                                        setActiveComponentId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                                    >
                                      <span className="font-medium text-gray-900">{workout.title}</span>
                                      {workout.description && (
                                        <p className="text-gray-500 text-xs truncate">{workout.description}</p>
                                      )}
                                    </button>
                                  ))
                                ) : (
                                  <p className="px-3 py-2 text-gray-500 text-sm">
                                    No matches found
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <textarea
                            value={comp.description}
                            onChange={(e) => updateComponent(comp.id, "description", e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Slots Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Class Times</p>
                    <p className="text-xs text-gray-400">Time slots are loaded from group defaults</p>
                  </div>
                  {workoutTimeSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWorkoutTimeSlots([])}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Add Time Slot Form */}
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Time</label>
                    <div className="flex gap-1">
                      <select
                        value={newSlotHour}
                        onChange={(e) => setNewSlotHour(parseInt(e.target.value))}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newSlotMinute}
                        onChange={(e) => setNewSlotMinute(parseInt(e.target.value))}
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      >
                        <option value={0}>:00</option>
                        <option value={15}>:15</option>
                        <option value={30}>:30</option>
                        <option value={45}>:45</option>
                      </select>
                    </div>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">Capacity</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newSlotCapacity}
                      onChange={(e) => setNewSlotCapacity(parseInt(e.target.value) || 20)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newSlot: ScheduledTimeSlot = {
                        id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        hour: newSlotHour,
                        minute: newSlotMinute,
                        capacity: newSlotCapacity,
                        signups: [],
                      };
                      setWorkoutTimeSlots([...workoutTimeSlots, newSlot].sort((a, b) =>
                        a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
                      ));
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>

                {/* Time Slots List */}
                {workoutTimeSlots.length > 0 && (
                  <div className="space-y-2">
                    {workoutTimeSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium text-gray-900">{formatTimeSlot(slot.hour, slot.minute)}</span>
                          <span className="text-sm text-gray-500">({slot.capacity} spots)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWorkoutTimeSlots(workoutTimeSlots.filter((s) => s.id !== slot.id))}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurrence Section - only show when creating new workout */}
              {!editingWorkoutId && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Recurrence</p>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repeat
                    </label>
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as typeof recurrenceType)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {recurrenceType === "weekly" && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repeat on
                      </label>
                      <div className="flex gap-1">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (repeatDays.includes(index)) {
                                if (repeatDays.length > 1) {
                                  setRepeatDays(repeatDays.filter((d) => d !== index));
                                }
                              } else {
                                setRepeatDays([...repeatDays, index].sort());
                              }
                            }}
                            className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                              repeatDays.includes(index)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {day.charAt(0)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recurrenceType !== "none" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Set end date</label>
                        <button
                          type="button"
                          onClick={() => setHasEndDate(!hasEndDate)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            hasEndDate ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            hasEndDate ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                      {hasEndDate && (
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={newWorkoutDate}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                        />
                      )}
                      <p className="text-sm text-gray-500">
                        {recurrenceType === "daily" && "Repeats every day"}
                        {recurrenceType === "weekly" && `Repeats on ${repeatDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`}
                        {recurrenceType === "monthly" && "Repeats monthly"}
                        {hasEndDate && endDate && ` until ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={resetWorkoutModal}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingWorkoutId ? handleUpdateWorkout : handleCreateWorkout}
                disabled={workoutComponents.length === 0 || (!editingSeriesId && !newWorkoutDate) || newWorkoutGroupIds.length === 0}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {editingSeriesId ? "Update Series" : (editingWorkoutId ? "Save Changes" : "Schedule")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Gym Confirmation Modal */}
      {showDeleteGymModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Gym</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{gym?.name}</span>? This will permanently remove:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                All groups and their settings
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                All scheduled workouts
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                All membership requests
              </li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteGymModal(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGym}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Gym
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Pricing Plan Modal */}
      {showAddPricingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingTier ? "Edit Pricing Plan" : "Add Pricing Plan"}
            </h2>

            <div className="space-y-5">
              {/* Plan Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  placeholder="e.g., Monthly Unlimited"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Billing Options */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Billing Options (set prices for available billing cycles)
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-600">Monthly:</div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-gray-500">$</span>
                      <input
                        type="number"
                        value={newTierMonthlyPrice}
                        onChange={(e) => setNewTierMonthlyPrice(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-500 text-sm">/mo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-600">Yearly:</div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-gray-500">$</span>
                      <input
                        type="number"
                        value={newTierYearlyPrice}
                        onChange={(e) => setNewTierYearlyPrice(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-500 text-sm">/yr</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-600">One-time:</div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-gray-500">$</span>
                      <input
                        type="number"
                        value={newTierOneTimePrice}
                        onChange={(e) => setNewTierOneTimePrice(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Leave blank for billing options you don&apos;t want to offer</p>
              </div>

              {/* Class Limit */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Class Limit
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTierClassLimitType("unlimited")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        newTierClassLimitType === "unlimited"
                          ? "bg-green-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTierClassLimitType("per-month")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        newTierClassLimitType === "per-month"
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      # Per Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTierClassLimitType("fixed")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        newTierClassLimitType === "fixed"
                          ? "bg-purple-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Fixed Total
                    </button>
                  </div>

                  {newTierClassLimitType === "per-month" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newTierClassesPerMonth}
                        onChange={(e) => setNewTierClassesPerMonth(e.target.value)}
                        placeholder="8"
                        min="1"
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-600 text-sm">classes per month</span>
                    </div>
                  )}

                  {newTierClassLimitType === "fixed" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newTierTotalClasses}
                        onChange={(e) => setNewTierTotalClasses(e.target.value)}
                        placeholder="10"
                        min="1"
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-600 text-sm">classes total (one-time pack)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newTierDescription}
                  onChange={(e) => setNewTierDescription(e.target.value)}
                  placeholder="Brief description of this plan"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features (one per line)
                </label>
                <textarea
                  value={newTierFeatures}
                  onChange={(e) => setNewTierFeatures(e.target.value)}
                  placeholder="Unlimited classes&#10;Open gym access&#10;Free parking"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Hidden Plan & Signup Code */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Hidden Plan
                    </label>
                    <p className="text-xs text-gray-500">Hidden plans won&apos;t appear on the public signup page</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewTierIsHidden(!newTierIsHidden)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      newTierIsHidden ? "bg-purple-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newTierIsHidden ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Signup Code
                  </label>
                  <input
                    type="text"
                    value={newTierSignupCode}
                    onChange={(e) => setNewTierSignupCode(e.target.value.toUpperCase())}
                    placeholder="e.g., VIP2024"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">Members can enter this code to access hidden plans</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddPricingModal(false);
                  setEditingTier(null);
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newTierName.trim()) return;
                  const hasPrice = newTierMonthlyPrice || newTierYearlyPrice || newTierOneTimePrice;
                  if (!hasPrice) return;

                  const tierData: PricingTier = {
                    id: editingTier?.id || `tier_${Date.now()}`,
                    name: newTierName.trim(),
                    monthlyPrice: newTierMonthlyPrice ? parseFloat(newTierMonthlyPrice) : undefined,
                    yearlyPrice: newTierYearlyPrice ? parseFloat(newTierYearlyPrice) : undefined,
                    oneTimePrice: newTierOneTimePrice ? parseFloat(newTierOneTimePrice) : undefined,
                    classLimitType: newTierClassLimitType,
                    classesPerMonth: newTierClassLimitType === "per-month" && newTierClassesPerMonth ? parseInt(newTierClassesPerMonth) : undefined,
                    totalClasses: newTierClassLimitType === "fixed" && newTierTotalClasses ? parseInt(newTierTotalClasses) : undefined,
                    description: newTierDescription.trim() || undefined,
                    features: newTierFeatures.split("\n").map(f => f.trim()).filter(Boolean),
                    isActive: editingTier?.isActive ?? true,
                    isHidden: newTierIsHidden || undefined,
                    signupCode: newTierSignupCode.trim() || undefined,
                  };

                  if (editingTier) {
                    setPricingTiers(prev => prev.map(t => t.id === editingTier.id ? tierData : t));
                  } else {
                    setPricingTiers(prev => [...prev, tierData]);
                  }

                  setShowAddPricingModal(false);
                  setEditingTier(null);
                }}
                disabled={!newTierName.trim() || (!newTierMonthlyPrice && !newTierYearlyPrice && !newTierOneTimePrice)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {editingTier ? "Save Changes" : "Add Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Discount Code Modal */}
      {showAddDiscountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingDiscount ? "Edit Discount Code" : "Add Discount Code"}
            </h2>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={newDiscountCode}
                  onChange={(e) => setNewDiscountCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SUMMER20"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 uppercase focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDiscountType("percentage")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      newDiscountType === "percentage"
                        ? "bg-green-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDiscountType("fixed")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      newDiscountType === "fixed"
                        ? "bg-green-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Fixed Amount ($)
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {newDiscountType === "percentage" ? "Percentage Off *" : "Amount Off *"}
                </label>
                <div className="flex items-center gap-2">
                  {newDiscountType === "fixed" && <span className="text-gray-500">$</span>}
                  <input
                    type="number"
                    value={newDiscountValue}
                    onChange={(e) => setNewDiscountValue(e.target.value)}
                    placeholder={newDiscountType === "percentage" ? "20" : "10"}
                    min="0"
                    max={newDiscountType === "percentage" ? "100" : undefined}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {newDiscountType === "percentage" && <span className="text-gray-500">%</span>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newDiscountDescription}
                  onChange={(e) => setNewDiscountDescription(e.target.value)}
                  placeholder="e.g., Summer sale discount"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddDiscountModal(false);
                  setEditingDiscount(null);
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newDiscountCode.trim() || !newDiscountValue) return;

                  const discountData: DiscountCode = {
                    id: editingDiscount?.id || `disc_${Date.now()}`,
                    code: newDiscountCode.trim().toUpperCase(),
                    discountType: newDiscountType,
                    discountValue: parseFloat(newDiscountValue),
                    description: newDiscountDescription.trim() || undefined,
                    isActive: editingDiscount?.isActive ?? true,
                    usageCount: editingDiscount?.usageCount ?? 0,
                  };

                  if (editingDiscount) {
                    setDiscountCodes(prev => prev.map(d => d.id === editingDiscount.id ? discountData : d));
                  } else {
                    setDiscountCodes(prev => [...prev, discountData]);
                  }

                  setShowAddDiscountModal(false);
                  setEditingDiscount(null);
                }}
                disabled={!newDiscountCode.trim() || !newDiscountValue}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors"
              >
                {editingDiscount ? "Save Changes" : "Add Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
