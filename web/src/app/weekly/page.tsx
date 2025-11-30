"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs, Timestamp, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { ScheduledWorkout, ScheduledTimeSlot, workoutComponentLabels, workoutComponentColors, formatTimeSlot } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface WorkoutGroup {
  id: string;
  name: string;
}

export default function WeeklyPlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [calendarRange, setCalendarRange] = useState<"thisWeek" | "nextWeek" | "2weeks" | "month">("thisWeek");
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [groups, setGroups] = useState<Record<string, WorkoutGroup>>({});
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [userGymIds, setUserGymIds] = useState<string[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchUserGroups();
    }
  }, [user]);

  useEffect(() => {
    if (user && groupsLoaded) {
      fetchWorkouts();
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
        groupsMap[doc.id] = { id: doc.id, name: data.name };

        // Include group if:
        // 1. User is directly in the group's memberIds, coachIds, or is owner
        // 2. OR the group belongs to a gym the user is a member of
        const isDirectMember = data.memberIds?.includes(user.id);
        const isDirectCoach = data.coachIds?.includes(user.id);
        const isGroupOwner = data.ownerId === user.id;
        const isFromUserGym = userGymIds.includes(data.gymId);

        if (isDirectMember || isDirectCoach || isGroupOwner || isFromUserGym) {
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

      // Filter to only show workouts for groups the user belongs to
      const filteredWorkouts = allWorkouts.filter((workout) => {
        // Check if workout belongs to a gym the user is a member of
        if (workout.gymId && userGymIds.includes(workout.gymId)) {
          return true;
        }

        // If workout has groupIds, check if any match the user's groups
        if (workout.groupIds && workout.groupIds.length > 0) {
          return workout.groupIds.some((gId) => userGroupIds.includes(gId));
        }

        return false;
      });

      setWorkouts(filteredWorkouts);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogWorkout = (workout: ScheduledWorkout) => {
    const isLift = workout.workoutType?.toLowerCase().includes("lift");
    if (isLift) {
      router.push(`/workouts/lift?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`);
    } else {
      router.push(`/workouts/new?name=${encodeURIComponent(workout.wodTitle)}&description=${encodeURIComponent(workout.wodDescription || "")}`);
    }
  };

  const handleSignup = async (workout: ScheduledWorkout, timeSlot: ScheduledTimeSlot) => {
    if (!user) return;

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

  const getAvailableSpots = (timeSlot: ScheduledTimeSlot) => {
    const signedUp = timeSlot.signups?.length || 0;
    const capacity = timeSlot.capacity || 20; // Default to 20 if not set
    return capacity - signedUp;
  };

  // Generate array of days for the selected range
  const getCalendarDays = () => {
    const days: Date[] = [];
    const current = new Date(rangeStart);
    while (current <= rangeEnd) {
      days.push(new Date(current));
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
          <h1 className="text-xl font-bold text-gray-900">My Weekly Workouts</h1>
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
          <span className="ml-2 text-gray-400">({workouts.length} workout{workouts.length !== 1 ? "s" : ""})</span>
        </div>

        {/* Calendar View */}
        {loadingData ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
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
                    {dayWorkouts.length > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                        {dayWorkouts.length} workout{dayWorkouts.length !== 1 ? "s" : ""}
                      </span>
                    )}
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
                                {workout.groupIds && workout.groupIds.length > 0 && (
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {workout.groupIds.map((gId) => (
                                      <span key={gId} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                        {getGroupName(gId)}
                                      </span>
                                    ))}
                                  </div>
                                )}

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

                                {/* Time Slots */}
                                {workout.timeSlots && workout.timeSlots.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Class Times</p>
                                    <div className="flex flex-wrap gap-2">
                                      {workout.timeSlots
                                        .filter((slot) => slot && slot.hour !== undefined && slot.minute !== undefined)
                                        .sort((a, b) => (a.hour ?? 0) * 60 + (a.minute ?? 0) - ((b.hour ?? 0) * 60 + (b.minute ?? 0)))
                                        .map((slot, index) => {
                                          const signedUp = isUserSignedUp(slot);
                                          const availableSpots = getAvailableSpots(slot);
                                          const isFull = (slot.capacity || 20) > 0 && availableSpots <= 0;

                                          return (
                                            <button
                                              key={slot.id || `slot-${index}-${slot.hour}-${slot.minute}`}
                                              onClick={() => signedUp ? handleCancelSignup(workout, slot) : handleSignup(workout, slot)}
                                              disabled={isFull && !signedUp}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                                signedUp
                                                  ? "bg-green-100 text-green-700 border border-green-300"
                                                  : isFull
                                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                  : "bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 border border-gray-200"
                                              }`}
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              {formatTimeSlot(slot.hour, slot.minute)}
                                              <span className={`text-xs ${signedUp ? "text-green-600" : isFull ? "text-red-400" : "text-gray-500"}`}>
                                                {signedUp ? "✓" : isFull ? "Full" : `${availableSpots} left`}
                                              </span>
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Log button */}
                              <button
                                onClick={() => handleLogWorkout(workout)}
                                className="ml-2 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Log
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
    </div>
  );
}
