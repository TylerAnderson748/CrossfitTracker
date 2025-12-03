"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, getDoc, orderBy, limit, deleteDoc, doc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WorkoutLog, formatResult } from "@/lib/types";
import Navigation from "@/components/Navigation";
import { WOD_CATEGORIES, LIFT_CATEGORIES, SKILL_CATEGORIES, WorkoutCategory, Workout, getAllWods, getAllLifts, getAllSkills } from "@/lib/workoutData";

interface FrequentWorkout {
  name: string;
  count: number;
  type: "wod" | "lift" | "skill";
  description: string;
}

interface CustomWorkout {
  name: string;
  description: string;
  type: "wod" | "lift" | "skill";
  scoringType?: string;
  count: number;
}

interface GymWorkout {
  name: string;
  description: string;
  type: "wod" | "lift" | "skill";
  scoringType?: string;
  scheduledDate?: Date;
}

interface ProgrammingSource {
  id: string;
  name: string;
  type: "gym" | "online" | "pt" | "other" | "group";
  createdAt: Date;
  isAutomatic?: boolean; // true for gym/group sources that are auto-added
  gymId?: string;
  groupId?: string;
}

interface ProgrammedWorkout {
  id: string;
  name: string;
  description: string;
  type: "wod" | "lift" | "skill";
  scoringType?: string;
  sourceId: string;
  sourceName: string;
  scheduledDate?: Date;
}

