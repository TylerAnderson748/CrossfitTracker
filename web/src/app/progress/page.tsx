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
  category: string;
  completedDate: Timestamp;
}

interface SkillRecord {
  id: string;
  skillName: string;
  reps?: number;
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

      // Fetch skill logs (sort in JS to avoid needing composite index)
      const skillQuery = query(
        collection(db, "skillLogs"),
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

  const calculateWodStats = (wodData: WodRecord[], startDate: Timestamp) => {
    const recentWods = wodData.filter(w => w.completedDate.toMillis() >= startDate.toMillis());

    if (recentWods.length === 0) {
      setWodStats(null);
      return;
    }

    // RX percentage
    const rxWods = recentWods.filter(w => w.category === "RX");
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
    const recentLifts = liftData.filter(l => l.date.toMillis() >= startDate.toMillis());
    const recentWods = wodData.filter(w => w.completedDate.toMillis() >= startDate.toMillis());
    const recentSkills = skillData.filter(s => s.date.toMillis() >= startDate.toMillis());

    // Strength score: based on number of PRs and consistency
    const liftPRs = recentLifts.filter(l => {
      const olderLifts = liftData.filter(
        ol => ol.liftTitle === l.liftTitle && ol.date.toMillis() < l.date.toMillis()
      );
      const previousMax = olderLifts.length > 0 ? Math.max(...olderLifts.map(ol => ol.weight)) : 0;
      return l.weight > previousMax;
    });
    const strengthScore = Math.min(100, (liftPRs.length * 10) + (recentLifts.length * 2));

    // Conditioning score: based on WOD volume and RX percentage
    const rxWods = recentWods.filter(w => w.category === "RX");
    const rxRatio = recentWods.length > 0 ? rxWods.length / recentWods.length : 0;
    const conditioningScore = Math.min(100, (recentWods.length * 5) + (rxRatio * 50));

    // Consistency score: based on total activity
    const days = parseInt(selectedTimeRange);
    const totalActivities = recentLifts.length + recentWods.length + recentSkills.length;
    const activitiesPerWeek = totalActivities / (days / 7);
    const consistencyScore = Math.min(100, activitiesPerWeek * 15);

    // Overall score: weighted average
    const overallScore = (strengthScore * 0.35) + (conditioningScore * 0.35) + (consistencyScore * 0.3);

    setOverallProgress({
      strengthScore: Math.round(strengthScore),
      conditioningScore: Math.round(conditioningScore),
      consistencyScore: Math.round(consistencyScore),
      overallScore: Math.round(overallScore)
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
- List 2-3 specific things they're doing well based on the data

**AREAS FOR IMPROVEMENT:**
- List 2-3 specific areas where they could improve, with actionable advice

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
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
            {lifts.length === 0 && wods.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Yet</h3>
                <p className="text-gray-500">Start logging your lifts and WODs to see your progress over time!</p>
              </div>
            )}

            {/* AI Analysis Section */}
            {hasAICoach && (lifts.length > 0 || wods.length > 0) && (
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
            {!hasAICoach && (lifts.length > 0 || wods.length > 0) && (
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

      <Navigation />
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
