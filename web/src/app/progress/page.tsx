"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, Timestamp, limit } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import Navigation from "@/components/Navigation";

// Types for progress tracking
interface LiftRecord {
  id: string;
  liftTitle: string;
  weight: number;
  reps: number;
  date: Timestamp;
}

interface WodRecord {
  id: string;
  wodTitle: string;
  timeInSeconds?: number;
  rounds?: number;
  reps?: number;
  category?: string;
  notes?: string; // Category is stored in notes field
  completedDate: Timestamp;
}

interface SkillRecord {
  id: string;
  skillTitle: string;
  maxReps?: number;
  notes?: string;
  date: Timestamp;
}

// Calculated stats
interface LiftStats {
  liftName: string;
  currentMax: number;
  previousMax: number;
  percentChange: number;
  totalSessions: number;
  trend: "up" | "down" | "stable";
}

interface WodStats {
  totalWods: number;
  rxPercentage: number;
  avgTimeImprovement: number; // percentage
  consistencyScore: number; // 0-100
  weeklyAverage: number;
}

interface SkillStats {
  skillName: string;
  currentMax: number;
  previousMax: number;
  percentChange: number;
  totalSessions: number;
  trend: "up" | "down" | "stable";
}

interface OverallProgress {
  strengthScore: number; // 0-100
  conditioningScore: number; // 0-100
  consistencyScore: number; // 0-100
  overallScore: number; // 0-100
}

