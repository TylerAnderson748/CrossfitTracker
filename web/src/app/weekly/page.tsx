"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, Timestamp, limit, addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, ScheduledTimeSlot, workoutComponentLabels, workoutComponentColors, formatTimeSlot, LeaderboardEntry, formatResult, normalizeWorkoutName, WorkoutComponent, WorkoutComponentType, WODScoringType, wodScoringTypeLabels, wodScoringTypeColors, AITrainerSubscription } from "@/lib/types";
import { getAllWods, getAllLifts, Workout } from "@/lib/workoutData";
import Navigation from "@/components/Navigation";
import PersonalAITrainer from "@/components/PersonalAITrainer";

// Combined result type for both WODs and lifts
interface WorkoutResult {
  id: string;
  userName: string;
  createdAt?: Timestamp;
  category?: string;
  timeInSeconds?: number;
  resultType?: string;
  weight?: number;
  reps?: number;
  date?: Timestamp;
  isLift?: boolean;
}

interface WorkoutGroup {
  id: string;
  name: string;
  defaultTimeSlots?: { hour: number; minute: number }[];
  signupCutoffMinutes?: number;
}

interface PersonalWorkout {
  id: string;
  userId: string;
  date: Timestamp;
  dateString?: string; // YYYY-MM-DD for reliable date comparison
  components: WorkoutComponent[];
  notes?: string;
  createdAt: Timestamp;
}