export default function WorkoutsPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [workoutType, setWorkoutType] = useState<"wod" | "lift" | "skill">("wod");
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [frequentWods, setFrequentWods] = useState<FrequentWorkout[]>([]);
  const [frequentLifts, setFrequentLifts] = useState<FrequentWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showLogDropdown, setShowLogDropdown] = useState(false);

  // Custom (user-created) workouts
  const [customWods, setCustomWods] = useState<CustomWorkout[]>([]);
  const [customLifts, setCustomLifts] = useState<CustomWorkout[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomWorkout[]>([]);

  // Gym programming workouts
  const [gymWorkouts, setGymWorkouts] = useState<GymWorkout[]>([]);

  // Delete confirmation state
  const [deletingWorkout, setDeletingWorkout] = useState<{ name: string; type: "wod" | "lift" | "skill" } | null>(null);

  // Programming sources state
  const [programmingSources, setProgrammingSources] = useState<ProgrammingSource[]>([]);
  const [programmedWorkouts, setProgrammedWorkouts] = useState<ProgrammedWorkout[]>([]);
  const [hiddenSourceIds, setHiddenSourceIds] = useState<string[]>([]);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"gym" | "online" | "pt" | "other">("online");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [showAddWorkoutModal, setShowAddWorkoutModal] = useState<string | null>(null);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [newWorkoutDescription, setNewWorkoutDescription] = useState("");
  const [newWorkoutType, setNewWorkoutType] = useState<"wod" | "lift" | "skill">("wod");
  const [newWorkoutScoringType, setNewWorkoutScoringType] = useState<"fortime" | "amrap" | "emom">("fortime");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      // Load hidden source IDs from localStorage
      const savedHidden = localStorage.getItem(`hiddenSources_${user.id}`);
      if (savedHidden) {
        setHiddenSourceIds(JSON.parse(savedHidden));
      }
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      const allWods = getAllWods();
      const allLifts = getAllLifts();
      const allSkills = getAllSkills();

      // Create sets of preset names for quick lookup
      const presetWodNames = new Set(allWods.map(w => w.name.toLowerCase()));
      const presetLiftNames = new Set(allLifts.map(l => l.name.toLowerCase()));
      const presetSkillNames = new Set(allSkills.map(s => s.name.toLowerCase()));

      // Fetch WOD logs
      const logsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id)
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];
      logs.sort((a, b) => {
        const dateA = a.completedDate?.toDate?.() || new Date(0);
        const dateB = b.completedDate?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setRecentLogs(logs.slice(0, 10));

      // Count WOD frequency and identify custom WODs
      const wodCounts: Record<string, { count: number; description: string; scoringType?: string }> = {};
      logs.forEach((log) => {
        if (log.wodTitle) {
          if (!wodCounts[log.wodTitle]) {
            // Infer scoring type from result type
            let scoringType: string | undefined;
            if (log.resultType === "time") scoringType = "fortime";
            else if (log.resultType === "rounds" || log.resultType === "reps") scoringType = "amrap";

            wodCounts[log.wodTitle] = {
              count: 0,
              description: log.wodDescription || "",
              scoringType,
            };
          }
          wodCounts[log.wodTitle].count++;
        }
      });

      // Separate preset WODs from custom WODs
      const frequentWodsList: FrequentWorkout[] = [];
      const customWodsList: CustomWorkout[] = [];

      Object.entries(wodCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .forEach(([name, data]) => {
          const isPreset = presetWodNames.has(name.toLowerCase());
          if (isPreset) {
            const wod = allWods.find((w) => w.name.toLowerCase() === name.toLowerCase());
            frequentWodsList.push({
              name,
              count: data.count,
              type: "wod",
              description: wod?.description || data.description,
            });
          } else {
            customWodsList.push({
              name,
              description: data.description,
              type: "wod",
              scoringType: data.scoringType,
              count: data.count,
            });
          }
        });

      setFrequentWods(frequentWodsList.slice(0, 6));
      setCustomWods(customWodsList);

      // Fetch lift results
      const liftsQuery = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id)
      );
      const liftsSnapshot = await getDocs(liftsQuery);

      // Count lift frequency and identify custom lifts
      const liftCounts: Record<string, number> = {};
      liftsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const liftName = data.liftTitle || data.liftName;
        if (liftName) {
          liftCounts[liftName] = (liftCounts[liftName] || 0) + 1;
        }
      });

      // Separate preset lifts from custom lifts
      const frequentLiftsList: FrequentWorkout[] = [];
      const customLiftsList: CustomWorkout[] = [];

      Object.entries(liftCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          const isPreset = presetLiftNames.has(name.toLowerCase());
          if (isPreset) {
            const lift = allLifts.find((l) => l.name.toLowerCase() === name.toLowerCase());
            frequentLiftsList.push({
              name,
              count,
              type: "lift",
              description: lift?.description || "",
            });
          } else {
            customLiftsList.push({
              name,
              description: `Logged ${count} times`,
              type: "lift",
              count,
            });
          }
        });

      setFrequentLifts(frequentLiftsList.slice(0, 6));
      setCustomLifts(customLiftsList);

      // Fetch skill results
      const skillsQuery = query(
        collection(db, "skillResults"),
        where("userId", "==", user.id)
      );
      const skillsSnapshot = await getDocs(skillsQuery);

      // Count skill frequency and identify custom skills
      const skillCounts: Record<string, number> = {};
      skillsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const skillName = data.skillTitle || data.skillName;
        if (skillName) {
          skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
        }
      });

      // Separate preset skills from custom skills
      const customSkillsList: CustomWorkout[] = [];

      Object.entries(skillCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          const isPreset = presetSkillNames.has(name.toLowerCase());
          if (!isPreset) {
            customSkillsList.push({
              name,
              description: `Logged ${count} times`,
              type: "skill",
              count,
            });
          }
        });

      setCustomSkills(customSkillsList);

      // Fetch user-created programming sources
      const sourcesQuery = query(
        collection(db, "programmingSources"),
        where("userId", "==", user.id)
      );
      const sourcesSnapshot = await getDocs(sourcesQuery);
      const userSourcesList: ProgrammingSource[] = sourcesSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        name: docSnap.data().name,
        type: docSnap.data().type,
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date(),
        isAutomatic: false,
      }));

      // Auto-add gym as programming source if user has one
      const automaticSources: ProgrammingSource[] = [];
      const automaticWorkouts: ProgrammedWorkout[] = [];

      console.log("User gymId:", user.gymId);

      if (user.gymId) {
        // Fetch gym info
        const gymDoc = await getDoc(doc(db, "gyms", user.gymId));
        console.log("Gym doc exists:", gymDoc.exists(), gymDoc.data());
        if (gymDoc.exists()) {
          const gymData = gymDoc.data();
          const gymSourceId = `gym-${user.gymId}`;
          const gymName = gymData.name || "My Gym";

          automaticSources.push({
            id: gymSourceId,
            name: gymName,
            type: "gym",
            createdAt: new Date(),
            isAutomatic: true,
            gymId: user.gymId,
          });

          // Fetch groups user is a member of
          const groupsQuery = query(
            collection(db, "groups"),
            where("gymId", "==", user.gymId)
          );
          const groupsSnapshot = await getDocs(groupsQuery);
          const userGroupIds: string[] = [];

          for (const groupDoc of groupsSnapshot.docs) {
            const groupData = groupDoc.data();
            const memberIds = groupData.memberIds || [];
            if (memberIds.includes(user.id)) {
              userGroupIds.push(groupDoc.id);
            }
          }
          console.log("User is member of groups:", userGroupIds);

          // Fetch all scheduled workouts for the gym
          const gymWorkoutsQuery = query(
            collection(db, "scheduledWorkouts"),
            where("gymId", "==", user.gymId)
          );
          const gymWorkoutsSnapshot = await getDocs(gymWorkoutsQuery);
          console.log("Gym scheduled workouts found:", gymWorkoutsSnapshot.docs.length);

          // Add workouts that either have no groupId or belong to a group the user is in
          gymWorkoutsSnapshot.docs.forEach((workoutDoc) => {
            const data = workoutDoc.data();
            const workoutGroupId = data.groupId;
            const workoutGroupIds = data.groupIds || []; // Some workouts may use groupIds array

            // Check if user has access to this workout
            const hasNoGroupRestriction = !workoutGroupId && workoutGroupIds.length === 0;
            const isInSingleGroup = workoutGroupId && userGroupIds.includes(workoutGroupId);
            const isInGroupArray = workoutGroupIds.length > 0 && workoutGroupIds.some((gid: string) => userGroupIds.includes(gid));
            const hasAccess = hasNoGroupRestriction || isInSingleGroup || isInGroupArray;

            console.log("Workout:", data.date?.toDate?.()?.toLocaleDateString(), "groupId:", workoutGroupId, "groupIds:", workoutGroupIds, "hasAccess:", hasAccess);

            if (hasAccess) {
              const components = data.components || [];
              components.forEach((component: { title?: string; description?: string; type?: string; scoringType?: string }, idx: number) => {
                if (component.title) {
                  const componentType = component.type === "lift" ? "lift" : component.type === "skill" ? "skill" : "wod";
                  automaticWorkouts.push({
                    id: `workout-${workoutDoc.id}-${idx}`,
                    name: component.title,
                    description: component.description || "",
                    type: componentType as "wod" | "lift" | "skill",
                    scoringType: component.scoringType,
                    sourceId: gymSourceId,
                    sourceName: gymName,
                    scheduledDate: data.date?.toDate?.(),
                  });
                }
              });
            }
          });
        }
      }

      // Combine automatic and user-created sources
      console.log("Automatic sources:", automaticSources.length, automaticSources);
      console.log("Automatic workouts:", automaticWorkouts.length);
      console.log("User sources:", userSourcesList.length);
      const allSources = [...automaticSources, ...userSourcesList];
      setProgrammingSources(allSources);

      // Fetch user-created programmed workouts
      const workoutsQuery = query(
        collection(db, "programmedWorkouts"),
        where("userId", "==", user.id)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const userWorkoutsList: ProgrammedWorkout[] = workoutsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const source = userSourcesList.find(s => s.id === data.sourceId);
        return {
          id: docSnap.id,
          name: data.name,
          description: data.description || "",
          type: data.type || "wod",
          scoringType: data.scoringType,
          sourceId: data.sourceId,
          sourceName: source?.name || "Unknown",
          scheduledDate: data.scheduledDate?.toDate?.(),
        };
      });

      // Combine automatic and user-created workouts
      setProgrammedWorkouts([...automaticWorkouts, ...userWorkoutsList]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Build categories with dynamic Frequent section
  const getCategories = (): WorkoutCategory[] => {
    const baseCategories = workoutType === "wod" ? WOD_CATEGORIES : workoutType === "lift" ? LIFT_CATEGORIES : SKILL_CATEGORIES;
    const frequentItems = workoutType === "wod" ? frequentWods : workoutType === "lift" ? frequentLifts : [];

    if (frequentItems.length > 0) {
      const frequentCategory: WorkoutCategory = {
        name: "Frequent",
        icon: "⚡",
        workouts: frequentItems.map((f) => ({
          name: f.name,
          description: f.description || `Logged ${f.count} times`,
          type: f.type,
        })),
      };
      return [frequentCategory, ...baseCategories];
    }
    return baseCategories;
  };

  const categories = getCategories();

  // Filter workouts across all categories when searching
  const getSearchResults = (): Workout[] => {
    if (!searchQuery.trim()) return [];
    const allWorkouts = workoutType === "wod" ? getAllWods() : workoutType === "lift" ? getAllLifts() : getAllSkills();
    return allWorkouts.filter(
      (w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const searchResults = getSearchResults();
  const isSearching = searchQuery.trim().length > 0;

  // Get custom workouts for current type
  const getCurrentCustomWorkouts = (): CustomWorkout[] => {
    switch (workoutType) {
      case "wod": return customWods;
      case "lift": return customLifts;
      case "skill": return customSkills;
      default: return [];
    }
  };
  const currentCustomWorkouts = getCurrentCustomWorkouts();

  // Get gym workouts for current type
  const getCurrentGymWorkouts = (): GymWorkout[] => {
    return gymWorkouts.filter(w => w.type === workoutType);
  };
  const currentGymWorkouts = getCurrentGymWorkouts();

  const toggleCategory = (categoryName: string) => {
    setExpandedCategory(expandedCategory === categoryName ? null : categoryName);
  };

  const handleDeleteCustomWorkout = async (workoutName: string, workoutType: "wod" | "lift" | "skill") => {
    if (!user) return;

    try {
      if (workoutType === "wod") {
        // Delete all WOD logs with this name
        const logsQuery = query(
          collection(db, "workoutLogs"),
          where("userId", "==", user.id),
          where("wodTitle", "==", workoutName)
        );
        const snapshot = await getDocs(logsQuery);
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "workoutLogs", d.id))));
        setCustomWods(prev => prev.filter(w => w.name !== workoutName));
      } else if (workoutType === "lift") {
        // Delete all lift results with this name
        const liftsQuery = query(
          collection(db, "liftResults"),
          where("userId", "==", user.id),
          where("liftTitle", "==", workoutName)
        );
        const snapshot = await getDocs(liftsQuery);
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "liftResults", d.id))));
        setCustomLifts(prev => prev.filter(w => w.name !== workoutName));
      } else if (workoutType === "skill") {
        // Delete all skill results with this name
        const skillsQuery = query(
          collection(db, "skillResults"),
          where("userId", "==", user.id),
          where("skillTitle", "==", workoutName)
        );
        const snapshot = await getDocs(skillsQuery);
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "skillResults", d.id))));
        setCustomSkills(prev => prev.filter(w => w.name !== workoutName));
      }

      // Refresh recent logs
      fetchUserData();
    } catch (error) {
      console.error("Error deleting workout:", error);
    } finally {
      setDeletingWorkout(null);
    }
  };

  const handleAddProgrammingSource = async () => {
    if (!user || !newSourceName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, "programmingSources"), {
        userId: user.id,
        name: newSourceName.trim(),
        type: newSourceType,
        createdAt: Timestamp.now(),
      });

      setProgrammingSources(prev => [...prev, {
        id: docRef.id,
        name: newSourceName.trim(),
        type: newSourceType,
        createdAt: new Date(),
      }]);

      setNewSourceName("");
      setNewSourceType("online");
      setShowAddSourceModal(false);
    } catch (error: unknown) {
      console.error("Error adding programming source:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to add source: ${errorMessage}`);
    }
  };

  const handleDeleteProgrammingSource = async (sourceId: string) => {
    if (!user) return;

    // Find the source to check if it's automatic
    const source = programmingSources.find(s => s.id === sourceId);

    if (source?.isAutomatic) {
      // For automatic sources (gym/groups), save to localStorage as hidden
      const newHidden = [...hiddenSourceIds, sourceId];
      setHiddenSourceIds(newHidden);
      localStorage.setItem(`hiddenSources_${user.id}`, JSON.stringify(newHidden));
      return;
    }

    try {
      // Delete the source from Firestore
      await deleteDoc(doc(db, "programmingSources", sourceId));

      // Delete all workouts for this source
      const workoutsQuery = query(
        collection(db, "programmedWorkouts"),
        where("sourceId", "==", sourceId)
      );
      const snapshot = await getDocs(workoutsQuery);
      await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "programmedWorkouts", d.id))));

      setProgrammingSources(prev => prev.filter(s => s.id !== sourceId));
      setProgrammedWorkouts(prev => prev.filter(w => w.sourceId !== sourceId));
    } catch (error) {
      console.error("Error deleting programming source:", error);
    }
  };

  const handleUnhideSource = (sourceId: string) => {
    if (!user) return;
    const newHidden = hiddenSourceIds.filter(id => id !== sourceId);
    setHiddenSourceIds(newHidden);
    localStorage.setItem(`hiddenSources_${user.id}`, JSON.stringify(newHidden));
  };

  const handleAddProgrammedWorkout = async (sourceId: string) => {
    if (!user || !newWorkoutName.trim()) return;

    const source = programmingSources.find(s => s.id === sourceId);
    if (!source) return;

    try {
      const docRef = await addDoc(collection(db, "programmedWorkouts"), {
        userId: user.id,
        sourceId,
        name: newWorkoutName.trim(),
        description: newWorkoutDescription.trim(),
        type: newWorkoutType,
        scoringType: newWorkoutType === "wod" ? newWorkoutScoringType : undefined,
        createdAt: Timestamp.now(),
      });

      setProgrammedWorkouts(prev => [...prev, {
        id: docRef.id,
        name: newWorkoutName.trim(),
        description: newWorkoutDescription.trim(),
        type: newWorkoutType,
        scoringType: newWorkoutType === "wod" ? newWorkoutScoringType : undefined,
        sourceId,
        sourceName: source.name,
      }]);

      setNewWorkoutName("");
      setNewWorkoutDescription("");
      setNewWorkoutType("wod");
      setNewWorkoutScoringType("fortime");
      setShowAddWorkoutModal(null);
    } catch (error) {
      console.error("Error adding programmed workout:", error);
    }
  };

  const handleDeleteProgrammedWorkout = async (workoutId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "programmedWorkouts", workoutId));
      setProgrammedWorkouts(prev => prev.filter(w => w.id !== workoutId));
    } catch (error) {
      console.error("Error deleting programmed workout:", error);
    }
  };

  // Get programmed workouts for current type
  const getCurrentProgrammedWorkouts = (sourceId: string): ProgrammedWorkout[] => {
    return programmedWorkouts.filter(w => w.sourceId === sourceId && w.type === workoutType);
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
          <div className="relative">
            <button
              onClick={() => setShowLogDropdown(!showLogDropdown)}
              onBlur={() => setTimeout(() => setShowLogDropdown(false), 200)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              + Log Workout
              <svg className={`w-4 h-4 transition-transform ${showLogDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLogDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <Link
                  href="/workouts/new"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log WOD</span>
                  <p className="text-xs text-gray-500">For Time, EMOM, AMRAP</p>
                </Link>
                <Link
                  href="/workouts/lift"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log Lift</span>
                  <p className="text-xs text-gray-500">Track weight & reps</p>
                </Link>
                <Link
                  href="/workouts/skill"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <span className="font-medium">Log Skill</span>
                  <p className="text-xs text-gray-500">Gymnastics & skills</p>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Type Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setWorkoutType("wod");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "wod"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            WODs
          </button>
          <button
            onClick={() => {
              setWorkoutType("lift");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "lift"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Lifts
          </button>
          <button
            onClick={() => {
              setWorkoutType("skill");
              setExpandedCategory(null);
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              workoutType === "skill"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Skills
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workouts..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workout Categories or Search Results */}
          <div className="lg:col-span-2">
            {isSearching ? (
              // Search Results
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Search Results ({searchResults.length})
                </h2>
                {searchResults.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {searchResults.map((workout, idx) => (
                      <Link
                        key={`${workout.name}-${idx}`}
                        href={
                          workout.type === "lift"
                            ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                            : workout.type === "skill"
                            ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                            : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                        }
                        className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                          idx > 0 ? "border-t border-gray-100" : ""
                        }`}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900">{workout.name}</h3>
                          <p className="text-gray-500 text-sm">{workout.description}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">No workouts found matching "{searchQuery}"</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* My Saved Workouts Section */}
                {currentCustomWorkouts.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-xl">📝</span>
                      My Saved {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "Lifts" : "Skills"}
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {currentCustomWorkouts.slice(0, 5).map((workout, idx) => (
                        <div
                          key={`custom-${workout.name}-${idx}`}
                          className={`flex items-center p-4 hover:bg-gray-50 transition-colors ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          }`}
                        >
                          <Link
                            href={
                              workout.type === "lift"
                                ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                                : workout.type === "skill"
                                ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                                : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                            }
                            className="flex-1 min-w-0"
                          >
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{workout.name}</h3>
                              <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                                Custom
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm truncate">
                              {workout.description || `Logged ${workout.count} times`}
                            </p>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingWorkout({ name: workout.name, type: workout.type });
                            }}
                            className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            title="Delete workout"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {currentCustomWorkouts.length > 5 && (
                        <div className="px-4 py-3 bg-gray-50 text-center border-t border-gray-100">
                          <span className="text-sm text-gray-500">
                            +{currentCustomWorkouts.length - 5} more saved {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "lifts" : "skills"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* From My Gym Section */}
                {currentGymWorkouts.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-xl">🏋️</span>
                      From My Gym
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {currentGymWorkouts.slice(0, 5).map((workout, idx) => (
                        <Link
                          key={`gym-${workout.name}-${idx}`}
                          href={
                            workout.type === "lift"
                              ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                              : workout.type === "skill"
                              ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                              : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                          }
                          className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{workout.name}</h3>
                              {workout.scoringType && (
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  workout.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                                  workout.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                  workout.scoringType === "emom" ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {workout.scoringType === "fortime" ? "For Time" :
                                   workout.scoringType === "amrap" ? "AMRAP" :
                                   workout.scoringType === "emom" ? "EMOM" : workout.scoringType}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-sm truncate">{workout.description}</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                      {currentGymWorkouts.length > 5 && (
                        <div className="px-4 py-3 bg-gray-50 text-center border-t border-gray-100">
                          <span className="text-sm text-gray-500">
                            +{currentGymWorkouts.length - 5} more from gym programming
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* External Programming Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      External Programming
                    </h2>
                    <button
                      onClick={() => setShowAddSourceModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Source
                    </button>
                  </div>

                  {(() => {
                    const visibleSources = programmingSources.filter(s => !hiddenSourceIds.includes(s.id));
                    const hiddenSources = programmingSources.filter(s => hiddenSourceIds.includes(s.id));

                    return visibleSources.length === 0 && hiddenSources.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                      <p className="text-gray-500 text-sm mb-3">
                        Track workouts from online programs, personal trainers, or other coaches
                      </p>
                      <button
                        onClick={() => setShowAddSourceModal(true)}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Add your first programming source
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Show hidden sources notice */}
                      {hiddenSources.length > 0 && (
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                          <p className="text-gray-600 text-sm mb-2">
                            {hiddenSources.length} hidden source{hiddenSources.length > 1 ? 's' : ''}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {hiddenSources.map(source => (
                              <button
                                key={source.id}
                                onClick={() => handleUnhideSource(source.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                              >
                                <span>{source.type === "gym" ? "🏋️" : source.type === "group" ? "👥" : "📝"}</span>
                                {source.name}
                                <span className="text-blue-600 ml-1">+ Show</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {visibleSources.map((source) => {
                        const sourceWorkouts = getCurrentProgrammedWorkouts(source.id);
                        const isExpanded = expandedSource === source.id;

                        return (
                          <div key={source.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <button
                              onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">
                                  {source.type === "gym" ? "🏋️" : source.type === "group" ? "👥" : source.type === "online" ? "🌐" : source.type === "pt" ? "👤" : "📝"}
                                </span>
                                <div>
                                  <h3 className="font-medium text-gray-900">{source.name}</h3>
                                  <p className="text-gray-500 text-xs">
                                    {sourceWorkouts.length} {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "lifts" : "skills"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  source.type === "gym" ? "bg-orange-100 text-orange-700" :
                                  source.type === "group" ? "bg-teal-100 text-teal-700" :
                                  source.type === "online" ? "bg-blue-100 text-blue-700" :
                                  source.type === "pt" ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {source.type === "gym" ? "Gym" : source.type === "group" ? "Group" : source.type === "online" ? "Online" : source.type === "pt" ? "PT" : "Other"}
                                </span>
                                <svg
                                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-gray-100 bg-gray-50">
                                {sourceWorkouts.length === 0 ? (
                                  <div className="p-4">
                                    <p className="text-gray-500 text-sm mb-3 text-center">
                                      No {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "lifts" : "skills"} {source.isAutomatic ? "programmed" : "added"} yet
                                    </p>
                                    <div className="flex justify-center gap-4">
                                      {!source.isAutomatic && (
                                        <button
                                          onClick={() => setShowAddWorkoutModal(source.id)}
                                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                        >
                                          + Add workout
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteProgrammingSource(source.id)}
                                        className="text-red-500 hover:text-red-600 font-medium text-sm"
                                      >
                                        {source.isAutomatic ? "Hide source" : "Delete source"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {sourceWorkouts.map((workout, idx) => (
                                      <div
                                        key={workout.id}
                                        className={`flex items-center p-4 hover:bg-gray-100 transition-colors ${
                                          idx > 0 ? "border-t border-gray-200" : ""
                                        }`}
                                      >
                                        <Link
                                          href={
                                            workout.type === "lift"
                                              ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                                              : workout.type === "skill"
                                              ? `/workouts/skill?name=${encodeURIComponent(workout.name)}`
                                              : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                                          }
                                          className="flex-1 min-w-0"
                                        >
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-800">{workout.name}</h4>
                                            {workout.scoringType && (
                                              <span className={`px-2 py-0.5 text-xs rounded ${
                                                workout.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                                                workout.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                                workout.scoringType === "emom" ? "bg-purple-100 text-purple-700" :
                                                "bg-gray-100 text-gray-700"
                                              }`}>
                                                {workout.scoringType === "fortime" ? "For Time" :
                                                 workout.scoringType === "amrap" ? "AMRAP" :
                                                 workout.scoringType === "emom" ? "EMOM" : workout.scoringType}
                                              </span>
                                            )}
                                          </div>
                                          {workout.description && (
                                            <p className="text-gray-500 text-sm truncate">{workout.description}</p>
                                          )}
                                        </Link>
                                        {!source.isAutomatic && (
                                          <button
                                            onClick={() => handleDeleteProgrammedWorkout(workout.id)}
                                            className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                            title="Delete workout"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <div className="p-3 border-t border-gray-200 flex justify-between items-center">
                                      {!source.isAutomatic ? (
                                        <button
                                          onClick={() => setShowAddWorkoutModal(source.id)}
                                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                        >
                                          + Add workout
                                        </button>
                                      ) : (
                                        <span></span>
                                      )}
                                      <button
                                        onClick={() => handleDeleteProgrammingSource(source.id)}
                                        className="text-red-500 hover:text-red-600 font-medium text-sm"
                                      >
                                        {source.isAutomatic ? "Hide source" : "Delete source"}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                  })()}
                </div>

                {/* Category List */}
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  All {workoutType === "wod" ? "WODs" : workoutType === "lift" ? "Lifts" : "Skills"}
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {categories.map((category, catIdx) => (
                  <div key={category.name}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                        catIdx > 0 ? "border-t border-gray-100" : ""
                      }`}
                    >
                      <span className="font-medium text-gray-900 flex items-center gap-2">
                        {category.icon && <span>{category.icon}</span>}
                        {category.name}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedCategory === category.name ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Expanded Workout List */}
                    {expandedCategory === category.name && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {category.workouts.map((workout, idx) => (
                          <Link
                            key={`${workout.name}-${idx}`}
                            href={
                              workout.type === "lift"
                                ? `/workouts/lift?name=${encodeURIComponent(workout.name)}`
                                : `/workouts/new?name=${encodeURIComponent(workout.name)}&description=${encodeURIComponent(workout.description)}&type=${workout.type}${workout.scoringType ? `&scoringType=${workout.scoringType}` : ""}`
                            }
                            className={`flex items-center justify-between p-4 pl-8 hover:bg-gray-100 transition-colors ${
                              idx > 0 ? "border-t border-gray-200" : ""
                            }`}
                          >
                            <div>
                              <h4 className="font-medium text-gray-800">{workout.name}</h4>
                              <p className="text-gray-500 text-sm">{workout.description}</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Recent Logs</h2>
            {loadingData ? (
              <p className="text-gray-500">Loading...</p>
            ) : recentLogs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm">No workouts logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <Link
                    key={log.id}
                    href={`/workouts/new?name=${encodeURIComponent(log.wodTitle)}&description=${encodeURIComponent(log.wodDescription || "")}`}
                    className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{log.wodTitle}</h4>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {log.completedDate?.toDate?.()?.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-blue-600 font-medium text-sm">
                          {formatResult(log)}
                        </span>
                        {log.isPersonalRecord && (
                          <span className="ml-1 text-yellow-500">👑</span>
                        )}
                      </div>
                    </div>
                    {log.notes && (
                      <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                        log.notes === "RX"
                          ? "bg-blue-100 text-blue-600"
                          : log.notes === "Scaled"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-100 text-green-600"
                      }`}>
                        {log.notes}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deletingWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete "{deletingWorkout.name}"?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete all your logged entries for this {deletingWorkout.type === "wod" ? "workout" : deletingWorkout.type}. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingWorkout(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCustomWorkout(deletingWorkout.name, deletingWorkout.type)}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Programming Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Programming Source</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Name</label>
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="e.g., CompTrain, HWPO, My PT - John"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewSourceType("gym")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newSourceType === "gym"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Gym
                  </button>
                  <button
                    onClick={() => setNewSourceType("online")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newSourceType === "online"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Online Program
                  </button>
                  <button
                    onClick={() => setNewSourceType("pt")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newSourceType === "pt"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Personal Trainer
                  </button>
                  <button
                    onClick={() => setNewSourceType("other")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newSourceType === "other"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Other
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddSourceModal(false);
                  setNewSourceName("");
                  setNewSourceType("online");
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProgrammingSource}
                disabled={!newSourceName.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Programmed Workout Modal */}
      {showAddWorkoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Workout</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Name</label>
                <input
                  type="text"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  placeholder="e.g., Monday WOD, Back Squat Day"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newWorkoutDescription}
                  onChange={(e) => setNewWorkoutDescription(e.target.value)}
                  placeholder="Workout details..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewWorkoutType("wod")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newWorkoutType === "wod"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    WOD
                  </button>
                  <button
                    onClick={() => setNewWorkoutType("lift")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newWorkoutType === "lift"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Lift
                  </button>
                  <button
                    onClick={() => setNewWorkoutType("skill")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newWorkoutType === "skill"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Skill
                  </button>
                </div>
              </div>
              {newWorkoutType === "wod" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scoring Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewWorkoutScoringType("fortime")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newWorkoutScoringType === "fortime"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      For Time
                    </button>
                    <button
                      onClick={() => setNewWorkoutScoringType("amrap")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newWorkoutScoringType === "amrap"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      AMRAP
                    </button>
                    <button
                      onClick={() => setNewWorkoutScoringType("emom")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newWorkoutScoringType === "emom"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      EMOM
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddWorkoutModal(null);
                  setNewWorkoutName("");
                  setNewWorkoutDescription("");
                  setNewWorkoutType("wod");
                  setNewWorkoutScoringType("fortime");
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddProgrammedWorkout(showAddWorkoutModal)}
                disabled={!newWorkoutName.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