export default function ProgressPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [lifts, setLifts] = useState<LiftRecord[]>([]);
  const [wods, setWods] = useState<WodRecord[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [liftStats, setLiftStats] = useState<LiftStats[]>([]);
  const [skillStats, setSkillStats] = useState<SkillStats[]>([]);
  const [wodStats, setWodStats] = useState<WodStats | null>(null);
  const [overallProgress, setOverallProgress] = useState<OverallProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"30" | "90" | "180" | "365">("90");

  // Check if user has AI Coach access
  const hasAICoach = user?.aiTrainerSubscription?.status === "active" ||
                     user?.aiTrainerSubscription?.status === "trialing" ||
                     user?.gymAICoachEnabled ||
                     user?.individualSubscription?.aiCoachEnabled ||
                     user?.role === "superAdmin" || // Super admins always have access
                     user?.role === "owner"; // Gym owners have access

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      loadProgressData();
    }
  }, [user, selectedTimeRange]);

  const loadProgressData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const daysAgo = parseInt(selectedTimeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startTimestamp = Timestamp.fromDate(startDate);

      // Fetch lift results (sort in JS to avoid needing composite index)
      const liftQuery = query(
        collection(db, "liftResults"),
        where("userId", "==", user.id),
        limit(500)
      );
      const liftSnapshot = await getDocs(liftQuery);
      const liftData = liftSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiftRecord[];
      // Sort by date descending in JavaScript
      liftData.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
      setLifts(liftData);

      // Fetch WOD logs (sort in JS to avoid needing composite index)
      const wodQuery = query(
        collection(db, "workoutLogs"),
        where("userId", "==", user.id),
        limit(500)
      );
      const wodSnapshot = await getDocs(wodQuery);
      const wodData = wodSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WodRecord[];
      // Sort by completedDate descending in JavaScript
      wodData.sort((a, b) => (b.completedDate?.toMillis() || 0) - (a.completedDate?.toMillis() || 0));
      setWods(wodData);

      // Fetch skill results (sort in JS to avoid needing composite index)
      const skillQuery = query(
        collection(db, "skillResults"),
        where("userId", "==", user.id),
        limit(200)
      );
      const skillSnapshot = await getDocs(skillQuery);
      const skillData = skillSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkillRecord[];
      // Sort by date descending in JavaScript
      skillData.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
      setSkills(skillData);

      // Calculate stats
      calculateLiftStats(liftData, startTimestamp);
      calculateSkillStats(skillData, startTimestamp);
      calculateWodStats(wodData, startTimestamp);
      calculateOverallProgress(liftData, wodData, skillData, startTimestamp);

    } catch (err) {
      console.error("Error loading progress data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLiftStats = (liftData: LiftRecord[], startDate: Timestamp) => {
    // Group lifts by name
    const liftsByName = new Map<string, LiftRecord[]>();
    liftData.forEach(lift => {
      const name = lift.liftTitle || "Unknown";
      if (!liftsByName.has(name)) {
        liftsByName.set(name, []);
      }
      liftsByName.get(name)!.push(lift);
    });

    const stats: LiftStats[] = [];
    liftsByName.forEach((records, liftName) => {
      // Sort by date descending
      records.sort((a, b) => b.date.toMillis() - a.date.toMillis());

      // Get 1RMs (reps === 1) or estimate from other rep ranges
      const oneRMs = records.filter(r => r.reps === 1);
      const currentMax = oneRMs.length > 0 ? oneRMs[0].weight : Math.max(...records.map(r => r.weight));

      // Find previous max (before the time range)
      const recentRecords = records.filter(r => r.date.toMillis() >= startDate.toMillis());
      const olderRecords = records.filter(r => r.date.toMillis() < startDate.toMillis());

      const previousMax = olderRecords.length > 0
        ? Math.max(...olderRecords.filter(r => r.reps === 1).map(r => r.weight), 0) || Math.max(...olderRecords.map(r => r.weight))
        : currentMax;

      const percentChange = previousMax > 0 ? ((currentMax - previousMax) / previousMax) * 100 : 0;

      let trend: "up" | "down" | "stable" = "stable";
      if (percentChange > 2) trend = "up";
      else if (percentChange < -2) trend = "down";

      if (recentRecords.length > 0 || olderRecords.length > 0) {
        stats.push({
          liftName,
          currentMax,
          previousMax,
          percentChange,
          totalSessions: records.length,
          trend
        });
      }
    });

    // Sort by total sessions (most tracked first)
    stats.sort((a, b) => b.totalSessions - a.totalSessions);
    setLiftStats(stats.slice(0, 10)); // Top 10 lifts
  };

  const calculateSkillStats = (skillData: SkillRecord[], startDate: Timestamp) => {
    // Group skills by name
    const skillsByName = new Map<string, SkillRecord[]>();
    skillData.forEach(skill => {
      const name = skill.skillTitle || "Unknown";
      if (!skillsByName.has(name)) {
        skillsByName.set(name, []);
      }
      skillsByName.get(name)!.push(skill);
    });

    const stats: SkillStats[] = [];
    skillsByName.forEach((records, skillName) => {
      // Sort by date descending
      records.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));

      // Get max reps (current best)
      const currentMax = Math.max(...records.map(r => r.maxReps || 0));

      // Find previous max (before the time range)
      const recentRecords = records.filter(r => (r.date?.toMillis() || 0) >= startDate.toMillis());
      const olderRecords = records.filter(r => (r.date?.toMillis() || 0) < startDate.toMillis());

      const previousMax = olderRecords.length > 0
        ? Math.max(...olderRecords.map(r => r.maxReps || 0))
        : currentMax;

      const percentChange = previousMax > 0 ? ((currentMax - previousMax) / previousMax) * 100 : 0;

      let trend: "up" | "down" | "stable" = "stable";
      if (percentChange > 5) trend = "up";
      else if (percentChange < -5) trend = "down";

      if (recentRecords.length > 0 || olderRecords.length > 0) {
        stats.push({
          skillName,
          currentMax,
          previousMax,
          percentChange,
          totalSessions: records.length,
          trend
        });
      }
    });

    // Sort by total sessions (most tracked first)
    stats.sort((a, b) => b.totalSessions - a.totalSessions);
    setSkillStats(stats.slice(0, 10)); // Top 10 skills
  };

  const calculateWodStats = (wodData: WodRecord[], startDate: Timestamp) => {
    const recentWods = wodData.filter(w => w.completedDate.toMillis() >= startDate.toMillis());

    if (recentWods.length === 0) {
      setWodStats(null);
      return;
    }

    // RX percentage
    const rxWods = recentWods.filter(w => (w.notes || w.category) === "RX");
    const rxPercentage = (rxWods.length / recentWods.length) * 100;

    // Calculate consistency (workouts per week)
    const days = parseInt(selectedTimeRange);
    const weeks = days / 7;
    const weeklyAverage = recentWods.length / weeks;

    // Consistency score (based on 3-5 workouts/week being ideal)
    let consistencyScore = 0;
    if (weeklyAverage >= 3 && weeklyAverage <= 6) {
      consistencyScore = 100;
    } else if (weeklyAverage >= 2) {
      consistencyScore = 70 + (weeklyAverage - 2) * 30;
    } else if (weeklyAverage >= 1) {
      consistencyScore = 40 + (weeklyAverage - 1) * 30;
    } else {
      consistencyScore = weeklyAverage * 40;
    }
    consistencyScore = Math.min(100, Math.max(0, consistencyScore));

    // Time improvement (compare first half to second half for repeated workouts)
    const wodGroups = new Map<string, WodRecord[]>();
    recentWods.forEach(wod => {
      if (wod.timeInSeconds && wod.wodTitle) {
        if (!wodGroups.has(wod.wodTitle)) {
          wodGroups.set(wod.wodTitle, []);
        }
        wodGroups.get(wod.wodTitle)!.push(wod);
      }
    });

    let totalImprovement = 0;
    let comparisons = 0;
    wodGroups.forEach(records => {
      if (records.length >= 2) {
        records.sort((a, b) => a.completedDate.toMillis() - b.completedDate.toMillis());
        const firstTime = records[0].timeInSeconds!;
        const lastTime = records[records.length - 1].timeInSeconds!;
        if (firstTime > 0) {
          const improvement = ((firstTime - lastTime) / firstTime) * 100;
          totalImprovement += improvement;
          comparisons++;
        }
      }
    });

    const avgTimeImprovement = comparisons > 0 ? totalImprovement / comparisons : 0;

    setWodStats({
      totalWods: recentWods.length,
      rxPercentage,
      avgTimeImprovement,
      consistencyScore,
      weeklyAverage
    });
  };

  const calculateOverallProgress = (
    liftData: LiftRecord[],
    wodData: WodRecord[],
    skillData: SkillRecord[],
    startDate: Timestamp
  ) => {
    const recentLifts = liftData.filter(l => l.date?.toMillis() >= startDate.toMillis());
    const recentWods = wodData.filter(w => w.completedDate?.toMillis() >= startDate.toMillis());
    const recentSkills = skillData.filter(s => s.date?.toMillis() >= startDate.toMillis());
    const days = parseInt(selectedTimeRange);
    const weeks = days / 7;

    // ========== STRENGTH SCORE (0-100) ==========
    // Pure performance metrics - no attendance/consistency factors
    // 1. PR Achievement (up to 50 pts) - new personal records
    // 2. Progressive Overload (up to 30 pts) - weight trending up over time
    // 3. Lift Variety (up to 20 pts) - hitting different movement patterns

    let strengthScore = 0;

    // 1. PR Achievement (50 pts max) - the core of strength progress
    const liftPRs = recentLifts.filter(l => {
      const olderLifts = liftData.filter(
        ol => ol.liftTitle === l.liftTitle && ol.date?.toMillis() < l.date?.toMillis()
      );
      const previousMax = olderLifts.length > 0 ? Math.max(...olderLifts.map(ol => ol.weight)) : 0;
      return l.weight > previousMax && previousMax > 0;
    });
    const prPoints = Math.min(50, liftPRs.length * 10); // Each PR worth 10 pts, max 50
    strengthScore += prPoints;

    // 2. Progressive Overload (30 pts max) - are lifts trending upward?
    const liftsByName = new Map<string, LiftRecord[]>();
    recentLifts.forEach(l => {
      const name = l.liftTitle || "Unknown";
      if (!liftsByName.has(name)) liftsByName.set(name, []);
      liftsByName.get(name)!.push(l);
    });

    let progressingLifts = 0;
    let totalTrackedLifts = 0;
    liftsByName.forEach((records) => {
      if (records.length >= 2) {
        totalTrackedLifts++;
        records.sort((a, b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));
        const firstHalf = records.slice(0, Math.floor(records.length / 2));
        const secondHalf = records.slice(Math.floor(records.length / 2));
        const firstAvg = firstHalf.reduce((sum, r) => sum + r.weight, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, r) => sum + r.weight, 0) / secondHalf.length;
        if (secondAvg > firstAvg) progressingLifts++;
      }
    });
    const progressionRate = totalTrackedLifts > 0 ? progressingLifts / totalTrackedLifts : 0;
    strengthScore += Math.round(progressionRate * 30);

    // 3. Lift Variety (20 pts max) - well-rounded strength training
    const uniqueLifts = new Set(recentLifts.map(l => l.liftTitle)).size;
    const varietyPoints = Math.min(20, uniqueLifts * 4);
    strengthScore += varietyPoints;

    strengthScore = Math.min(100, Math.round(strengthScore));

    // ========== CONDITIONING SCORE (0-100) ==========
    // Pure performance metrics - no attendance/consistency factors
    // 1. RX Progression (up to 40 pts) - doing workouts as prescribed
    // 2. Time/Score Improvements (up to 40 pts) - getting faster/better
    // 3. Workout Variety (up to 20 pts) - different types of WODs

    let conditioningScore = 0;

    // 1. RX Progression (40 pts max) - scaling progression is key
    const rxWods = recentWods.filter(w => (w.notes || w.category) === "RX");
    const rxRatio = recentWods.length > 0 ? rxWods.length / recentWods.length : 0;
    conditioningScore += Math.round(rxRatio * 40);

    // 2. Time/Score Improvements (40 pts max) - compare repeated WODs
    const wodsByTitle = new Map<string, WodRecord[]>();
    recentWods.forEach(w => {
      if (w.wodTitle) {
        if (!wodsByTitle.has(w.wodTitle)) wodsByTitle.set(w.wodTitle, []);
        wodsByTitle.get(w.wodTitle)!.push(w);
      }
    });

    let totalImprovement = 0;
    let improvementCount = 0;
    wodsByTitle.forEach(records => {
      if (records.length >= 2) {
        records.sort((a, b) => (a.completedDate?.toMillis() || 0) - (b.completedDate?.toMillis() || 0));
        // For Time workouts - lower is better
        if (records[0].timeInSeconds && records[records.length - 1].timeInSeconds) {
          const firstTime = records[0].timeInSeconds;
          const lastTime = records[records.length - 1].timeInSeconds;
          if (firstTime > 0 && lastTime < firstTime) {
            const improvement = ((firstTime - lastTime) / firstTime) * 100;
            totalImprovement += improvement;
            improvementCount++;
          }
        }
        // For AMRAP workouts - higher rounds is better
        if (records[0].rounds !== undefined && records[records.length - 1].rounds !== undefined) {
          const firstRounds = records[0].rounds + (records[0].reps || 0) / 100;
          const lastRounds = records[records.length - 1].rounds! + (records[records.length - 1].reps || 0) / 100;
          if (firstRounds > 0 && lastRounds > firstRounds) {
            const improvement = ((lastRounds - firstRounds) / firstRounds) * 100;
            totalImprovement += improvement;
            improvementCount++;
          }
        }
      }
    });
    const avgImprovement = improvementCount > 0 ? totalImprovement / improvementCount : 0;
    // 10% improvement = full 40 pts
    conditioningScore += Math.min(40, Math.round(avgImprovement * 4));

    // 3. Workout Variety (20 pts max) - different WODs
    const uniqueWods = new Set(recentWods.map(w => w.wodTitle)).size;
    conditioningScore += Math.min(20, uniqueWods * 2);

    conditioningScore = Math.min(100, Math.round(conditioningScore));

    // ========== CONSISTENCY SCORE (0-100) ==========
    // Components:
    // 1. Weekly Attendance (up to 40 pts) - showing up regularly
    // 2. Streak Bonus (up to 25 pts) - consecutive weeks with activity
    // 3. Gap Penalty (up to -20 pts) - penalize long breaks
    // 4. Activity Spread (up to 35 pts) - not cramming all workouts in one day

    let consistencyScore = 0;

    // Get all activity dates
    const allActivityDates = [
      ...recentLifts.map(l => l.date?.toMillis() || 0),
      ...recentWods.map(w => w.completedDate?.toMillis() || 0),
      ...recentSkills.map(s => s.date?.toMillis() || 0)
    ].filter(d => d > 0).sort((a, b) => a - b);

    // 1. Weekly Attendance (40 pts max) - based on activities per week
    const totalActivities = recentLifts.length + recentWods.length + recentSkills.length;
    const activitiesPerWeek = totalActivities / weeks;
    // 4-6 activities/week is ideal (80-100%), scale down from there
    if (activitiesPerWeek >= 4) {
      consistencyScore += Math.min(40, 30 + (activitiesPerWeek * 2));
    } else {
      consistencyScore += Math.round(activitiesPerWeek * 10);
    }

    // 2. Streak Bonus (25 pts max) - consecutive weeks with at least 2 activities
    if (allActivityDates.length >= 2) {
      const weekBuckets = new Map<number, number>();
      allActivityDates.forEach(date => {
        const weekNum = Math.floor(date / (7 * 24 * 60 * 60 * 1000));
        weekBuckets.set(weekNum, (weekBuckets.get(weekNum) || 0) + 1);
      });

      const weekNumbers = Array.from(weekBuckets.keys()).sort((a, b) => a - b);
      let currentStreak = 0;
      let maxStreak = 0;

      for (let i = 0; i < weekNumbers.length; i++) {
        const count = weekBuckets.get(weekNumbers[i]) || 0;
        if (count >= 2) {
          if (i === 0 || weekNumbers[i] - weekNumbers[i - 1] === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      consistencyScore += Math.min(25, maxStreak * 5); // 5 pts per week streak
    }

    // 3. Gap Penalty (up to -20 pts) - penalize gaps > 7 days
    if (allActivityDates.length >= 2) {
      let maxGap = 0;
      for (let i = 1; i < allActivityDates.length; i++) {
        const gap = (allActivityDates[i] - allActivityDates[i - 1]) / (24 * 60 * 60 * 1000);
        maxGap = Math.max(maxGap, gap);
      }
      if (maxGap > 14) {
        consistencyScore -= Math.min(20, Math.round((maxGap - 7) * 1.5));
      } else if (maxGap > 7) {
        consistencyScore -= Math.round((maxGap - 7) * 1);
      }
    }

    // 4. Activity Spread (35 pts max) - activities spread across different days
    const uniqueDays = new Set(allActivityDates.map(d => Math.floor(d / (24 * 60 * 60 * 1000)))).size;
    const spreadRatio = totalActivities > 0 ? uniqueDays / totalActivities : 0;
    // Perfect spread (1 activity per day) = 35 pts, cramming = fewer pts
    consistencyScore += Math.round(spreadRatio * 35);

    consistencyScore = Math.max(0, Math.min(100, Math.round(consistencyScore)));

    // ========== OVERALL SCORE ==========
    // Weighted average with slight bonus for balance
    const baseScore = (strengthScore * 0.33) + (conditioningScore * 0.33) + (consistencyScore * 0.34);

    // Balance bonus: if all three scores are within 20 pts of each other, add up to 5 pts
    const scoreRange = Math.max(strengthScore, conditioningScore, consistencyScore) -
                       Math.min(strengthScore, conditioningScore, consistencyScore);
    const balanceBonus = scoreRange <= 20 ? Math.round((20 - scoreRange) / 4) : 0;

    const overallScore = Math.min(100, Math.round(baseScore + balanceBonus));

    setOverallProgress({
      strengthScore,
      conditioningScore,
      consistencyScore,
      overallScore
    });
  };

  const generateAIAnalysis = async () => {
    if (!hasAICoach || isLoadingAI) return;
    setIsLoadingAI(true);
    setAiAnalysis(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setAiAnalysis("AI service not configured.");
        return;
      }

      // Build summary for AI
      let summary = `ATHLETE PROGRESS ANALYSIS (Last ${selectedTimeRange} days)\n\n`;

      if (overallProgress) {
        summary += `OVERALL SCORES:\n`;
        summary += `- Strength Score: ${overallProgress.strengthScore}/100\n`;
        summary += `- Conditioning Score: ${overallProgress.conditioningScore}/100\n`;
        summary += `- Consistency Score: ${overallProgress.consistencyScore}/100\n`;
        summary += `- Overall Score: ${overallProgress.overallScore}/100\n\n`;
      }

      if (liftStats.length > 0) {
        summary += `TOP LIFTS:\n`;
        liftStats.slice(0, 5).forEach(lift => {
          summary += `- ${lift.liftName}: ${lift.currentMax}lb (${lift.percentChange > 0 ? '+' : ''}${lift.percentChange.toFixed(1)}% from previous period, ${lift.totalSessions} sessions)\n`;
        });
        summary += "\n";
      }

      if (wodStats) {
        summary += `WOD STATS:\n`;
        summary += `- Total WODs: ${wodStats.totalWods}\n`;
        summary += `- RX Rate: ${wodStats.rxPercentage.toFixed(0)}%\n`;
        summary += `- Weekly Average: ${wodStats.weeklyAverage.toFixed(1)} workouts/week\n`;
        summary += `- Time Improvement: ${wodStats.avgTimeImprovement > 0 ? '+' : ''}${wodStats.avgTimeImprovement.toFixed(1)}%\n\n`;
      }

      if (skillStats.length > 0) {
        summary += `SKILLS PROGRESS:\n`;
        skillStats.slice(0, 5).forEach(skill => {
          summary += `- ${skill.skillName}: ${skill.currentMax} reps (${skill.percentChange > 0 ? '+' : ''}${skill.percentChange.toFixed(1)}% from previous period, ${skill.totalSessions} sessions)\n`;
        });
        summary += "\n";
      }

      if (user?.aiCoachPreferences?.goals) {
        summary += `ATHLETE'S GOALS: ${user.aiCoachPreferences.goals}\n\n`;
      }

      if (user?.aiCoachPreferences?.injuries) {
        summary += `INJURIES/LIMITATIONS: ${user.aiCoachPreferences.injuries}\n\n`;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `You are an experienced CrossFit coach analyzing an athlete's progress data.

${summary}

Provide a comprehensive analysis in this EXACT format:

**PROGRESS SUMMARY:**
A 2-3 sentence overview of their overall progress and what stands out.

**STRENGTHS:**
- List 2-3 specific things they're doing well based on the data (include lifts, WODs, and skills)

**AREAS FOR IMPROVEMENT:**
- List 2-3 specific areas where they could improve (strength, conditioning, skills, consistency), with actionable advice

**RECOMMENDATIONS:**
Based on the data, give 3 specific recommendations for the next ${selectedTimeRange === "30" ? "month" : selectedTimeRange === "90" ? "3 months" : selectedTimeRange === "180" ? "6 months" : "year"}:
1. [Specific goal with numbers if possible]
2. [Specific goal with numbers if possible]
3. [Specific goal with numbers if possible]

${user?.aiCoachPreferences?.goals ? `**GOAL ALIGNMENT:**\nHow their current progress aligns with their stated goal: "${user.aiCoachPreferences.goals}"` : ""}

Be specific, use their actual numbers, and be encouraging but honest. Keep it concise.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      setAiAnalysis(response.text());

    } catch (err) {
      console.error("Error generating AI analysis:", err);
      setAiAnalysis("Sorry, I couldn't generate the analysis right now. Please try again.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  if (loading || switching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Progress Tracking</h1>
          <p className="text-sm text-gray-500">Track your fitness journey over time</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(["30", "90", "180", "365"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTimeRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {range === "30" ? "30 Days" : range === "90" ? "90 Days" : range === "180" ? "6 Months" : "1 Year"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Overall Progress Card */}
            {overallProgress && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ScoreCard label="Strength" score={overallProgress.strengthScore} color="purple" />
                  <ScoreCard label="Conditioning" score={overallProgress.conditioningScore} color="orange" />
                  <ScoreCard label="Consistency" score={overallProgress.consistencyScore} color="green" />
                  <ScoreCard label="Overall" score={overallProgress.overallScore} color="blue" highlight />
                </div>
              </div>
            )}

            {/* Lift Progress */}
            {liftStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Lift Progress</h2>
                <div className="space-y-3">
                  {liftStats.map((lift) => (
                    <div key={lift.liftName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{lift.liftName}</p>
                        <p className="text-sm text-gray-500">{lift.totalSessions} sessions logged</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{lift.currentMax} lb</p>
                        <p className={`text-sm ${
                          lift.trend === "up" ? "text-green-600" :
                          lift.trend === "down" ? "text-red-600" : "text-gray-500"
                        }`}>
                          {lift.trend === "up" && "↑ "}
                          {lift.trend === "down" && "↓ "}
                          {lift.percentChange > 0 ? "+" : ""}{lift.percentChange.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Progress */}
            {skillStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills Progress</h2>
                <div className="space-y-3">
                  {skillStats.map((skill) => (
                    <div key={skill.skillName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{skill.skillName}</p>
                        <p className="text-sm text-gray-500">{skill.totalSessions} sessions logged</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{skill.currentMax} reps</p>
                        <p className={`text-sm ${
                          skill.trend === "up" ? "text-green-600" :
                          skill.trend === "down" ? "text-red-600" : "text-gray-500"
                        }`}>
                          {skill.trend === "up" && "↑ "}
                          {skill.trend === "down" && "↓ "}
                          {skill.percentChange > 0 ? "+" : ""}{skill.percentChange.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WOD Stats */}
            {wodStats && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">WOD Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total WODs" value={wodStats.totalWods.toString()} />
                  <StatCard label="RX Rate" value={`${wodStats.rxPercentage.toFixed(0)}%`} />
                  <StatCard label="Weekly Avg" value={wodStats.weeklyAverage.toFixed(1)} />
                  <StatCard
                    label="Time Improvement"
                    value={`${wodStats.avgTimeImprovement > 0 ? "+" : ""}${wodStats.avgTimeImprovement.toFixed(1)}%`}
                    highlight={wodStats.avgTimeImprovement > 0}
                  />
                </div>
              </div>
            )}

            {/* No Data Message */}
            {lifts.length === 0 && wods.length === 0 && skills.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Yet</h3>
                <p className="text-gray-500">Start logging your lifts, WODs, and skills to see your progress over time!</p>
              </div>
            )}

            {/* Data exists but no stats calculated - try longer time range */}
            {(lifts.length > 0 || wods.length > 0 || skills.length > 0) && !overallProgress && !wodStats && liftStats.length === 0 && skillStats.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h3 className="font-medium text-yellow-800 mb-2">No activity in selected time range</h3>
                <p className="text-sm text-yellow-700">
                  You have {lifts.length} lift records, {wods.length} WOD records, and {skills.length} skill records total,
                  but none in the last {selectedTimeRange} days. Try selecting a longer time range above.
                </p>
              </div>
            )}

            {/* AI Analysis Section */}
            {hasAICoach && (lifts.length > 0 || wods.length > 0 || skills.length > 0) && (
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold">AI Coach Analysis</h3>
                      <p className="text-white/70 text-sm">Personalized insights from your AI coach</p>
                    </div>
                  </div>
                </div>

                {!aiAnalysis ? (
                  <button
                    onClick={generateAIAnalysis}
                    disabled={isLoadingAI}
                    className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoadingAI ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing your progress...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Get AI Progress Analysis
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-sm text-white/90 whitespace-pre-line">
                      {aiAnalysis.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={i} className="font-bold text-white mt-4 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                        }
                        return line ? <p key={i} className="mt-1">{line}</p> : null;
                      })}
                    </div>
                    <button
                      onClick={generateAIAnalysis}
                      disabled={isLoadingAI}
                      className="mt-4 text-sm text-white/60 hover:text-white/80 flex items-center gap-1"
                    >
                      {isLoadingAI ? (
                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      Regenerate Analysis
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade CTA for non-AI Coach users */}
            {!hasAICoach && (lifts.length > 0 || wods.length > 0 || skills.length > 0) && (
              <div className="bg-gray-100 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Want AI-Powered Insights?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Upgrade to AI Coach for personalized analysis of your progress and recommendations.
                </p>
                <button
                  onClick={() => router.push("/subscribe")}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Learn More
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Helper Components
function ScoreCard({ label, score, color, highlight }: { label: string; score: number; color: string; highlight?: boolean }) {
  const colorClasses = {
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700"
  };

  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>
      <p className={`text-sm ${highlight ? 'text-blue-100' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>{score}</p>
      <div className={`mt-2 h-2 rounded-full ${highlight ? 'bg-blue-400' : 'bg-gray-200'}`}>
        <div
          className={`h-full rounded-full transition-all ${highlight ? 'bg-white' : colorClasses[color as keyof typeof colorClasses].split(' ')[0].replace('100', '500')}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