export default function WeeklyPlanPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [calendarRange, setCalendarRange] = useState<"next7days" | "thisWeek" | "nextWeek" | "2weeks" | "month">("next7days");
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [groups, setGroups] = useState<Record<string, WorkoutGroup>>({});
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [userGymIds, setUserGymIds] = useState<string[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [userCache, setUserCache] = useState<Record<string, string>>({});
  const [workoutLogs, setWorkoutLogs] = useState<{ [key: string]: WorkoutResult[] }>({});

  // Personal workouts state
  const [personalWorkouts, setPersonalWorkouts] = useState<PersonalWorkout[]>([]);
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState(false);
  const [newWorkoutDate, setNewWorkoutDate] = useState("");
  const [workoutComponents, setWorkoutComponents] = useState<WorkoutComponent[]>([]);
  const [editingPersonalWorkoutId, setEditingPersonalWorkoutId] = useState<string | null>(null);

  // Get all workouts for suggestions
  const allWods = getAllWods();
  const allLifts = getAllLifts();
  const uniqueWorkouts = [...allWods, ...allLifts];

  // Helper to format time ago
  const timeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Component management functions
  const addComponent = (type: WorkoutComponentType) => {
    const newComponent: WorkoutComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: "",
      description: "",
      ...(type === "wod" && { scoringType: "fortime" as WODScoringType }),
    };
    setWorkoutComponents([...workoutComponents, newComponent]);
  };

  const removeComponent = (id: string) => {
    setWorkoutComponents(workoutComponents.filter((c) => c.id !== id));
  };

  const updateComponent = (id: string, field: "title" | "description" | "scoringType" | "isPreset", value: string | boolean) => {
    setWorkoutComponents(prev =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  // Filter suggestions based on search text
  const getFilteredSuggestions = (searchText: string) => {
    if (!searchText) return uniqueWorkouts.slice(0, 10);
    return uniqueWorkouts.filter((w) =>
      w.name.toLowerCase().includes(searchText.toLowerCase())
    ).slice(0, 10);
  };

  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);

  // Reset form for new workout
  const resetWorkoutForm = () => {
    setWorkoutComponents([]);
    setNewWorkoutDate("");
    setActiveComponentId(null);
    setEditingPersonalWorkoutId(null);
  };

  // Helper to format date as YYYY-MM-DD in local time
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Open modal for adding new workout
  const openAddWorkoutModal = (dateStr?: string) => {
    resetWorkoutForm();
    if (dateStr) {
      setNewWorkoutDate(dateStr);
    } else {
      // Default to today
      setNewWorkoutDate(formatDateLocal(new Date()));
    }
    setShowAddWorkoutModal(true);
  };

  // Open modal for editing existing workout
  const openEditWorkoutModal = (workout: PersonalWorkout) => {
    setEditingPersonalWorkoutId(workout.id);
    setWorkoutComponents([...workout.components]);
    const workoutDate = workout.date.toDate();
    setNewWorkoutDate(formatDateLocal(workoutDate));
    setShowAddWorkoutModal(true);
  };

  // Save personal workout
  const handleSavePersonalWorkout = async () => {
    if (!user || !newWorkoutDate || workoutComponents.length === 0) return;

    // Validate all components have titles
    const hasEmptyTitle = workoutComponents.some((c) => !c.title.trim());
    if (hasEmptyTitle) {
      alert("Please add a title to all workout components");
      return;
    }

    try {
      // Parse date as local time (not UTC) to avoid timezone issues
      const [year, month, day] = newWorkoutDate.split('-').map(Number);
      const workoutDate = new Date(year, month - 1, day, 12, 0, 0, 0);

      if (editingPersonalWorkoutId) {
        // Update existing workout
        const workoutRef = doc(db, "personalWorkouts", editingPersonalWorkoutId);
        await updateDoc(workoutRef, {
          date: Timestamp.fromDate(workoutDate),
          dateString: newWorkoutDate, // Store exact date string for reliable comparison
          components: workoutComponents,
        });
      } else {
        // Create new workout
        await addDoc(collection(db, "personalWorkouts"), {
          userId: user.id,
          date: Timestamp.fromDate(workoutDate),
          dateString: newWorkoutDate, // Store exact date string for reliable comparison
          components: workoutComponents,
          createdAt: Timestamp.now(),
        });
      }

      setShowAddWorkoutModal(false);
      resetWorkoutForm();
      fetchPersonalWorkouts();
    } catch (error) {
      console.error("Error saving personal workout:", error);
    }
  };

  // Delete personal workout
  const handleDeletePersonalWorkout = async (workoutId: string) => {
    if (!confirm("Are you sure you want to delete this workout?")) return;

    try {
      await deleteDoc(doc(db, "personalWorkouts", workoutId));
      fetchPersonalWorkouts();
    } catch (error) {
      console.error("Error deleting personal workout:", error);
    }
  };

  // Fetch personal workouts
  const fetchPersonalWorkouts = async () => {
    if (!user) return;

    try {
      const { rangeStart, rangeEnd } = getDateRange();
      // Simple query by userId only to avoid composite index requirement
      const personalQuery = query(
        collection(db, "personalWorkouts"),
        where("userId", "==", user.id)
      );
      const snapshot = await getDocs(personalQuery);
      const allWorkouts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PersonalWorkout[];

      // Filter by date range client-side
      const filteredWorkouts = allWorkouts.filter((w) => {
        const workoutDate = w.date?.toDate?.();
        if (!workoutDate) return false;
        return workoutDate >= rangeStart && workoutDate <= rangeEnd;
      }).sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      setPersonalWorkouts(filteredWorkouts);
    } catch (error) {
      console.error("Error fetching personal workouts:", error);
    }
  };

  // Get personal workouts for a specific date
  const getPersonalWorkoutsForDate = (date: Date) => {
    const targetDateString = formatDateLocal(date);

    return personalWorkouts.filter((w) => {
      // Use dateString if available (new format), fall back to timestamp comparison
      if (w.dateString) {
        return w.dateString === targetDateString;
      }
      // Legacy fallback for old data without dateString
      const workoutDate = w.date?.toDate?.();
      if (!workoutDate) return false;
      return formatDateLocal(workoutDate) === targetDateString;
    });
  };

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchUserGroups();
    }
  }, [user]);

  useEffect(() => {
    if (user && groupsLoaded) {
      fetchWorkouts();
      fetchPersonalWorkouts();
    }
  }, [user, calendarRange, groupsLoaded, userGroupIds, userGymIds]);

  const fetchUserGroups = async () => {
    if (!user) return;
    try {
      // First, find all gyms where user is a member, coach, or owner
      const gymsQuery = query(collection(db, "gyms"));
      const gymsSnapshot = await getDocs(gymsQuery);
      const userGymIds: string[] = [];

      gymsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const isMember = data.memberIds?.includes(user.id);
        const isCoach = data.coachIds?.includes(user.id);
        const isOwner = data.ownerId === user.id;

        if (isMember || isCoach || isOwner) {
          userGymIds.push(doc.id);
        }
      });

      // Then get all groups from those gyms
      const groupsQuery = query(collection(db, "groups"));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsMap: Record<string, WorkoutGroup> = {};
      const memberGroupIds: string[] = [];

      groupsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        groupsMap[doc.id] = {
          id: doc.id,
          name: data.name,
          defaultTimeSlots: data.defaultTimeSlots || [],
          signupCutoffMinutes: data.signupCutoffMinutes ?? 0,
        };

        // Only include group if user is directly in memberIds or coachIds
        const isDirectMember = data.memberIds?.includes(user.id);
        const isDirectCoach = data.coachIds?.includes(user.id);

        if (isDirectMember || isDirectCoach) {
          memberGroupIds.push(doc.id);
        }
      });

      setGroups(groupsMap);
      setUserGroupIds(memberGroupIds);
      setUserGymIds(userGymIds);
      setGroupsLoaded(true);
    } catch (error) {
      console.error("Error fetching groups:", error);
      setGroupsLoaded(true);
    }
  };

  // Calculate date range based on selection
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of this week (Monday)
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    let rangeStart = new Date(startOfWeek);
    let rangeEnd = new Date(startOfWeek);

    switch (calendarRange) {
      case "next7days":
        rangeStart = new Date(today);
        rangeEnd = new Date(today);
        rangeEnd.setDate(today.getDate() + 6);
        break;
      case "thisWeek":
        rangeEnd.setDate(startOfWeek.getDate() + 6);
        break;
      case "nextWeek":
        rangeStart.setDate(startOfWeek.getDate() + 7);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 6);
        break;
      case "2weeks":
        rangeEnd.setDate(startOfWeek.getDate() + 13);
        break;
      case "month":
        rangeEnd.setDate(startOfWeek.getDate() + 29);
        break;
    }

    rangeEnd.setHours(23, 59, 59, 999);
    return { rangeStart, rangeEnd };
  };

  const { rangeStart, rangeEnd } = getDateRange();

  const fetchWorkouts = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const { rangeStart, rangeEnd } = getDateRange();

      const workoutsQuery = query(
        collection(db, "scheduledWorkouts"),
        where("date", ">=", Timestamp.fromDate(rangeStart)),
        where("date", "<=", Timestamp.fromDate(rangeEnd)),
        orderBy("date", "asc")
      );
      const snapshot = await getDocs(workoutsQuery);
      const allWorkouts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledWorkout[];

      // Filter to only show workouts for groups the user is a member of
      const filteredWorkouts = allWorkouts.filter((workout) => {
        // Only show workouts if user is in at least one of the workout's groups
        if (workout.groupIds && workout.groupIds.length > 0) {
          return workout.groupIds.some((gId) => userGroupIds.includes(gId));
        }
        return false;
      });

      // For workouts with empty/missing time slots, generate them from groups' default time slots
      const workoutsWithTimeSlots = filteredWorkouts.map((workout) => {
        // If workout already has time slots, keep them
        if (workout.timeSlots && workout.timeSlots.length > 0) {
          return workout;
        }

        // Generate time slots from the workout's groups' default time slots
        const timeSlots: ScheduledTimeSlot[] = [];
        const seenTimes = new Set<string>();

        workout.groupIds?.forEach((groupId) => {
          const group = groups[groupId];
          if (group && group.defaultTimeSlots && group.defaultTimeSlots.length > 0) {
            group.defaultTimeSlots.forEach((slot: { hour: number; minute: number; capacity?: number }) => {
              const hour = typeof slot.hour === 'number' ? slot.hour : parseInt(slot.hour as unknown as string) || 0;
              const minute = typeof slot.minute === 'number' ? slot.minute : parseInt(slot.minute as unknown as string) || 0;
              const timeKey = `${hour}:${minute}`;
              if (!seenTimes.has(timeKey)) {
                seenTimes.add(timeKey);
                timeSlots.push({
                  id: `slot_gen_${groupId}_${hour}_${minute}`,
                  hour,
                  minute,
                  capacity: slot.capacity || 20,
                  signups: [],
                });
              }
            });
          }
        });

        // Sort time slots by time
        timeSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

        return { ...workout, timeSlots };
      });

      setWorkouts(workoutsWithTimeSlots);

      // Fetch user names for all signed up users
      const allSignupUserIds = new Set<string>();
      workoutsWithTimeSlots.forEach((workout) => {
        workout.timeSlots?.forEach((slot: ScheduledTimeSlot) => {
          const signups = slot.signups || [];
          signups.forEach((userId: string) => allSignupUserIds.add(userId));
        });
      });

      if (allSignupUserIds.size > 0) {
        const userIds = Array.from(allSignupUserIds);
        const userCacheMap: Record<string, string> = {};
        for (let i = 0; i < userIds.length; i += 10) {
          const batch = userIds.slice(i, i + 10);
          // Read from userProfiles (public) instead of users (private)
          const usersQuery = query(collection(db, "userProfiles"), where("__name__", "in", batch));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.docs.forEach((doc) => {
            const userData = doc.data();
            userCacheMap[doc.id] = userData.displayName || userData.firstName || 'Unknown User';
          });
        }
        setUserCache(userCacheMap);
      }

      // Fetch recent results for each workout
      const logsMap: { [key: string]: WorkoutResult[] } = {};
      for (const workout of filteredWorkouts) {
        // Skip personal workouts (from scan) that don't have wodTitle
        if (!workout.wodTitle) {
          logsMap[workout.id] = [];
          continue;
        }

        const isLift = workout.workoutType?.toLowerCase().includes("lift");

        if (isLift) {
          const liftQuery = query(
            collection(db, "liftResults"),
            where("liftTitle", "==", workout.wodTitle),
            limit(5)
          );
          const liftSnapshot = await getDocs(liftQuery);
          const liftResults = liftSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isLift: true,
          })) as WorkoutResult[];
          liftResults.sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(0);
            const dateB = b.date?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          logsMap[workout.id] = liftResults.slice(0, 3);
        } else {
          const normalized = normalizeWorkoutName(workout.wodTitle);
          const logsQuery = query(
            collection(db, "leaderboardEntries"),
            where("normalizedWorkoutName", "==", normalized),
            limit(10)
          );
          const logsSnapshot = await getDocs(logsQuery);
          const logs = logsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            isLift: false,
          })) as WorkoutResult[];
          logs.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          logsMap[workout.id] = logs.slice(0, 3);
        }
      }
      setWorkoutLogs(logsMap);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Check if signup is past cutoff for a workout/timeslot
  const isSignupPastCutoff = (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot): boolean => {
    // Get the max cutoff from all groups this workout belongs to
    const groupIds = workout.groupIds || [];
    let maxCutoff = 0;
    for (const groupId of groupIds) {
      const group = groups[groupId];
      if (group?.signupCutoffMinutes && group.signupCutoffMinutes > maxCutoff) {
        maxCutoff = group.signupCutoffMinutes;
      }
    }

    if (maxCutoff === 0) return false; // No cutoff set

    // Calculate the time slot datetime
    const workoutDate = workout.date.toDate();
    const slotTime = new Date(workoutDate);
    slotTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);

    // Calculate cutoff time
    const cutoffTime = new Date(slotTime.getTime() - maxCutoff * 60 * 1000);
    const now = new Date();

    return now >= cutoffTime;
  };

  // Check if workout details should be revealed based on hideDetails and revealDate
  const shouldShowDetails = (workout: ScheduledWorkout): boolean => {
    if (!workout.hideDetails) return true;
    if (!workout.revealDate) return false;
    const now = new Date();
    const revealTime = workout.revealDate.toDate();
    return now >= revealTime;
  };

  const handleSignup = async (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot) => {
    if (!user) return;

    // Check cutoff
    if (isSignupPastCutoff(workout, timeSlot)) {
      alert("Signup for this time slot has closed.");
      return;
    }

    try {
      const workoutRef = doc(db, "scheduledWorkouts", workout.id);
      const updatedTimeSlots = workout.timeSlots?.map((slot) => {
        if (slot.id === timeSlot.id) {
          return { ...slot, signups: [...(slot.signups || []), user.id] };
        }
        return slot;
      });

      await updateDoc(workoutRef, { timeSlots: updatedTimeSlots });

      // Update local state
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id ? { ...w, timeSlots: updatedTimeSlots } : w
        )
      );
    } catch (error) {
      console.error("Error signing up for time slot:", error);
    }
  };

  const handleCancelSignup = async (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot) => {
    if (!user) return;

    try {
      const workoutRef = doc(db, "scheduledWorkouts", workout.id);
      const updatedTimeSlots = workout.timeSlots?.map((slot) => {
        if (slot.id === timeSlot.id) {
          return { ...slot, signups: (slot.signups || []).filter((id) => id !== user.id) };
        }
        return slot;
      });

      await updateDoc(workoutRef, { timeSlots: updatedTimeSlots });

      // Update local state
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id ? { ...w, timeSlots: updatedTimeSlots } : w
        )
      );
    } catch (error) {
      console.error("Error canceling signup:", error);
    }
  };

  const isUserSignedUp = (timeSlot: ScheduledTimeSlot) => {
    return user && timeSlot.signups?.includes(user.id);
  };

  // Generate array of days for the selected range
  const getCalendarDays = () => {
    const days: { date: Date; dateString: string }[] = [];
    const current = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 12, 0, 0, 0);
    const endDate = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 12, 0, 0, 0);
    while (current <= endDate) {
      // Generate date string directly from components to avoid any timezone issues
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: new Date(current),
        dateString: dateString
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const calendarDays = getCalendarDays();

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter((w) => {
      const workoutDate = w.date?.toDate?.();
      return workoutDate?.toDateString() === date.toDateString();
    });
  };

  const getGroupName = (groupId: string) => {
    return groups[groupId]?.name || "Unknown";
  };

  const formatDayHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayLabel: string;
    if (date.toDateString() === today.toDateString()) {
      dayLabel = "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = "Tomorrow";
    } else {
      dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
    }

    const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { day: dayLabel, date: dateLabel };
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">My Workouts</h1>
          <button
            onClick={() => openAddWorkoutModal()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Workout
          </button>
        </div>

        {/* AI Personal Trainer Section - Only show for subscribers */}
        {user && user.aiTrainerSubscription &&
         (user.aiTrainerSubscription.status === "active" || user.aiTrainerSubscription.status === "trialing") && (
          <div className="mb-4">
            <PersonalAITrainer
              userId={user.id}
              gymId={user.gymId}
              userPreferences={user.aiCoachPreferences}
              viewerRole={user.role}
              todayWorkout={workouts.find(w => {
                const workoutDate = w.date instanceof Timestamp ? w.date.toDate() : new Date(w.date);
                return workoutDate.toDateString() === new Date().toDateString();
              }) || null}
              todayPersonalWorkouts={getPersonalWorkoutsForDate(new Date())}
            />
          </div>
        )}

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { id: "next7days", label: "Next 7 Days" },
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
          <span className="ml-2 text-gray-400">({workouts.length} workout{workouts.length !== 1 ? "s" : ""})</span>
        </div>

        {/* Calendar View */}
        {loadingData ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {calendarDays.map((dayObj) => {
              const dayWorkouts = getWorkoutsForDate(dayObj.date);
              const dayPersonalWorkouts = getPersonalWorkoutsForDate(dayObj.date);
              const { day: dayLabel, date: dateLabel } = formatDayHeader(dayObj.date);
              const isToday = dayObj.date.toDateString() === new Date().toDateString();
              const totalWorkouts = dayWorkouts.length + dayPersonalWorkouts.length;

              return (
                <div
                  key={dayObj.dateString}
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
                      {totalWorkouts > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                          {totalWorkouts} workout{totalWorkouts !== 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        onClick={() => openAddWorkoutModal(dayObj.dateString)}
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                          isToday
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-200 text-gray-600 hover:bg-blue-600 hover:text-white"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Workouts for this day */}
                  <div className="p-2">
                    {totalWorkouts === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-2">No workouts scheduled</p>
                    ) : (
                      <div className="space-y-2">
                        {dayWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            {/* Header row: Group badges + action buttons */}
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              {/* Group badges - only show groups user is a member of */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {workout.groupIds && workout.groupIds.length > 0 && (
                                  <>
                                    {workout.groupIds
                                      .filter((gId) => userGroupIds.includes(gId))
                                      .map((gId) => (
                                        <span key={gId} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                          {getGroupName(gId)}
                                        </span>
                                      ))}
                                  </>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 flex-wrap">
                                {/* Individual log buttons for each component type */}
                                {(() => {
                                  const wodComponent = workout.components?.find(c => c.type === "wod");
                                  const liftComponent = workout.components?.find(c => c.type === "lift");
                                  const skillComponent = workout.components?.find(c => c.type === "skill");
                                  const buttons = [];

                                  // WOD Log button
                                  if (wodComponent) {
                                    const scoringType = wodComponent.scoringType || "fortime";
                                    buttons.push(
                                      <Link
                                        key="wod-log"
                                        href={`/workouts/new?name=${encodeURIComponent(wodComponent.title)}&description=${encodeURIComponent(wodComponent.description || "")}&scoringType=${scoringType}`}
                                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        title={`Log WOD: ${wodComponent.title}`}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        WOD
                                      </Link>
                                    );
                                  }

                                  // Lift Log button
                                  if (liftComponent) {
                                    buttons.push(
                                      <Link
                                        key="lift-log"
                                        href={`/workouts/lift?name=${encodeURIComponent(liftComponent.title)}&description=${encodeURIComponent(liftComponent.description || "")}`}
                                        className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        title={`Log Lift: ${liftComponent.title}`}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Lift
                                      </Link>
                                    );
                                  }

                                  // Skill Log button
                                  if (skillComponent) {
                                    buttons.push(
                                      <Link
                                        key="skill-log"
                                        href={`/workouts/skill?name=${encodeURIComponent(skillComponent.title)}&description=${encodeURIComponent(skillComponent.description || "")}`}
                                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                        title={`Log Skill: ${skillComponent.title}`}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Skill
                                      </Link>
                                    );
                                  }

                                  // Fallback: single Log button if no specific components found
                                  if (buttons.length === 0) {
                                    buttons.push(
                                      <Link
                                        key="general-log"
                                        href={`/workouts/new?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}&scoringType=fortime`}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Log
                                      </Link>
                                    );
                                  }

                                  return buttons;
                                })()}
                                <Link
                                  href={`/leaderboard?workout=${encodeURIComponent(workout.wodTitle)}`}
                                  className="px-2 py-1 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                  title="Leaderboard"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </Link>
                              </div>
                            </div>

                            {/* Full width workout content */}
                            <div>

                                {/* Show workout content - check visibility first */}
                                {shouldShowDetails(workout) ? (
                                  // Show full workout details
                                  workout.components && workout.components.length > 0 ? (
                                    <div className="space-y-3">
                                      {workout.components.map((comp) => (
                                        <div key={comp.id} className="border-l-2 border-gray-200 pl-2">
                                          <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                              {workoutComponentLabels[comp.type] || comp.type}
                                            </span>
                                            <span className="font-medium text-gray-900 text-sm">{comp.title}</span>
                                          </div>
                                          {comp.description && (
                                            <p className="text-gray-700 text-xs whitespace-pre-wrap mt-1 ml-1">{comp.description}</p>
                                          )}
                                          {comp.notes && (
                                            <div className="mt-2 ml-1 p-2 bg-amber-50 rounded border-l-2 border-amber-300">
                                              <p className="text-amber-800 text-xs whitespace-pre-line">{comp.notes}</p>
                                            </div>
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
                                  )
                                ) : (
                                  // Details are hidden
                                  <div className="py-2">
                                    <p className="text-gray-400 italic text-sm">Workout details will be revealed soon...</p>
                                  </div>
                                )}

                                {/* Time Slots - only show slots that match user's groups' default times */}
                                {workout.timeSlots && workout.timeSlots.length > 0 && (() => {
                                  // Build a map of time -> { groups, maxCapacity }
                                  const userGroupsForWorkout = workout.groupIds?.filter((gId) => userGroupIds.includes(gId)) || [];
                                  const timeSlotMap: Record<string, { groupIds: string[]; maxCapacity: number }> = {};

                                  userGroupsForWorkout.forEach((gId) => {
                                    const group = groups[gId];
                                    group?.defaultTimeSlots?.forEach((slot: { hour: number; minute: number; capacity?: number }) => {
                                      const timeKey = `${slot.hour}:${slot.minute}`;
                                      if (!timeSlotMap[timeKey]) {
                                        timeSlotMap[timeKey] = { groupIds: [], maxCapacity: 0 };
                                      }
                                      timeSlotMap[timeKey].groupIds.push(gId);
                                      timeSlotMap[timeKey].maxCapacity = Math.max(timeSlotMap[timeKey].maxCapacity, slot.capacity || 20);
                                    });
                                  });

                                  // Process workout time slots and match to groups
                                  const processedSlots = workout.timeSlots
                                    .filter((slot) => slot != null)
                                    .map((slot: ScheduledTimeSlot) => {
                                      let hour = slot.hour;
                                      let minute = slot.minute;
                                      const timeKey = `${hour}:${minute}`;
                                      const matchedGroups = timeSlotMap[timeKey];
                                      return {
                                        ...slot,
                                        hour,
                                        minute,
                                        signups: slot.signups || [],
                                        groupIds: matchedGroups?.groupIds || [],
                                        displayCapacity: matchedGroups?.maxCapacity || slot.capacity || 20
                                      };
                                    })
                                    .filter((slot) => slot.groupIds.length > 0);

                                  // Deduplicate by time (keep first occurrence, already has combined group info)
                                  const seenTimes = new Set<string>();
                                  const filteredSlots = processedSlots
                                    .filter((slot) => {
                                      const timeKey = `${slot.hour}:${slot.minute}`;
                                      if (seenTimes.has(timeKey)) return false;
                                      seenTimes.add(timeKey);
                                      return true;
                                    })
                                    .sort((a, b) => (a.hour ?? 0) * 60 + (a.minute ?? 0) - ((b.hour ?? 0) * 60 + (b.minute ?? 0)));

                                  if (filteredSlots.length === 0) return null;

                                  return (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Class Times</p>
                                    <div className="space-y-2">
                                      {filteredSlots.map((slot, index) => {
                                          const signedUp = isUserSignedUp(slot);
                                          const signedUpCount = slot.signups?.length || 0;
                                          const availableSpots = slot.displayCapacity - signedUpCount;
                                          const isFull = slot.displayCapacity > 0 && availableSpots <= 0;
                                          const isPastCutoff = isSignupPastCutoff(workout, slot);
                                          const signupNames = slot.signups?.map((id: string) => userCache[id] || 'Unknown User') || [];

                                          return (
                                            <div key={slot.id || `slot-${index}-${slot.hour}-${slot.minute}`} className="flex items-center gap-2">
                                              <button
                                                onClick={() => signedUp ? handleCancelSignup(workout, slot) : handleSignup(workout, slot)}
                                                disabled={(isFull || isPastCutoff) && !signedUp}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                                  signedUp
                                                    ? "bg-green-100 text-green-700 border border-green-300"
                                                    : isPastCutoff
                                                    ? "bg-orange-50 text-orange-400 cursor-not-allowed border border-orange-200"
                                                    : isFull
                                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    : "bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 border border-gray-200"
                                                }`}
                                              >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {formatTimeSlot(slot.hour, slot.minute)}
                                                <span className={`text-xs ${signedUp ? "text-green-600" : isPastCutoff ? "text-orange-500" : isFull ? "text-red-400" : "text-gray-500"}`}>
                                                  {signedUp ? "✓" : isPastCutoff ? "Closed" : isFull ? "Full" : `${availableSpots} left`}
                                                </span>
                                              </button>
                                              {/* Signup count with hover tooltip */}
                                              {signedUpCount > 0 && (
                                                <div className="relative group/signup">
                                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full cursor-default">
                                                    {signedUpCount} signed up
                                                  </span>
                                                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover/signup:block z-50">
                                                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                                      {signupNames.join(', ')}
                                                    </div>
                                                    <div className="absolute top-full left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                                  </div>
                                                </div>
                                              )}
                                              {/* Group tags for this time slot */}
                                              <div className="flex gap-1 flex-wrap">
                                                {slot.groupIds.map((gId: string) => (
                                                  <span key={gId} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded">
                                                    {getGroupName(gId)}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                  );
                                })()}
                            </div>

                            {/* Recent Results */}
                            {workoutLogs[workout.id] && workoutLogs[workout.id].length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs font-medium text-gray-500 mb-2">Recent Results</p>
                                <div className="space-y-1.5">
                                  {workoutLogs[workout.id].map((log) => (
                                    <div key={log.id} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                                          log.isLift ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                        }`}>
                                          {log.userName?.charAt(0) || "?"}
                                        </div>
                                        <span className="text-gray-700">{log.userName}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {log.isLift ? (
                                          <>
                                            <span className="font-mono font-semibold text-gray-900">{log.weight} lbs</span>
                                            <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px]">
                                              {log.reps}r
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="font-mono font-semibold text-gray-900">{formatResult(log as LeaderboardEntry)}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                              log.category === "RX" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                                            }`}>
                                              {log.category}
                                            </span>
                                          </>
                                        )}
                                        <span className="text-gray-400">
                                          {timeAgo((log.isLift ? log.date : log.createdAt)?.toDate?.() || new Date())}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Personal Workouts */}
                        {dayPersonalWorkouts.map((personalWorkout) => (
                          <div
                            key={personalWorkout.id}
                            className="p-3 bg-green-50 rounded-lg border border-green-200"
                          >
                            {/* Header row: Personal badge + action buttons */}
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                Personal
                              </span>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1">
                                {/* Log button - find first WOD component */}
                                {(() => {
                                  const wodComponent = personalWorkout.components.find(c => c.type === "wod");
                                  const liftComponent = personalWorkout.components.find(c => c.type === "lift");
                                  if (wodComponent) {
                                    const scoringType = wodComponent.scoringType || "fortime";
                                    return (
                                      <Link
                                        href={`/workouts/new?name=${encodeURIComponent(wodComponent.title)}&description=${encodeURIComponent(wodComponent.description || "")}&scoringType=${scoringType}`}
                                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Log
                                      </Link>
                                    );
                                  } else if (liftComponent) {
                                    return (
                                      <Link
                                        href={`/workouts/lift?name=${encodeURIComponent(liftComponent.title)}&description=${encodeURIComponent(liftComponent.description || "")}`}
                                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Log
                                      </Link>
                                    );
                                  }
                                  return null;
                                })()}
                                <button
                                  onClick={() => openEditWorkoutModal(personalWorkout)}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeletePersonalWorkout(personalWorkout.id)}
                                  className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Full width workout content */}
                            <div className="space-y-2">
                              {personalWorkout.components.map((comp) => (
                                <div key={comp.id} className="border-l-2 border-gray-200 pl-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                      {workoutComponentLabels[comp.type] || comp.type}
                                    </span>
                                    <span className="font-medium text-gray-900 text-sm">{comp.title}</span>
                                  </div>
                                  {comp.description && (
                                    <p className="text-gray-700 text-xs whitespace-pre-wrap mt-1 ml-1">{comp.description}</p>
                                  )}
                                  {comp.notes && (
                                    <div className="mt-2 ml-1 p-2 bg-amber-50 rounded border-l-2 border-amber-300">
                                      <p className="text-amber-800 text-xs whitespace-pre-line">{comp.notes}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state when no workouts at all */}
            {workouts.length === 0 && !loadingData && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center mt-4">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-gray-500 mb-2">No workouts scheduled for this period</p>
                <p className="text-gray-400 text-sm">Check with your gym or coach for programming</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingPersonalWorkoutId ? "Edit Workout" : "Add Personal Workout"}
            </h2>

            <div className="space-y-4">
              {/* Date */}
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

              {/* Workout Components Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workout Components</p>
                  <span className="text-xs text-gray-400">
                    {workoutComponents.length} added
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
                          {/* Preset indicator and unlock button */}
                          {comp.isPreset && (
                            <div className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span className="text-xs font-medium text-blue-700">Preset Workout - Fields locked</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateComponent(comp.id, "isPreset", false)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Unlock
                              </button>
                            </div>
                          )}
                          <div className="relative">
                            <input
                              type="text"
                              value={comp.title}
                              onChange={(e) => {
                                if (!comp.isPreset) {
                                  updateComponent(comp.id, "title", e.target.value);
                                }
                              }}
                              onFocus={() => !comp.isPreset && setActiveComponentId(comp.id)}
                              onBlur={() => setTimeout(() => setActiveComponentId(null), 200)}
                              placeholder="Title (e.g., Fran, Back Squat)"
                              className={`w-full px-3 py-1.5 border rounded text-sm text-gray-900 ${
                                comp.isPreset
                                  ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                                  : "bg-white border-gray-300"
                              }`}
                              autoComplete="off"
                              readOnly={comp.isPreset}
                            />
                            {activeComponentId === comp.id && comp.title && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {getFilteredSuggestions(comp.title).length > 0 ? (
                                  getFilteredSuggestions(comp.title).map((workout, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        updateComponent(comp.id, "title", workout.name);
                                        updateComponent(comp.id, "description", workout.description || "");
                                        updateComponent(comp.id, "isPreset", true);
                                        if (workout.scoringType) {
                                          updateComponent(comp.id, "scoringType", workout.scoringType);
                                        }
                                        setActiveComponentId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{workout.name}</span>
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">Preset</span>
                                      </div>
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
                            onChange={(e) => {
                              if (!comp.isPreset) {
                                updateComponent(comp.id, "description", e.target.value);
                              }
                            }}
                            placeholder="Description (optional)"
                            rows={2}
                            className={`w-full px-3 py-1.5 border rounded text-sm text-gray-900 ${
                              comp.isPreset
                                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                                : "bg-white border-gray-300"
                            }`}
                            readOnly={comp.isPreset}
                          />

                          {/* Scoring Type selector for WOD components */}
                          {comp.type === "wod" && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500">Scoring:</span>
                              <div className={`flex rounded-lg overflow-hidden border ${comp.isPreset ? "border-gray-200 opacity-75" : "border-gray-200"}`}>
                                {(["fortime", "emom", "amrap"] as WODScoringType[]).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => !comp.isPreset && updateComponent(comp.id, "scoringType", type)}
                                    disabled={comp.isPreset}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                                      comp.scoringType === type || (!comp.scoringType && type === "fortime")
                                        ? `${wodScoringTypeColors[type].bg} ${wodScoringTypeColors[type].text}`
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                    } ${comp.isPreset ? "cursor-not-allowed" : ""}`}
                                  >
                                    {wodScoringTypeLabels[type]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWorkoutModal(false);
                    resetWorkoutForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePersonalWorkout}
                  disabled={!newWorkoutDate || workoutComponents.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingPersonalWorkoutId ? "Update Workout" : "Save Workout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
