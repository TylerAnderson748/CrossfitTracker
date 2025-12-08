"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import {
  WorkoutGroup,
  TimeSlot,
  GroupType,
  MembershipType,
  Gym,
  AppUser,
} from "@/lib/types";
import Navigation from "@/components/Navigation";

function formatTimeSlotDisplay(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hours12 = hour % 12 || 12;
  return `${hours12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function formatHourMinuteDisplay(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hours12 = hour % 12 || 12;
  return `${hours12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`.toUpperCase();
}

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string; groupId: string }>;
}) {
  const { id: gymId, groupId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<WorkoutGroup | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCoachOrOwner, setIsCoachOrOwner] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("custom");
  const [membershipType, setMembershipType] = useState<MembershipType>("invite-only");
  const [isPublic, setIsPublic] = useState(false);
  const [defaultTimeSlots, setDefaultTimeSlots] = useState<TimeSlot[]>([]);
  const [hideDetailsByDefault, setHideDetailsByDefault] = useState(false);
  const [defaultRevealDaysBefore, setDefaultRevealDaysBefore] = useState(1);
  const [defaultRevealHour, setDefaultRevealHour] = useState(16);
  const [defaultRevealMinute, setDefaultRevealMinute] = useState(0);
  const [signupCutoffMinutes, setSignupCutoffMinutes] = useState(0);

  // Pricing state (mockup)
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [additionalFee, setAdditionalFee] = useState(0);

  // Add time slot modal
  const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
  const [newSlotHour, setNewSlotHour] = useState(6);
  const [newSlotMinute, setNewSlotMinute] = useState(0);
  const [newSlotCapacity, setNewSlotCapacity] = useState(20);

  // Edit time slot state
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editSlotHour, setEditSlotHour] = useState(0);
  const [editSlotMinute, setEditSlotMinute] = useState(0);
  const [editSlotCapacity, setEditSlotCapacity] = useState(20);

  // Members state
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [gymMembers, setGymMembers] = useState<AppUser[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && gymId && groupId) {
      loadData();
    }
  }, [user, gymId, groupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all gym members by querying users with this gymId
      const gymMembersQuery = query(
        collection(db, "users"),
        where("gymId", "==", gymId)
      );
      const gymMembersSnapshot = await getDocs(gymMembersQuery);
      const allGymMembers = gymMembersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as AppUser))
        .filter(u => u.role === "athlete" || u.role === "member" || u.role === "owner");
      setGymMembers(allGymMembers);

      // Load gym
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
        setGym(gymData);
        setIsCoachOrOwner(
          gymData.ownerId === user?.id || gymData.coachIds?.includes(user?.id || "")
        );
      }

      // Load group
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const rawData = groupDoc.data();
        console.log("Raw group data from Firebase:", rawData);
        console.log("membershipType in database:", rawData.membershipType);

        const groupData = { id: groupDoc.id, ...rawData } as WorkoutGroup;
        setGroup(groupData);

        // Initialize form fields
        setName(groupData.name);
        setGroupType(groupData.type || "custom");
        setMembershipType(groupData.membershipType || "invite-only");
        setIsPublic(groupData.isPublic || false);
        setDefaultTimeSlots(groupData.defaultTimeSlots || []);
        setHideDetailsByDefault(groupData.hideDetailsByDefault || false);
        setDefaultRevealDaysBefore(groupData.defaultRevealDaysBefore ?? 1);
        setDefaultRevealHour(groupData.defaultRevealHour ?? 16);
        setDefaultRevealMinute(groupData.defaultRevealMinute ?? 0);
        setSignupCutoffMinutes(groupData.signupCutoffMinutes ?? 0);
        setRequiresPayment(groupData.requiresPayment ?? false);
        setAdditionalFee(groupData.additionalFee ?? 0);
        // For "auto-assign-all" groups, use all gym members automatically
        if (groupData.membershipType === "auto-assign-all") {
          setMemberIds(allGymMembers.map(m => m.id));
          setMembers(allGymMembers);
        } else {
          // For other groups, use the stored memberIds but validate against actual users
          setMemberIds(groupData.memberIds || []);
          if (groupData.memberIds && groupData.memberIds.length > 0) {
            // Filter gym members to only those in this group's memberIds
            const groupMembers = allGymMembers.filter(m => groupData.memberIds?.includes(m.id));
            setMembers(groupMembers);
          }
        }
      }
    } catch (err) {
      console.error("Error loading group:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!group || !isCoachOrOwner) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "groups", groupId), {
        name,
        type: groupType,
        membershipType,
        isPublic,
        defaultTimeSlots,
        hideDetailsByDefault,
        defaultRevealDaysBefore,
        defaultRevealHour,
        defaultRevealMinute,
        signupCutoffMinutes,
        requiresPayment,
        additionalFee,
        memberIds,
      });
      router.push(`/gym/${gymId}`);
    } catch (err) {
      console.error("Error saving group:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = (memberId: string) => {
    if (!memberIds.includes(memberId)) {
      const newMemberIds = [...memberIds, memberId];
      setMemberIds(newMemberIds);

      // Add to members display list
      const memberToAdd = gymMembers.find((m) => m.id === memberId);
      if (memberToAdd) {
        setMembers([...members, memberToAdd]);
      }
    }
    setShowAddMemberModal(false);
    setMemberSearchQuery("");
  };

  const handleRemoveMember = (memberId: string) => {
    setMemberIds(memberIds.filter((id) => id !== memberId));
    setMembers(members.filter((m) => m.id !== memberId));
  };

  // Filter gym members who aren't already in the group
  const availableMembers = gymMembers.filter(
    (m) => !memberIds.includes(m.id)
  ).filter((m) => {
    if (!memberSearchQuery) return true;
    const searchLower = memberSearchQuery.toLowerCase();
    const displayName = m.displayName || `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
    return displayName.toLowerCase().includes(searchLower) || m.email.toLowerCase().includes(searchLower);
  });

  const handleAddTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: generateId(),
      hour: newSlotHour,
      minute: newSlotMinute,
      capacity: newSlotCapacity,
    };
    // Sort by hour then minute
    const updated = [...defaultTimeSlots, newSlot].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });
    setDefaultTimeSlots(updated);
    setShowAddTimeSlot(false);
    setNewSlotHour(6);
    setNewSlotMinute(0);
    setNewSlotCapacity(20);
  };

  const handleDeleteTimeSlot = (id: string) => {
    setDefaultTimeSlots(defaultTimeSlots.filter((slot) => slot.id !== id));
  };

  const startEditTimeSlot = (slot: TimeSlot) => {
    setEditingSlotId(slot.id);
    setEditSlotHour(slot.hour);
    setEditSlotMinute(slot.minute);
    setEditSlotCapacity(slot.capacity);
  };

  const cancelEditTimeSlot = () => {
    setEditingSlotId(null);
  };

  const saveEditTimeSlot = () => {
    if (!editingSlotId) return;

    const updated = defaultTimeSlots.map((slot) => {
      if (slot.id === editingSlotId) {
        return {
          ...slot,
          hour: editSlotHour,
          minute: editSlotMinute,
          capacity: editSlotCapacity,
        };
      }
      return slot;
    }).sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });

    setDefaultTimeSlots(updated);
    setEditingSlotId(null);
  };

  // Convert hour/minute to time input value
  const revealTimeValue = `${defaultRevealHour.toString().padStart(2, "0")}:${defaultRevealMinute.toString().padStart(2, "0")}`;

  const handleRevealTimeChange = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    setDefaultRevealHour(hours);
    setDefaultRevealMinute(minutes);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-gray-500">Group not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/gym/${gymId}`)}
          className="flex items-center gap-1 text-blue-600 mb-4 hover:text-blue-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Groups</span>
        </button>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{name || "Group"}</h1>

        {/* Group Information Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Group Information
            </p>
          </div>

          {/* Name */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-gray-700">Name</span>
            {isCoachOrOwner ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-right text-gray-900 bg-transparent border-none focus:ring-0 p-0"
              />
            ) : (
              <span className="text-gray-900">{name}</span>
            )}
          </div>

          {/* Type */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-gray-700">Type</span>
            <span className="text-gray-900">
              {groupType === "default" ? "Default" : groupType === "custom" ? "Custom" : "Personal"}
            </span>
          </div>

          {/* Membership */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-gray-700">Membership</span>
            <span className="text-gray-900">
              {membershipType === "auto-assign-all" ? "Auto-assign All" : "Invite Only"}
            </span>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-700">Visibility</span>
            <span className="text-gray-900">
              {isPublic ? "Public" : "Private"}
            </span>
          </div>
        </div>

        {/* Default Class Times Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Default Class Times
            </p>
            {isCoachOrOwner && (
              <button
                onClick={() => setShowAddTimeSlot(true)}
                className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold"
              >
                +
              </button>
            )}
          </div>

          {defaultTimeSlots.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              No class times configured
            </div>
          ) : (
            defaultTimeSlots.map((slot) => (
              <div
                key={slot.id}
                className="border-b border-gray-100 last:border-b-0"
              >
                {editingSlotId === slot.id ? (
                  // Edit mode
                  <div className="px-4 py-3 space-y-3 bg-blue-50">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1 font-medium">Time</label>
                      <div className="flex gap-2">
                        <select
                          value={editSlotHour}
                          onChange={(e) => setEditSlotHour(parseInt(e.target.value))}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editSlotMinute}
                          onChange={(e) => setEditSlotMinute(parseInt(e.target.value))}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={0}>:00</option>
                          <option value={15}>:15</option>
                          <option value={30}>:30</option>
                          <option value={45}>:45</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1 font-medium">Capacity</label>
                      <input
                        type="number"
                        value={editSlotCapacity}
                        onChange={(e) => setEditSlotCapacity(parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditTimeSlot}
                        className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditTimeSlot}
                        className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div
                    className={`flex items-center justify-between px-4 py-3 ${isCoachOrOwner ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => isCoachOrOwner && startEditTimeSlot(slot)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-gray-900 font-medium">
                        {formatTimeSlotDisplay(slot.hour, slot.minute)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm">Cap: {slot.capacity}</span>
                      {isCoachOrOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTimeSlot(slot.id);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Members ({members.length})
            </p>
            {isCoachOrOwner && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold"
              >
                +
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              No members in this group
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                    {(member.displayName || member.firstName || member.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium">
                      {member.displayName || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email}
                    </p>
                    <p className="text-gray-500 text-xs">{member.email}</p>
                  </div>
                </div>
                {isCoachOrOwner && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Workout Visibility Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Workout Visibility
            </p>
          </div>

          {/* Hide details by default */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-gray-700">Hide details by default</span>
            <button
              onClick={() => isCoachOrOwner && setHideDetailsByDefault(!hideDetailsByDefault)}
              disabled={!isCoachOrOwner}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                hideDetailsByDefault ? "bg-green-500" : "bg-gray-300"
              } ${!isCoachOrOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  hideDetailsByDefault ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Reveal timing - only show if hiding is enabled */}
          {hideDetailsByDefault && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-gray-700">Reveal</span>
                {isCoachOrOwner ? (
                  <select
                    value={defaultRevealDaysBefore}
                    onChange={(e) => setDefaultRevealDaysBefore(parseInt(e.target.value))}
                    className="text-right text-gray-900 bg-transparent border-none focus:ring-0 p-0 pr-6 appearance-none cursor-pointer"
                  >
                    <option value={0}>Same day</option>
                    <option value={1}>Day before</option>
                    <option value={2}>2 days before</option>
                    <option value={7}>Week before</option>
                  </select>
                ) : (
                  <span className="text-gray-900">
                    {defaultRevealDaysBefore === 0 ? "Same day" :
                     defaultRevealDaysBefore === 1 ? "Day before" :
                     defaultRevealDaysBefore === 7 ? "Week before" :
                     `${defaultRevealDaysBefore} days before`}
                  </span>
                )}
              </div>

              {/* At time */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-700">At time</span>
                {isCoachOrOwner ? (
                  <input
                    type="time"
                    value={revealTimeValue}
                    onChange={(e) => handleRevealTimeChange(e.target.value)}
                    className="text-right text-gray-900 bg-transparent border-none focus:ring-0 p-0"
                  />
                ) : (
                  <span className="text-gray-900">
                    {formatHourMinuteDisplay(defaultRevealHour, defaultRevealMinute)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Signup Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Signup Settings
            </p>
          </div>

          {/* Signup cutoff time */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-gray-700">Signup cutoff</span>
              <p className="text-xs text-gray-500">How long before class can members sign up</p>
            </div>
            {isCoachOrOwner ? (
              <select
                value={signupCutoffMinutes}
                onChange={(e) => setSignupCutoffMinutes(parseInt(e.target.value))}
                className="text-right text-gray-900 bg-transparent border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-1.5 cursor-pointer"
              >
                <option value={0}>No cutoff</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
                <option value={180}>3 hours before</option>
                <option value={360}>6 hours before</option>
                <option value={720}>12 hours before</option>
                <option value={1440}>24 hours before</option>
              </select>
            ) : (
              <span className="text-gray-900">
                {signupCutoffMinutes === 0 ? "No cutoff" :
                 signupCutoffMinutes < 60 ? `${signupCutoffMinutes} minutes before` :
                 signupCutoffMinutes === 60 ? "1 hour before" :
                 signupCutoffMinutes < 1440 ? `${signupCutoffMinutes / 60} hours before` :
                 "24 hours before"}
              </span>
            )}
          </div>
        </div>

        {/* Pricing Section (Mockup) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold">Pricing</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Mockup</span>
            </div>
            <p className="text-xs text-green-600 mt-0.5">Set additional fees for this group membership</p>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Requires Payment Toggle */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-gray-700">Requires additional payment</span>
                <p className="text-xs text-gray-500">Charge an extra fee for this group</p>
              </div>
              {isCoachOrOwner ? (
                <button
                  onClick={() => setRequiresPayment(!requiresPayment)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    requiresPayment ? "bg-green-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      requiresPayment ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              ) : (
                <span className={`px-2 py-1 rounded text-sm ${requiresPayment ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {requiresPayment ? "Yes" : "No"}
                </span>
              )}
            </div>

            {/* Additional Fee */}
            {requiresPayment && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Additional monthly fee</span>
                  <p className="text-xs text-gray-500">Added to base membership cost</p>
                </div>
                {isCoachOrOwner ? (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={additionalFee}
                      onChange={(e) => setAdditionalFee(Math.max(0, parseFloat(e.target.value) || 0))}
                      min="0"
                      step="5"
                      className="w-20 text-right text-gray-900 bg-transparent border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 px-2 py-1.5"
                    />
                    <span className="text-gray-500 text-sm">/mo</span>
                  </div>
                ) : (
                  <span className="text-gray-900 font-medium">${additionalFee}/mo</span>
                )}
              </div>
            )}

            {/* Pricing Summary */}
            {requiresPayment && additionalFee > 0 && (
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-sm text-gray-600">
                  Members joining this group will be charged an additional <span className="font-semibold text-green-600">${additionalFee}/month</span> on top of their base membership.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        {isCoachOrOwner && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 hover:bg-blue-700 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}

        {/* Add Time Slot Modal */}
        {showAddTimeSlot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add Class Time</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">Time</label>
                  <div className="flex gap-2">
                    <select
                      value={newSlotHour}
                      onChange={(e) => setNewSlotHour(parseInt(e.target.value))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>:00</option>
                      <option value={15}>:15</option>
                      <option value={30}>:30</option>
                      <option value={45}>:45</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">Capacity</label>
                  <input
                    type="number"
                    value={newSlotCapacity}
                    onChange={(e) => setNewSlotCapacity(parseInt(e.target.value) || 20)}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddTimeSlot(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTimeSlot}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add Member</h3>
              </div>
              <div className="p-4 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {availableMembers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">
                    {memberSearchQuery ? "No matching members found" : "No available members to add"}
                  </div>
                ) : (
                  availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddMember(member.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                        {(member.displayName || member.firstName || member.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">
                          {member.displayName || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email}
                        </p>
                        <p className="text-gray-500 text-xs">{member.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setMemberSearchQuery("");
                  }}
                  className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
