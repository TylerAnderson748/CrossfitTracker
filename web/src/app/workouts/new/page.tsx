"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, query, where, orderBy, getDocs, getDoc, Timestamp, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { WODCategory, normalizeWorkoutName, LeaderboardEntry, categoryOrder, categoryColors, WODScoringType, wodScoringTypeLabels, wodScoringTypeColors } from "@/lib/types";
import Navigation from "@/components/Navigation";
import { getAllWods } from "@/lib/workoutData";

interface WorkoutLog {
  id: string;
  wodTitle?: string;
  timeInSeconds: number;
  rounds?: number;
  reps?: number;
  resultType?: string;
  scoringType?: WODScoringType;
  completedDate: { toDate: () => Date };
  notes: string;
  category?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatScore(log: WorkoutLog): string {
  if (log.resultType === "rounds" || log.scoringType === "amrap") {
    const rounds = log.rounds || 0;
    const reps = log.reps || 0;
    if (reps > 0) {
      return `${rounds} + ${reps}`;
    }
    return `${rounds} rounds`;
  }
  return formatTime(log.timeInSeconds);
}

function formatLeaderboardScore(entry: LeaderboardEntry): string {
  if (entry.resultType === "rounds") {
    const rounds = entry.rounds || 0;
    const reps = entry.reps || 0;
    if (reps > 0) {
      return `${rounds} + ${reps}`;
    }
    return `${rounds} rds`;
  }
  return formatTime(entry.timeInSeconds || 0);
}

// Get hex color for category
function getCategoryHexColor(category: string): string {
  if (category === "RX" || category === "rx" || category === "RX+") return "#3B82F6"; // blue
  if (category === "Scaled" || category === "scaled") return "#6B7280"; // gray
  if (category === "Just For Fun" || category === "Just for Fun" || category === "fun") return "#22C55E"; // green
  return "#3B82F6"; // default blue
}

// Generate straight line path
function getLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " at " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function NewWorkoutContent() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wodTitle, setWodTitle] = useState(searchParams.get("name") || "");
  const [wodDescription, setWodDescription] = useState(searchParams.get("description") || "");
  const [isPreset, setIsPreset] = useState(!!searchParams.get("name")); // Lock fields if loaded from URL
  const [category, setCategory] = useState<WODCategory>("RX");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiCoachFeedback, setAiCoachFeedback] = useState("");
  const [showAiFeedback, setShowAiFeedback] = useState(false);

  // Get all WODs for suggestions
  const allWods = getAllWods();
  const getFilteredSuggestions = (searchText: string) => {
    if (!searchText || searchText.length < 2) return [];
    return allWods.filter((w) =>
      w.name.toLowerCase().includes(searchText.toLowerCase())
    ).slice(0, 8);
  };

  // Scoring type from URL params (fortime, emom, amrap)
  const urlScoringType = searchParams.get("scoringType") as WODScoringType | null;
  const [scoringType, setScoringType] = useState<WODScoringType>(urlScoringType || "fortime");
  // Track if scoring type is locked (from URL or suggestion selection) - separate from isPreset
  const [scoringTypeLocked, setScoringTypeLocked] = useState(!!urlScoringType);

  // Type mismatch modal state
  const [showTypeMismatchModal, setShowTypeMismatchModal] = useState(false);
  const [existingWorkoutType, setExistingWorkoutType] = useState<WODScoringType | null>(null);
  const [pendingScoringType, setPendingScoringType] = useState<WODScoringType | null>(null);

  // Check if workout name matches a preset workout
  const getPresetWorkout = (name: string) => {
    if (!name) return null;
    const normalizedName = name.toLowerCase().trim();
    return allWods.find(w => w.name.toLowerCase() === normalizedName);
  };

  // AMRAP scoring state (rounds + reps)
  const [amrapRounds, setAmrapRounds] = useState("");
  const [amrapReps, setAmrapReps] = useState("");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer type state - initialized based on scoring type
  const [timerType, setTimerType] = useState<"standard" | "emom" | "amrap">(
    urlScoringType === "emom" ? "emom" : urlScoringType === "amrap" ? "amrap" : "standard"
  );
  const [emomRounds, setEmomRounds] = useState(10);
  const [emomCurrentRound, setEmomCurrentRound] = useState(1);
  const [emomSecondsInRound, setEmomSecondsInRound] = useState(60);
  const [amrapMinutes, setAmrapMinutes] = useState(12);
  const [amrapRemainingSeconds, setAmrapRemainingSeconds] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // History and leaderboard
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardFilter, setLeaderboardFilter] = useState<"everyone" | "gym">("everyone");
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | WODCategory>("all");
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [chartTimeRange, setChartTimeRange] = useState<"1m" | "6m" | "1y" | "2y" | "5y">("1y");

  // Edit history state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [editSeconds, setEditSeconds] = useState("");
  const [editCategory, setEditCategory] = useState<WODCategory>("RX");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Redirect to lift page if type=lift is passed
  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "lift") {
      const name = searchParams.get("name") || "";
      const description = searchParams.get("description") || "";
      router.replace(`/workouts/lift?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}`);
    } else if (type === "skill") {
      const name = searchParams.get("name") || "";
      const description = searchParams.get("description") || "";
      router.replace(`/workouts/skill?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}`);
    }
  }, [searchParams, router]);

  // Auto-select timer type based on scoring type
  useEffect(() => {
    if (scoringType === "fortime") {
      setTimerType("standard");
    } else if (scoringType === "emom") {
      setTimerType("emom");
    } else if (scoringType === "amrap") {
      setTimerType("amrap");
    }
  }, [scoringType]);

  // Check for existing workout type in user's logs
  const checkExistingWorkoutType = async (workoutName: string): Promise<WODScoringType | null> => {
    if (!user || !workoutName.trim()) return null;

    // First check if it's a preset workout
    const preset = getPresetWorkout(workoutName);
    if (preset && preset.scoringType) {
      return preset.scoringType;
    }

    // Check user's existing logs for this workout
    try {
      const normalized = normalizeWorkoutName(workoutName.trim());
      const logsQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        limit(100)
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs = logsSnapshot.docs.map(doc => doc.data());

      // Find logs for this workout
      const matchingLog = logs.find(log =>
        normalizeWorkoutName((log.wodTitle || "").trim()) === normalized && log.scoringType
      );

      return matchingLog?.scoringType as WODScoringType || null;
    } catch (e) {
      console.error("Error checking existing workout type:", e);
      return null;
    }
  };

  // Handle scoring type change with conflict check
  const handleScoringTypeChange = async (newType: WODScoringType) => {
    if (!wodTitle.trim()) {
      setScoringType(newType);
      return;
    }

    // Check if it's a preset workout - don't allow changing preset types
    const preset = getPresetWorkout(wodTitle);
    if (preset && preset.scoringType && preset.scoringType !== newType) {
      // Don't allow changing preset workout types
      return;
    }

    // Check for existing logs with different type
    const existingType = await checkExistingWorkoutType(wodTitle);
    if (existingType && existingType !== newType) {
      setExistingWorkoutType(existingType);
      setPendingScoringType(newType);
      setShowTypeMismatchModal(true);
      return;
    }

    setScoringType(newType);
  };

  // Sound functions for timer beeps
  const playBeep = (frequency: number = 800, duration: number = 150, type: OscillatorType = "sine") => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  };

  const playCountdownBeep = () => playBeep(600, 100, "sine");
  const playRoundStartBeep = () => {
    playBeep(1000, 200, "sine");
    setTimeout(() => playBeep(1200, 300, "sine"), 100);
  };
  const playFinishBeep = () => {
    playBeep(800, 150, "sine");
    setTimeout(() => playBeep(1000, 150, "sine"), 150);
    setTimeout(() => playBeep(1200, 300, "sine"), 300);
  };

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        if (timerType === "standard") {
          setElapsedSeconds((prev) => prev + 1);
        } else if (timerType === "emom") {
          setEmomSecondsInRound((prev) => {
            if (prev <= 1) {
              // End of round
              setEmomCurrentRound((round) => {
                if (round >= emomRounds) {
                  // Workout complete
                  setTimerRunning(false);
                  playFinishBeep();
                  return round;
                }
                playRoundStartBeep();
                return round + 1;
              });
              return 60;
            }
            if (prev <= 4 && prev > 1) playCountdownBeep();
            return prev - 1;
          });
          setElapsedSeconds((prev) => prev + 1);
        } else if (timerType === "amrap") {
          setAmrapRemainingSeconds((prev) => {
            if (prev <= 1) {
              setTimerRunning(false);
              playFinishBeep();
              return 0;
            }
            if (prev <= 4 && prev > 1) playCountdownBeep();
            return prev - 1;
          });
          setElapsedSeconds((prev) => prev + 1);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerType, emomRounds]);

  useEffect(() => {
    if (user) {
      if (wodTitle) {
        loadHistory();
      }
      loadLeaderboard();
    }
  }, [user, wodTitle, leaderboardFilter, genderFilter, categoryFilter]);

  // Category priority: RX (0) > Scaled (1) > Just For Fun (2)
  const getCategoryPriority = (cat: string): number => {
    if (cat === "RX" || cat === "rx" || cat === "RX+" || cat === "rxPlus") return 0;
    if (cat === "Scaled" || cat === "scaled") return 1;
    if (cat === "Just For Fun" || cat === "Just for Fun" || cat === "fun" || cat === "Fun") return 2;
    return 0; // Default to RX priority for unknown/empty
  };

  const normalizeCategory = (cat: string): WODCategory => {
    if (!cat || cat === "RX" || cat === "rx" || cat === "RX+" || cat === "rxPlus") return "RX";
    if (cat === "Scaled" || cat === "scaled") return "Scaled";
    if (cat === "Just For Fun" || cat === "Just for Fun" || cat === "fun" || cat === "Fun" || cat === "Just Happy To Be Here" || cat === "happy") return "Just For Fun";
    return "RX"; // Default to RX for unknown categories
  };

  const loadHistory = async () => {
    if (!user || !wodTitle) return;
    try {
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const allLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutLog[];

      // Filter client-side for this workout and sort
      const filtered = allLogs
        .filter((log) => log.wodTitle?.toLowerCase() === wodTitle.trim().toLowerCase())
        .sort((a, b) => {
          const dateA = a.completedDate?.toDate?.() || new Date(0);
          const dateB = b.completedDate?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10);

      setHistory(filtered);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const loadLeaderboard = async () => {
    // Don't load leaderboard if no workout name is entered
    if (!wodTitle || !wodTitle.trim()) {
      setLeaderboard([]);
      setLoadingLeaderboard(false);
      return;
    }

    setLoadingLeaderboard(true);
    try {
      let entries: LeaderboardEntry[] = [];
      const normalized = normalizeWorkoutName(wodTitle.trim());

      // Check if this is a preset workout (standard benchmark)
      const isPresetWorkout = allWods.some(w =>
        normalizeWorkoutName(w.name) === normalized
      );

      // First try leaderboardEntries collection
      const allQuery = query(
        collection(db, "leaderboardEntries"),
        limit(200)
      );
      const allSnapshot = await getDocs(allQuery);
      entries = allSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LeaderboardEntry[];

      // Filter for this workout
      entries = entries.filter(
        (e) => e.normalizedWorkoutName === normalized
      );

      // For custom (non-preset) workouts, only show current user's entries
      if (!isPresetWorkout && user) {
        entries = entries.filter((e) => e.userId === user.id);
      }

      // If no leaderboard entries, build from workoutLogs
      if (entries.length === 0) {
        const logsQuery = query(
          collection(db, "workoutLogs"),
          limit(500)
        );
        const logsSnapshot = await getDocs(logsQuery);
        const allLogs = logsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as any[];

        // Filter for this workout
        let filteredLogs = allLogs.filter((log) => {
          const logNormalized = normalizeWorkoutName((log.wodTitle || "").trim());
          return logNormalized === normalized;
        });

        // For custom (non-preset) workouts, only show current user's logs
        if (!isPresetWorkout && user) {
          filteredLogs = filteredLogs.filter((log) => log.userId === user.id);
        }

        // Get unique user IDs and fetch their names
        const userIds = [...new Set(filteredLogs.map((log) => log.userId))];
        const userNames: Record<string, string> = {};

        for (const oderId of userIds) {
          if (!oderId) continue;
          try {
            // Try fetching by document ID first
            const userDocRef = doc(db, "users", oderId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userNames[oderId] = userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Unknown";
            } else {
              // Fallback: try querying by id field
              const userQuery = query(collection(db, "users"), where("id", "==", oderId), limit(1));
              const userSnapshot = await getDocs(userQuery);
              if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                userNames[oderId] = userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Unknown";
              }
            }
          } catch (e) {
            // Ignore errors fetching user names
          }
        }

        // Convert to leaderboard format
        entries = filteredLogs.map((log) => ({
            id: log.id,
            oderId: log.userId,
            userId: log.userId,
            userName: userNames[log.userId] || log.userName || "Unknown",
            userGender: log.userGender,
            workoutLogId: log.id,
            normalizedWorkoutName: normalized,
            originalWorkoutName: log.wodTitle,
            timeInSeconds: log.timeInSeconds || 0,
            rounds: log.rounds,
            reps: log.reps,
            resultType: log.resultType || "time",
            scoringType: log.scoringType || "fortime",
            category: log.notes || log.category || "RX",
            completedDate: log.completedDate,
            createdAt: log.completedDate,
          })) as LeaderboardEntry[];
      }

      // Filter for entries with time data (for time-based workouts)
      entries = entries.filter((e) => e.timeInSeconds && e.timeInSeconds > 0);

      // Apply gender filter
      if (genderFilter !== "all") {
        entries = entries.filter((e) => e.userGender === genderFilter);
      }

      // Normalize categories on all entries
      entries = entries.map((e) => ({
        ...e,
        category: normalizeCategory((e.category || "").toString()),
      }));

      // First, determine each user's BEST category (across all their entries)
      const userBestCategory = new Map<string, number>(); // userId -> best priority (lower is better)
      entries.forEach((entry) => {
        const priority = getCategoryPriority((entry.category || "").toString());
        const existing = userBestCategory.get(entry.userId);
        if (existing === undefined || priority < existing) {
          userBestCategory.set(entry.userId, priority);
        }
      });

      // Get best entry per user (considering category priority, then time)
      const bestByUser = new Map<string, LeaderboardEntry>();
      entries.forEach((entry) => {
        const existing = bestByUser.get(entry.userId);
        if (!existing) {
          bestByUser.set(entry.userId, entry);
        } else {
          const existingPriority = getCategoryPriority((existing.category || "").toString());
          const entryPriority = getCategoryPriority((entry.category || "").toString());

          if (entryPriority < existingPriority) {
            // Better category wins
            bestByUser.set(entry.userId, entry);
          } else if (entryPriority === existingPriority) {
            // Same category, faster time wins
            if ((entry.timeInSeconds || 0) < (existing.timeInSeconds || 0)) {
              bestByUser.set(entry.userId, entry);
            }
          }
        }
      });

      // Apply category filter - only show users whose BEST category matches
      // (users with better categories don't appear in lower category filters)
      let filteredEntries = Array.from(bestByUser.values());
      if (categoryFilter !== "all") {
        const filterPriority = getCategoryPriority(categoryFilter);
        filteredEntries = filteredEntries.filter((entry) => {
          const userBestPriority = userBestCategory.get(entry.userId) ?? 0;
          // Only include if user's best category matches the filter
          return userBestPriority === filterPriority;
        });
      }

      // Sort the filtered entries
      const sortedEntries = filteredEntries.sort((a, b) => {
        if (categoryFilter === "all") {
          // Sort by category priority first, then by score
          const aPriority = getCategoryPriority((a.category || "").toString());
          const bPriority = getCategoryPriority((b.category || "").toString());
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
        }
        // For AMRAP (rounds), higher is better
        if (a.resultType === "rounds" || b.resultType === "rounds") {
          const aScore = ((a.rounds || 0) * 1000) + (a.reps || 0);
          const bScore = ((b.rounds || 0) * 1000) + (b.reps || 0);
          return bScore - aScore; // Higher score first
        }
        // For time-based, lower is better
        return (a.timeInSeconds || 0) - (b.timeInSeconds || 0);
      });

      setLeaderboard(sortedEntries);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartStop = () => {
    if (!timerRunning) {
      // Starting the timer
      if (timerType === "emom" && emomCurrentRound === 1 && emomSecondsInRound === 60) {
        playRoundStartBeep();
      }
      if (timerType === "amrap" && amrapRemainingSeconds === 0) {
        setAmrapRemainingSeconds(amrapMinutes * 60);
      }
    }
    setTimerRunning(!timerRunning);
  };

  const handleReset = () => {
    setTimerRunning(false);
    setElapsedSeconds(0);
    setEmomCurrentRound(1);
    setEmomSecondsInRound(60);
    setAmrapRemainingSeconds(amrapMinutes * 60);
  };

  const getTimeFromManual = (): number => {
    const mins = parseInt(manualMinutes) || 0;
    const secs = parseInt(manualSeconds) || 0;
    return mins * 60 + secs;
  };

  const isManualEntryValid = () => {
    const mins = parseInt(manualMinutes) || 0;
    const secs = parseInt(manualSeconds) || 0;
    return mins > 0 || secs > 0;
  };

  const handleSaveTimer = async () => {
    if (!user || !wodTitle.trim() || elapsedSeconds === 0) return;
    await saveWorkout(elapsedSeconds);
  };

  const handleSaveManual = async () => {
    if (!user || !wodTitle.trim() || !isManualEntryValid()) return;
    await saveWorkout(getTimeFromManual());
  };

  const handleSaveEmomCompletion = async () => {
    if (!user || !wodTitle.trim()) return;
    // EMOM workouts are logged as completed without a specific score
    await saveWorkout(0);
  };

  const saveWorkout = async (timeInSeconds: number, rounds?: number, reps?: number) => {
    setError("");
    setSubmitting(true);
    try {
      const now = Timestamp.now();
      const workoutDate = Timestamp.fromDate(new Date(entryDate));

      // Determine result type based on scoring type
      const resultType = scoringType === "amrap" ? "rounds" : "time";

      const workoutLogData: Record<string, unknown> = {
        userId: user!.id,
        wodTitle: wodTitle.trim(),
        wodDescription: wodDescription.trim(),
        resultType,
        scoringType,
        notes: category,
        isPersonalRecord: false,
        workoutDate,
        completedDate: now,
        ...(aiCoachFeedback.trim() && { aiCoachFeedback: aiCoachFeedback.trim() }),
      };

      // Add appropriate scoring data
      if (scoringType === "amrap") {
        workoutLogData.rounds = rounds || 0;
        workoutLogData.reps = reps || 0;
        workoutLogData.timeInSeconds = timeInSeconds; // Time cap used
      } else {
        workoutLogData.timeInSeconds = timeInSeconds;
      }

      const workoutLogRef = await addDoc(collection(db, "workoutLogs"), workoutLogData);

      const leaderboardData: Record<string, unknown> = {
        userId: user!.id,
        userName: user!.displayName || `${user!.firstName} ${user!.lastName}`,
        userGender: user!.gender,
        workoutLogId: workoutLogRef.id,
        normalizedWorkoutName: normalizeWorkoutName(wodTitle.trim()),
        originalWorkoutName: wodTitle.trim(),
        resultType,
        scoringType,
        category,
        completedDate: workoutDate,
        createdAt: now,
      };

      // Add appropriate scoring data to leaderboard
      if (scoringType === "amrap") {
        leaderboardData.rounds = rounds || 0;
        leaderboardData.reps = reps || 0;
        leaderboardData.timeInSeconds = timeInSeconds;
      } else {
        leaderboardData.timeInSeconds = timeInSeconds;
      }

      await addDoc(collection(db, "leaderboardEntries"), leaderboardData);

      // Stay on page - reset inputs and refresh data
      setManualMinutes("");
      setManualSeconds("");
      setAmrapRounds("");
      setAmrapReps("");
      setElapsedSeconds(0);
      setTimerRunning(false);
      setAiCoachFeedback("");
      setShowAiFeedback(false);
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error logging workout:", err);
      setError("Failed to log workout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save AMRAP result with rounds and reps
  const handleSaveAmrap = async () => {
    if (!user || !wodTitle.trim()) return;
    const rounds = parseInt(amrapRounds) || 0;
    const reps = parseInt(amrapReps) || 0;
    if (rounds === 0 && reps === 0) return;
    await saveWorkout(amrapMinutes * 60, rounds, reps);
  };

  const startEditLog = (log: WorkoutLog) => {
    const mins = Math.floor(log.timeInSeconds / 60);
    const secs = log.timeInSeconds % 60;
    setEditingLogId(log.id);
    setEditMinutes(mins.toString());
    setEditSeconds(secs.toString());
    setEditCategory((log.notes as WODCategory) || "RX");
    // Initialize edit date from the log's completedDate
    const logDate = log.completedDate?.toDate?.();
    if (logDate) {
      setEditDate(logDate.toISOString().split("T")[0]);
    } else {
      setEditDate(new Date().toISOString().split("T")[0]);
    }
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditMinutes("");
    setEditSeconds("");
    setEditDate("");
  };

  const saveEdit = async (logId: string) => {
    const mins = parseInt(editMinutes) || 0;
    const secs = parseInt(editSeconds) || 0;
    const newTime = mins * 60 + secs;
    if (newTime <= 0) return;

    try {
      const newDate = Timestamp.fromDate(new Date(editDate));

      await updateDoc(doc(db, "workoutLogs", logId), {
        timeInSeconds: newTime,
        notes: editCategory,
        completedDate: newDate,
      });

      // Also update leaderboard entry if exists
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        where("workoutLogId", "==", logId)
      );
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      for (const docSnap of leaderboardSnapshot.docs) {
        await updateDoc(doc(db, "leaderboardEntries", docSnap.id), {
          timeInSeconds: newTime,
          category: editCategory,
          completedDate: newDate,
        });
      }

      setEditingLogId(null);
      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error updating log:", err);
      setError("Failed to update entry.");
    }
  };

  const deleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await deleteDoc(doc(db, "workoutLogs", logId));

      // Also delete leaderboard entry if exists
      const leaderboardQuery = query(
        collection(db, "leaderboardEntries"),
        where("workoutLogId", "==", logId)
      );
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      for (const docSnap of leaderboardSnapshot.docs) {
        await deleteDoc(doc(db, "leaderboardEntries", docSnap.id));
      }

      loadHistory();
      loadLeaderboard();
    } catch (err) {
      console.error("Error deleting log:", err);
      setError("Failed to delete entry.");
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Progress chart data - filter by time range
  const getTimeRangeDate = (range: string) => {
    const now = new Date();
    switch (range) {
      case "1m": return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case "6m": return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case "1y": return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case "2y": return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      case "5y": return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      default: return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
  };
  const timeRangeStart = getTimeRangeDate(chartTimeRange);
  const timeRangeEnd = new Date();
  const timeRangeMs = timeRangeEnd.getTime() - timeRangeStart.getTime();

  const filteredHistory = history.filter((h) => {
    const date = h.completedDate?.toDate?.();
    return date && date >= timeRangeStart;
  });
  const chartData = filteredHistory.slice(0, 50).reverse();
  const times = chartData.map((h) => h.timeInSeconds);
  const dataMax = Math.max(...times, 60);
  const dataMin = Math.min(...times, 0);

  // Calculate tick interval to fit data in ~5-6 ticks
  const dataRange = dataMax - dataMin || 60;
  const rawInterval = dataRange / 5;
  // Nice time intervals: 15s, 30s, 1m, 2m, 5m, 10m
  const niceIntervals = [15, 30, 60, 120, 300, 600];
  const tickInterval = niceIntervals.find(i => i >= rawInterval) || Math.ceil(rawInterval / 60) * 60;

  // Calculate min/max ticks to cover all data
  const chartMin = Math.floor(dataMin / tickInterval) * tickInterval;
  const chartMax = Math.ceil(dataMax / tickInterval) * tickInterval;
  const range = chartMax - chartMin || tickInterval;
  const numTicks = Math.round(range / tickInterval) + 1;
  const yTicks = Array.from({ length: numTicks }, (_, i) => chartMax - i * tickInterval);

  // Generate x-axis labels for the full time range
  const getXAxisLabels = () => {
    const labels: { date: Date; label: string }[] = [];
    const now = new Date();
    switch (chartTimeRange) {
      case "1m":
        for (let i = 4; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
          labels.push({ date: d, label: `${d.getMonth() + 1}/${d.getDate()}` });
        }
        break;
      case "6m":
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "1y":
        for (let i = 12; i >= 0; i -= 2) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short" }) });
        }
        break;
      case "2y":
        for (let i = 24; i >= 0; i -= 6) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) });
        }
        break;
      case "5y":
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear() - i, now.getMonth(), 1);
          labels.push({ date: d, label: d.getFullYear().toString() });
        }
        break;
    }
    return labels;
  };
  const xAxisLabels = getXAxisLabels();

  const getXPosition = (date: Date) => {
    const dateMs = date.getTime() - timeRangeStart.getTime();
    return 10 + (dateMs / timeRangeMs) * 280;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN - Progress, Leaderboard, History */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Progress Line Chart */}
            {filteredHistory.length >= 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-gray-700">Progress</p>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                    {[
                      { key: "1m", label: "1M" },
                      { key: "6m", label: "6M" },
                      { key: "1y", label: "1Y" },
                      { key: "2y", label: "2Y" },
                      { key: "5y", label: "5Y" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setChartTimeRange(key as typeof chartTimeRange)}
                        className={`px-2 py-1 font-medium transition-colors ${
                          chartTimeRange === key
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="flex">
                    <div className="w-12 flex flex-col justify-between text-xs text-gray-400 pr-1 py-1" style={{ height: "160px" }}>
                      {yTicks.map((tick, i) => (
                        <span key={i} className="text-right">{formatTime(Math.round(tick))}</span>
                      ))}
                    </div>
                    <div className="flex-1" style={{ height: "160px" }}>
                      <svg width="100%" height="100%" viewBox="0 0 350 160" preserveAspectRatio="none">
                        {/* Horizontal grid lines */}
                        {yTicks.map((_, i) => {
                          const y = 4 + (i / (yTicks.length - 1)) * 152;
                          return <line key={i} x1="5" y1={y} x2="345" y2={y} stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
                        })}
                        {/* Vertical grid lines */}
                        {xAxisLabels.map((label, i) => {
                          const xPct = (label.date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                          const x = 5 + xPct * 340;
                          return <line key={i} x1={x} y1="4" x2={x} y2="156" stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
                        })}
                        {/* Data line */}
                        {chartData.length > 1 ? (
                          <path
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            d={getLinePath(chartData.map((d) => {
                              const date = d.completedDate?.toDate?.() || new Date();
                              const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                              const x = 5 + xPct * 340;
                              const y = range > 0 ? 4 + (1 - (d.timeInSeconds - chartMin) / range) * 152 : 80;
                              return { x, y };
                            }))}
                          />
                        ) : null}
                        {/* Data points */}
                        {chartData.map((d, i) => {
                          const date = d.completedDate?.toDate?.() || new Date();
                          const xPct = (date.getTime() - timeRangeStart.getTime()) / timeRangeMs;
                          const x = 5 + xPct * 340;
                          const y = range > 0 ? 4 + (1 - (d.timeInSeconds - chartMin) / range) * 152 : 80;
                          const color = getCategoryHexColor(d.notes || "");
                          return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
                        })}
                      </svg>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-12"></div>
                    <div className="flex-1 flex justify-between text-xs text-gray-400 mt-1">
                      {xAxisLabels.map((label, i) => (
                        <span key={i}>{label.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 mt-6 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-gray-500">RX</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                    <span className="text-gray-500">Scaled</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-gray-500">Just For Fun</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Leaderboard</p>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                  <button onClick={() => setLeaderboardFilter("gym")} className={`px-3 py-1.5 font-medium ${leaderboardFilter === "gym" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Gym</button>
                  <button onClick={() => setLeaderboardFilter("everyone")} className={`px-3 py-1.5 font-medium ${leaderboardFilter === "everyone" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Everyone</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Gender:</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                    {(["all", "Male", "Female"] as const).map((g) => (
                      <button key={g} onClick={() => setGenderFilter(g)} className={`px-2 py-1 font-medium ${genderFilter === g ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                        {g === "all" ? "All" : g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Category:</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                    {(["all", "RX", "Scaled", "Just For Fun"] as const).map((c) => (
                      <button key={c} onClick={() => setCategoryFilter(c)} className={`px-2 py-1 font-medium whitespace-nowrap ${categoryFilter === c ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                        {c === "all" ? "All" : c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loadingLeaderboard ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No entries yet</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry, index) => {
                    const cat = entry.category as WODCategory;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 py-1.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-600">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {entry.userName}
                              {entry.userId === user?.id && <span className="text-blue-600 ml-1">(You)</span>}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[cat]?.badge || "bg-blue-100 text-blue-700"}`}>
                              {cat}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {entry.completedDate?.toDate?.().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {formatLeaderboardScore(entry)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">History</p>
                <div className="space-y-3">
                  {history.map((log) => (
                    <div key={log.id} className="py-2 border-b border-gray-100 last:border-0">
                      {editingLogId === log.id ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Date</p>
                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Time</p>
                            <div className="flex items-center gap-2">
                              <input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} placeholder="Min" className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                              <span>:</span>
                              <input type="number" value={editSeconds} onChange={(e) => setEditSeconds(e.target.value)} placeholder="Sec" className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900" />
                            </div>
                          </div>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                            {categoryOrder.map((cat) => (
                              <button key={cat} onClick={() => setEditCategory(cat)} className={`flex-1 px-2 py-1.5 font-medium whitespace-nowrap ${editCategory === cat ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                                {cat}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(log.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Save</button>
                            <button onClick={cancelEdit} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">{log.completedDate?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-semibold text-gray-900">{formatScore(log)}</p>
                              {log.scoringType && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  log.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                  log.scoringType === "emom" ? "bg-orange-100 text-orange-700" :
                                  "bg-blue-100 text-blue-700"
                                }`}>
                                  {log.scoringType === "fortime" ? "For Time" : log.scoringType.toUpperCase()}
                                </span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[log.notes as WODCategory]?.badge || "bg-gray-100 text-gray-600"}`}>
                                {log.notes || "RX"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEditLog(log)} className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✎</button>
                            <button onClick={() => deleteLog(log.id)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Workout Info, Category, Timer, Manual Entry */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Workout Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Preset indicator */}
              {isPreset && (
                <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-medium text-blue-700">Preset Workout</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreset(false)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Unlock
                  </button>
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={wodTitle}
                  onChange={(e) => {
                    if (!isPreset) {
                      setWodTitle(e.target.value);
                      setShowSuggestions(true);
                      // Unlock scoring type when manually typing a workout name
                      setScoringTypeLocked(false);
                    }
                  }}
                  onFocus={() => !isPreset && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Workout Name"
                  className={`w-full text-xl font-bold text-gray-900 border-none focus:ring-0 p-0 mb-2 placeholder-gray-400 ${isPreset ? "bg-transparent cursor-default" : ""}`}
                  readOnly={isPreset}
                  autoComplete="off"
                />
                {/* Suggestions dropdown */}
                {showSuggestions && !isPreset && getFilteredSuggestions(wodTitle).length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {getFilteredSuggestions(wodTitle).map((workout, index) => (
                      <button
                        key={index}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setWodTitle(workout.name);
                          setWodDescription(workout.description);
                          setIsPreset(true);
                          if (workout.scoringType) {
                            setScoringType(workout.scoringType);
                            setScoringTypeLocked(true);
                          }
                          setShowSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{workout.name}</span>
                          {workout.scoringType && (
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                              workout.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                              workout.scoringType === "emom" ? "bg-orange-100 text-orange-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {workout.scoringType === "fortime" ? "For Time" : workout.scoringType.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm truncate">{workout.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                value={wodDescription}
                onChange={(e) => !isPreset && setWodDescription(e.target.value)}
                placeholder="21-15-9 Thrusters & Pull-ups"
                rows={2}
                className={`w-full text-gray-900 text-sm border-none focus:ring-0 p-0 resize-none placeholder-gray-400 ${isPreset ? "bg-transparent cursor-default" : ""}`}
                readOnly={isPreset}
              />
            </div>

            {/* Timer, Category & Manual Entry */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Category */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Category</p>
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  {categoryOrder.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`flex-1 py-2 text-xs font-semibold ${category === cat ? `${categoryColors[cat].bg} text-white` : "bg-white text-gray-600"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scoring Type - only show if not locked (from URL or suggestion selection) */}
              {!scoringTypeLocked && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">Workout Type</p>
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    <button
                      onClick={() => { handleScoringTypeChange("fortime"); handleReset(); }}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${scoringType === "fortime" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      For Time
                    </button>
                    <button
                      onClick={() => { handleScoringTypeChange("emom"); handleReset(); }}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${scoringType === "emom" ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      EMOM
                    </button>
                    <button
                      onClick={() => { handleScoringTypeChange("amrap"); handleReset(); }}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${scoringType === "amrap" ? "bg-green-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      AMRAP
                    </button>
                  </div>
                </div>
              )}

              {/* Timer */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-semibold">Timer</p>

                {/* EMOM Settings */}
                {timerType === "emom" && (
                  <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-800 font-medium">Rounds:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEmomRounds(Math.max(1, emomRounds - 1))}
                          className="w-8 h-8 rounded-lg bg-orange-200 text-orange-800 font-bold hover:bg-orange-300"
                          disabled={timerRunning}
                        >
                          -
                        </button>
                        <span className="text-xl font-bold text-orange-800 w-8 text-center">{emomRounds}</span>
                        <button
                          onClick={() => setEmomRounds(emomRounds + 1)}
                          className="w-8 h-8 rounded-lg bg-orange-200 text-orange-800 font-bold hover:bg-orange-300"
                          disabled={timerRunning}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AMRAP Settings */}
                {timerType === "amrap" && (
                  <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-800 font-medium">Time Cap (min):</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setAmrapMinutes(Math.max(1, amrapMinutes - 1)); setAmrapRemainingSeconds(Math.max(60, (amrapMinutes - 1) * 60)); }}
                          className="w-8 h-8 rounded-lg bg-green-200 text-green-800 font-bold hover:bg-green-300"
                          disabled={timerRunning}
                        >
                          -
                        </button>
                        <span className="text-xl font-bold text-green-800 w-8 text-center">{amrapMinutes}</span>
                        <button
                          onClick={() => { setAmrapMinutes(amrapMinutes + 1); setAmrapRemainingSeconds((amrapMinutes + 1) * 60); }}
                          className="w-8 h-8 rounded-lg bg-green-200 text-green-800 font-bold hover:bg-green-300"
                          disabled={timerRunning}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timer Display */}
                <div className="text-center mb-3">
                  {timerType === "standard" && (
                    <div className="text-5xl font-mono font-semibold text-gray-900">
                      {formatTimerDisplay(elapsedSeconds)}
                    </div>
                  )}

                  {timerType === "emom" && (
                    <div>
                      <div className="text-sm text-orange-600 font-semibold mb-1">
                        Round {emomCurrentRound} of {emomRounds}
                      </div>
                      <div className={`text-5xl font-mono font-semibold ${emomSecondsInRound <= 5 ? "text-red-500" : "text-orange-600"}`}>
                        {formatTimerDisplay(emomSecondsInRound)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Total: {formatTimerDisplay(elapsedSeconds)}
                      </div>
                    </div>
                  )}

                  {timerType === "amrap" && (
                    <div>
                      <div className={`text-5xl font-mono font-semibold ${amrapRemainingSeconds <= 10 ? "text-red-500" : "text-green-600"}`}>
                        {formatTimerDisplay(amrapRemainingSeconds || amrapMinutes * 60)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Elapsed: {formatTimerDisplay(elapsedSeconds)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleStartStop}
                    className={`w-full py-2.5 rounded-xl font-semibold ${
                      timerRunning
                        ? "bg-red-500 text-white"
                        : timerType === "emom"
                          ? "bg-orange-500 text-white"
                          : timerType === "amrap"
                            ? "bg-green-500 text-white"
                            : "bg-blue-600 text-white"
                    }`}
                  >
                    {timerRunning ? "Stop" : "Start"}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={handleReset} className="flex-1 py-2 bg-gray-200 rounded-xl font-semibold text-gray-700 text-sm">Reset</button>
                    <button onClick={handleSaveTimer} disabled={submitting || elapsedSeconds === 0} className="flex-1 py-2 bg-green-500 rounded-xl font-semibold text-white text-sm disabled:bg-gray-300">Save</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 my-4"></div>

              {/* Manual Entry - Different inputs based on scoring type */}
              <div>
                <p className="text-xs text-gray-500 mb-2 font-semibold">
                  {scoringType === "amrap" ? "Score Entry" : scoringType === "emom" ? "Log Completion" : "Manual Entry"}
                </p>

                {/* AMRAP: Rounds + Reps */}
                {scoringType === "amrap" && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">Rounds</p>
                        <input
                          type="number"
                          value={amrapRounds}
                          onChange={(e) => setAmrapRounds(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">+ Reps</p>
                        <input
                          type="number"
                          value={amrapReps}
                          onChange={(e) => setAmrapReps(e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900"
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Date</p>
                      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    </div>
                    <button
                      onClick={handleSaveAmrap}
                      disabled={submitting || (!amrapRounds && !amrapReps)}
                      className="w-full py-2.5 bg-green-500 text-white rounded-xl font-semibold disabled:bg-gray-300"
                    >
                      Save Score
                    </button>
                  </>
                )}

                {/* For Time: Time Entry */}
                {scoringType === "fortime" && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">Min</p>
                        <input type="number" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">Sec</p>
                        <input type="number" value={manualSeconds} onChange={(e) => setManualSeconds(e.target.value)} placeholder="0" className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-gray-900" />
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Date</p>
                      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    </div>
                    <button
                      onClick={handleSaveManual}
                      disabled={submitting || !isManualEntryValid()}
                      className="w-full py-2.5 rounded-xl font-semibold disabled:bg-gray-300 bg-blue-600 text-white"
                    >
                      Save Time
                    </button>
                  </>
                )}

                {/* EMOM: Just log completion with date */}
                {scoringType === "emom" && (
                  <>
                    <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-800">
                        EMOM workouts are logged as completed. Use the timer above if needed during your workout.
                      </p>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Date</p>
                      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    </div>
                    <button
                      onClick={handleSaveEmomCompletion}
                      disabled={submitting || !wodTitle.trim()}
                      className="w-full py-2.5 rounded-xl font-semibold disabled:bg-gray-300 bg-orange-500 text-white"
                    >
                      Log Completed
                    </button>
                  </>
                )}
              </div>

              {/* AI Coach Feedback - Only show for premium users */}
              {user?.aiTrainerSubscription?.status === "active" || user?.aiTrainerSubscription?.status === "trialing" ? (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowAiFeedback(!showAiFeedback)}
                    className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {showAiFeedback ? "Hide AI Coach Feedback" : "Add Feedback for AI Coach"}
                    <svg className={`w-4 h-4 transition-transform ${showAiFeedback ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAiFeedback && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Tell your AI Coach how the workout went - this helps improve future recommendations.
                      </p>
                      <textarea
                        value={aiCoachFeedback}
                        onChange={(e) => setAiCoachFeedback(e.target.value)}
                        placeholder="e.g., Weights felt heavy today, should have scaled. Need to work on pacing for longer AMRAPs. That new PR felt great!"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        This feedback is saved with your workout and helps personalize your AI coaching.
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {/* Type Mismatch Modal */}
      {showTypeMismatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Workout Type Conflict</h3>
            <p className="text-gray-600 mb-4">
              You have existing logs for "<strong>{wodTitle}</strong>" as a{" "}
              <span className={`font-semibold ${
                existingWorkoutType === "fortime" ? "text-blue-600" :
                existingWorkoutType === "emom" ? "text-orange-500" : "text-green-600"
              }`}>
                {existingWorkoutType === "fortime" ? "For Time" : existingWorkoutType?.toUpperCase()}
              </span>{" "}
              workout.
            </p>
            <p className="text-gray-600 mb-6">
              You're trying to log it as{" "}
              <span className={`font-semibold ${
                pendingScoringType === "fortime" ? "text-blue-600" :
                pendingScoringType === "emom" ? "text-orange-500" : "text-green-600"
              }`}>
                {pendingScoringType === "fortime" ? "For Time" : pendingScoringType?.toUpperCase()}
              </span>.
              What would you like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  // Use existing type
                  if (existingWorkoutType) {
                    setScoringType(existingWorkoutType);
                  }
                  setShowTypeMismatchModal(false);
                }}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Keep as {existingWorkoutType === "fortime" ? "For Time" : existingWorkoutType?.toUpperCase()}
              </button>
              <button
                onClick={() => {
                  // Create new workout with different name
                  setWodTitle(`${wodTitle} (${pendingScoringType === "fortime" ? "For Time" : pendingScoringType?.toUpperCase()})`);
                  if (pendingScoringType) {
                    setScoringType(pendingScoringType);
                  }
                  setShowTypeMismatchModal(false);
                }}
                className="w-full py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Create New Workout "{wodTitle} ({pendingScoringType === "fortime" ? "For Time" : pendingScoringType?.toUpperCase()})"
              </button>
              <button
                onClick={() => setShowTypeMismatchModal(false)}
                className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <NewWorkoutContent />
    </Suspense>
  );
}
