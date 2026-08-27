"use client";

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, getDoc, setDoc, limit, Timestamp, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AIProgrammingSession, AIChatMessage, AIGeneratedDay, AIProgrammingPreferences, AITrainerSubscription, TrainingEvent, TrainingEventType, WeekdayKey, AICoachPreferences, PlanRow, PlanRowComponent, TrainingPlan, workoutComponentColors, workoutComponentLabels, cardioActivityForComponent, hasAIProgramming, inferScoringType, rpeToPercentEffort, effortValueToPercent, PRICING } from "@/lib/types";
import { getAllSkills, getAllLifts, getAllWods } from "@/lib/workoutData";
import { chatCompletion, REVISION_MODEL, PLAN_MODEL } from "@/lib/ai";
import { computeBaselineStatus, buildBaselinePromptBlock, buildBaselineWeek, BaselineStatusInput, BaselineCategory } from "@/lib/baselines";
import BaselineWizard from "./BaselineWizard";
import AITrainerPaywall from "./AITrainerPaywall";
import PlanTable from "./PlanTable";

// Get preset workout names for the AI prompt
const getPresetSkillNames = () => getAllSkills().map(s => s.name);
const getPresetLiftNames = () => getAllLifts().map(l => l.name);
const getPresetWodNames = () => getAllWods().map(w => w.name);

// Default preferences
const defaultPreferences: Omit<AIProgrammingPreferences, "userId" | "updatedAt"> = {
  trainingStyle: "crossfit",
  trainingEnvironment: "home",
  philosophy: "",
  equipment: "",
  events: [],
  weeklySchedule: {},
  longRunDay: "",
  restDaysPerWeek: 0,
  workoutDuration: "varied",
  benchmarkFrequency: "sometimes",
  programmingStyle: "",
  additionalRules: "",
};

const WEEKDAYS: { key: WeekdayKey; label: string; full: string }[] = [
  { key: "monday", label: "Mon", full: "Monday" },
  { key: "tuesday", label: "Tue", full: "Tuesday" },
  { key: "wednesday", label: "Wed", full: "Wednesday" },
  { key: "thursday", label: "Thu", full: "Thursday" },
  { key: "friday", label: "Fri", full: "Friday" },
  { key: "saturday", label: "Sat", full: "Saturday" },
  { key: "sunday", label: "Sun", full: "Sunday" },
];

const RACE_DISTANCES = ["5K", "10K", "Half Marathon", "Marathon", "Ultra", "Other distance"];

// Outline of a long-range training plan (generated week by week)
interface ProgramOutlineWeek {
  weekNumber: number;
  startDate: string;
  focus: string;
  details?: string;
}

interface ProgramOutline {
  startDate: string;
  endDate: string;
  weeks: ProgramOutlineWeek[];
  phases?: { name?: string; phase?: string; weeks?: string; goal?: string }[];
}

// Strip markdown code fences from an AI JSON response
function cleanJsonText(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

// Models sometimes emit raw newlines/tabs inside JSON strings (invalid JSON)
// and trailing commas - escape/strip them so JSON.parse can succeed
function normalizeJsonText(text: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') { inStr = false; out += c; continue; }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { continue; }
      if (c === "\t") { out += "\\t"; continue; }
      out += c;
      continue;
    }
    if (c === '"') inStr = true;
    out += c;
  }
  // Remove trailing commas before } or ]
  return out.replace(/,\s*([}\]])/g, "$1");
}

// Parse an AI JSON response, repairing truncated output when possible.
// Returns null only if the text can't be salvaged at all.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParseJson(text: string): any | null {
  const cleaned = normalizeJsonText(cleanJsonText(text));
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to repair
  }

  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const body = cleaned.slice(start);

  // Walk back through candidate cut points (each closing brace), balance the
  // brackets from the start, close whatever is still open, and try to parse.
  let attempts = 0;
  for (let end = body.lastIndexOf("}"); end > 0 && attempts < 120; end = body.lastIndexOf("}", end - 1), attempts++) {
    const candidate = body.slice(0, end + 1);
    let inStr = false;
    let esc = false;
    let broken = false;
    const stack: string[] = [];
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") {
        const need = stack.pop();
        if (need !== c) { broken = true; break; }
      }
    }
    if (broken || inStr) continue;
    try {
      return JSON.parse(candidate + stack.reverse().join(""));
    } catch {
      // keep trimming back
    }
  }
  return null;
}

// Keep only the most recent generated program in the saved session so long
// programs stay well under Firestore's 1MB document limit
function stripOldWorkouts(messages: AIChatMessage[]): AIChatMessage[] {
  const lastWithWorkouts = [...messages].reverse().find(m => m.generatedWorkouts && m.generatedWorkouts.length > 0);
  return messages.map(m => {
    if (m === lastWithWorkouts || !m.generatedWorkouts) return m;
    const rest = { ...m };
    delete rest.generatedWorkouts;
    return rest;
  });
}

// Deterministic calendar math - never trust the model with date -> weekday conversions
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayNameForDate(dateStr: string): string {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return "";
  return WEEKDAY_NAMES[new Date(y, m - 1, d, 12).getDay()];
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Week number of a date within a plan: 7-day windows anchored at the plan's first day
function weekNumberForDate(startDate: string, date: string): number {
  const [sy, sm, sd] = String(startDate).split("-").map(Number);
  const [y, m, d] = String(date).split("-").map(Number);
  if (!sy || !y) return 1;
  const s = new Date(sy, sm - 1, sd, 12).getTime();
  const t = new Date(y, m - 1, d, 12).getTime();
  return Math.max(1, Math.floor(Math.round((t - s) / 86400000) / 7) + 1);
}

const WEEKDAY_KEY_BY_NAME: Record<string, WeekdayKey> = {
  Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday", Thursday: "thursday",
  Friday: "friday", Saturday: "saturday", Sunday: "sunday",
};

// The exact calendar dates a given outline week covers (shared by the prompt
// builder and the week validator so they can never disagree)
function datesForWeek(outline: ProgramOutline, week: ProgramOutlineWeek): string[] {
  const nextWeek = outline.weeks.find(w => w.weekNumber === week.weekNumber + 1);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDaysToDateString(week.startDate, i);
    if (ds > outline.endDate) break;
    if (nextWeek && ds >= nextWeek.startDate) break;
    dates.push(ds);
  }
  return dates;
}

// Coerce an AI-produced row into a clean PlanRow (Firestore rejects undefined)
const VALID_COMPONENT_TYPES = ["warmup", "wod", "lift", "skill", "run", "swim", "bike_mtb", "bike_road", "row", "cardio", "class", "cooldown"];

function sanitizePlanRow(r: Partial<PlanRow>, fallbackWeek: number, fallbackPhase: string): PlanRow {
  const row: PlanRow = {
    date: String(r.date || ""),
    // Always derive the day name from the date - models get weekday math wrong
    day: dayNameForDate(String(r.date || "")) || String(r.day || ""),
    week: Number(r.week) || fallbackWeek,
    phase: String(r.phase || fallbackPhase),
    session: String(r.session || "Training"),
    detail: String(r.detail || ""),
    runMiles: Number(r.runMiles) || 0,
    targetRPE: String(r.targetRPE || ""),
    estMinutes: Number(r.estMinutes) || 0,
  };
  if (r.reason) row.reason = String(r.reason);
  // Rest days carry no training components (light mobility/cooldown is fine) -
  // the model sometimes emits a "Full Rest Day" WOD component
  if (/\brest\b/i.test(row.session) && Array.isArray(r.components)) {
    r = { ...r, components: r.components.filter(c => String(c?.type) === "cooldown") };
    if (!row.detail) row.detail = "Full rest day";
  }
  if (Array.isArray(r.components) && r.components.length > 0) {
    row.components = r.components.map(c => {
      let type = (VALID_COMPONENT_TYPES.includes(String(c?.type)) ? String(c?.type) : "wod") as PlanRowComponent["type"];
      const title = String(c?.title || "Training").slice(0, 60);
      // Older plans stored runs/cardio as "wod"/"cardio" components titled "Run"/"Cardio" etc.,
      // and gym classes as "lift"/"wod" components titled "... Class"
      if (type === "cardio" || (type === "wod" && /^(run|cardio|swim|bike|row|ruck)$/i.test(title.trim()))) {
        type = cardioActivityForComponent("cardio", title) || "run";
      }
      if ((type === "wod" || type === "lift") && /\bclass\b/i.test(title)) type = "class";
      return { type, title, description: String(c?.description || "") };
    });
    if (!row.detail) {
      row.detail = row.components.map(c => `${c.title}: ${c.description}`).join(" • ");
    }
  }
  return row;
}

// Compact text form of the plan table for prompts
function serializePlanRows(rows: PlanRow[]): string {
  return rows
    .map(r => [r.date, r.day, `wk${r.week}`, r.phase, r.session, r.runMiles || 0, r.targetRPE || "-", r.estMinutes || 0, (r.detail || "").replace(/\n/g, " / ")].join("|"))
    .join("\n");
}

interface AIProgrammingChatProps {
  userId: string;
  userEmail?: string;
  onPublish?: () => void;
  subscription?: AITrainerSubscription;
  // The athlete's profile from their Oddo settings (goals, injuries, experience)
  athleteProfile?: AICoachPreferences;
  // Deep-link support: open a specific session with a pre-filled request (e.g., regenerate a day)
  initialSessionId?: string;
  initialPrompt?: string;
}

// Build the athlete-profile prompt section (goals, injuries, experience)
function buildProfileSection(athleteProfile?: AICoachPreferences): string {
  if (!athleteProfile) return "";
  const lines: string[] = [];
  if (athleteProfile.goals) lines.push(`- Goals: ${athleteProfile.goals}`);
  if (athleteProfile.injuries) lines.push(`- INJURIES/LIMITATIONS (CRITICAL - NEVER program movements that could aggravate these; always substitute safe alternatives): ${athleteProfile.injuries}`);
  if (athleteProfile.experienceLevel) lines.push(`- Experience level: ${athleteProfile.experienceLevel}`);
  if (athleteProfile.focusAreas && athleteProfile.focusAreas.length > 0) lines.push(`- Focus areas: ${athleteProfile.focusAreas.join(", ")}`);
  return lines.length > 0 ? `\nATHLETE PROFILE:\n${lines.join("\n")}\n` : "";
}

function buildPreferencesSection(preferences?: Omit<AIProgrammingPreferences, "userId" | "updatedAt">): string {
  // Build athlete preferences section
  let athletePreferencesSection = "";
  if (preferences) {
    const prefParts: string[] = [];

    if ((preferences.trainingStyle || "crossfit") === "general") {
      prefParts.push(`TRAINING STYLE: GENERAL GYM TRAINING - this athlete does NOT do CrossFit. Program conventional strength training and cardio: structured sessions (e.g., upper/lower or push/pull/legs splits), straight sets x reps with prescribed rest, dumbbell/barbell/machine/cable work as available, plus cardio matched to their goals. Do NOT program CrossFit-style WODs, benchmark workouts (Fran etc.), AMRAPs/EMOMs, Olympic-lift complexes, or CrossFit jargon unless the athlete explicitly asks. Simple conditioning finishers/circuits are fine when they fit the athlete's goals. Ignore any CrossFit-specific conventions elsewhere in these instructions (benchmark lists, creative WOD naming).`);
    }

    if (preferences.philosophy) {
      prefParts.push(`Training Philosophy/Goals: ${preferences.philosophy}`);
    }

    if ((preferences.trainingEnvironment || "home") === "commercial") {
      prefParts.push(`TRAINING LOCATION: COMMERCIAL GYM - assume full standard equipment is available: barbells, racks, benches, full dumbbell range, machines, cables, and cardio machines (treadmill, bike, rower).${preferences.equipment ? ` Notes about their gym: ${preferences.equipment}` : ""}`);
    } else if (preferences.equipment) {
      prefParts.push(`Available Equipment (garage/home gym): ${preferences.equipment}\nHARD CONSTRAINT for every home training day: ONLY program movements this equipment supports. If no barbell/rack/plates are listed, NEVER program barbell lifts at home (back squat, deadlift, bench, barbell cleans/snatches, etc.) - not even with the athlete's PRs as justification; PRs from a gym do not mean the equipment exists at home. Substitute dumbbell/kettlebell/sandbag versions instead. Barbell work belongs only on class days.`);
    }

    const eventsWithDates = (preferences.events || []).filter(e => e.date);
    if (eventsWithDates.length > 0) {
      const eventLines = eventsWithDates.map(e => {
        const label = e.type === "running_race"
          ? `Running race${e.detail ? ` (${e.detail})` : ""}`
          : e.type === "crossfit_comp"
          ? "CrossFit competition"
          : `Event${e.detail ? ` (${e.detail})` : ""}`;
        return `- ${label}${e.name ? `: "${e.name}"` : ""} on ${e.date}`;
      });
      const hasRace = eventsWithDates.some(e => e.type === "running_race");
      const longRunLine = hasRace && preferences.longRunDay
        ? `\n- Schedule the weekly LONG RUN on ${preferences.longRunDay.charAt(0).toUpperCase() + preferences.longRunDay.slice(1)} every week.`
        : "";
      prefParts.push(`EVENTS THE ATHLETE IS TRAINING FOR (CRITICAL - build the entire plan around these):\n${eventLines.join("\n")}\n- Structure phases (base -> build -> peak -> taper) around each event and put the event day itself on the calendar.${hasRace ? "\n- The running race REQUIRES real run training as standalone workouts: a weekly long run that builds progressively, easy runs, and race-pace work, each with distance and pacing guidance." : ""}${longRunLine}`);
    }

    const schedule = preferences.weeklySchedule || {};
    const scheduleLines: string[] = [];
    const dayNames: Record<string, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };
    for (const key of Object.keys(dayNames)) {
      const setting = schedule[key as keyof typeof schedule];
      if (!setting) continue;
      if (setting.mode === "open") {
        if (setting.maxMinutes && setting.maxMinutes > 0) {
          scheduleLines.push(`- ${dayNames[key]}: total training time (including warmup) must stay under ${setting.maxMinutes} minutes`);
        }
        continue;
      }
      if (setting.mode === "rest") {
        scheduleLines.push(`- ${dayNames[key]}: COMPLETE REST DAY every week - always program rest`);
      } else {
        const desc = setting.classDescription || "a class at their gym";
        if ((setting.classAttendance || "always") === "optional") {
          const timeBudget = setting.maxMinutes && setting.maxMinutes > 0
            ? ` If you program training instead of the class, the full session (including warmup) must stay under ${setting.maxMinutes} minutes.`
            : "";
          scheduleLines.push(`- ${dayNames[key]}: CLASS AVAILABLE - ${desc}. YOU decide each week and COMMIT to exactly one prescription for this day: the class, a specific programmed workout, or rest. NEVER write "optional" or "attend or rest - your call" - the athlete wants to be told exactly what to do. When prescribing the class, add ONE component noting it. A class day is a TRAINING opportunity - do NOT default it to Rest week after week; prescribe rest here only when recovery genuinely demands it that week.${timeBudget}`);
        } else {
          scheduleLines.push(`- ${dayNames[key]}: FIXED CLASS every week - ${desc}. Do NOT program a workout for this day; add ONE component naming the class and nothing more.`);
        }
      }
    }
    if (scheduleLines.length > 0) {
      prefParts.push(`WEEKLY SCHEDULE (NON-NEGOTIABLE - applies to every single week):\n${scheduleLines.join("\n")}\nDays not listed above (and days marked "Train") are AVAILABLE for training - they are NOT all mandatory training days.\nPRECEDENCE: These structured schedule settings are the athlete's CURRENT choices. If anything in the free-text preferences, athlete profile, or earlier conversation conflicts with them (e.g., older statements about which days to train or attend classes), the structured settings above WIN.`);
    }

    const explicitRestDays = Object.values(schedule).filter(d => d?.mode === "rest").length;
    const restTarget = preferences.restDaysPerWeek || 0;
    if (restTarget > 0) {
      const remainder = Math.max(0, restTarget - explicitRestDays);
      prefParts.push(`REST DAYS: The athlete wants ${restTarget} full rest day${restTarget > 1 ? "s" : ""} EVERY week.${explicitRestDays > 0 ? ` ${explicitRestDays} ${explicitRestDays > 1 ? "are" : "is"} fixed in the weekly schedule above.` : ""}${remainder > 0 ? ` Place the other ${remainder} on whichever available day${remainder > 1 ? "s" : ""} best support${remainder > 1 ? "" : "s"} recovery (typically after the hardest sessions).` : ""}`);
    } else {
      prefParts.push(`REST DAYS: Include at least 1 (usually 2) FULL rest days every week unless the athlete explicitly asks for more training. Never program 7 straight training days.`);
    }

    if (preferences.workoutDuration && preferences.workoutDuration !== "varied") {
      const durationMap = {
        short: "shorter workouts (under 15 minutes)",
        medium: "medium-length workouts (15-25 minutes)",
        long: "longer workouts (25+ minutes)",
        varied: "varied workout lengths"
      };
      prefParts.push(`Workout Duration Preference: ${durationMap[preferences.workoutDuration]}`);
    }

    if (preferences.benchmarkFrequency) {
      const freqMap = {
        often: "Program benchmark WODs frequently (1-2 per week)",
        sometimes: "Program benchmark WODs occasionally (1-2 per month)",
        rarely: "Rarely program benchmark WODs - prefer custom workouts"
      };
      prefParts.push(`Benchmark Frequency: ${freqMap[preferences.benchmarkFrequency]}`);
    }

    if (preferences.programmingStyle) {
      prefParts.push(`Programming Style Inspiration: ${preferences.programmingStyle}`);
    }

    if (preferences.additionalRules) {
      prefParts.push(`Additional Rules/Preferences: ${preferences.additionalRules}`);
    }

    if (prefParts.length > 0) {
      athletePreferencesSection = `
ATHLETE PREFERENCES (IMPORTANT - Follow these rules):
${prefParts.join("\n")}

`;
    }
  }
  return athletePreferencesSection;
}

// How odd implements are actually used - shared by plan generation and
// revisions so the coach never programs impossible movements (e.g.,
// back-racking a 150 lb soft sandbag)
const IMPLEMENT_KNOWLEDGE = `SANDBAG & ODD-IMPLEMENT RULES (get these right):
- Heavy soft sandbags (100-150+ lb) cannot be back-racked or stabilized overhead. Their movement library is: bear-hug squats, bear-hug carries, ground-to-shoulder cleans (bag rests on ONE shoulder, stand tall to finish), over-the-shoulder tosses, front-loaded (bear-hug) lunges, shouldered carries and lunges, drags.
- Match the bag to the movement: a heavy bag (100-150 lb) = low-rep whole-body power (cleans, tosses, squats, short carries). Only lighter bags (~40-70 lb) suit high-rep lunges, presses, or long carries.
- If the athlete owns multiple bags or implements of different weights, every prescription names WHICH one ("bear-hug squat with the 150 lb bag", "walking lunges with the 100 lb bag").
- Same principle for all equipment: program only movements the implement is actually designed for - no kettlebell bench press as main strength work, no D-ball back squats, no heavy-sandbag overhead pressing.`;

const getSystemPrompt = (preferences?: Omit<AIProgrammingPreferences, "userId" | "updatedAt">, recentlyUsedWorkouts?: string[]) => {
  // All date strings in LOCAL time - mixing toISOString (UTC) with local weekdays
  // produced day/date mismatches in the evenings
  const today = new Date();
  const localDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = localDateString(today);
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });

  // Calculate upcoming dates for each day of the week
  const getNextDayDate = (targetDay: number) => {
    const date = new Date(today);
    const currentDay = date.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7; // If the day has passed this week, get next week's
    date.setDate(date.getDate() + daysUntil);
    return localDateString(date);
  };

  const upcomingDates = {
    Sunday: getNextDayDate(0),
    Monday: getNextDayDate(1),
    Tuesday: getNextDayDate(2),
    Wednesday: getNextDayDate(3),
    Thursday: getNextDayDate(4),
    Friday: getNextDayDate(5),
    Saturday: getNextDayDate(6),
  };

  // Authoritative date -> weekday mapping for the next 14 days
  const calendarReference = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return `${localDateString(d)} = ${d.toLocaleDateString('en-US', { weekday: 'long' })}`;
  }).join("\n");

  // Determine current season
  const month = today.getMonth();
  let season = "Winter";
  if (month >= 2 && month <= 4) season = "Spring";
  else if (month >= 5 && month <= 7) season = "Summer";
  else if (month >= 8 && month <= 10) season = "Fall";

  // Get preset workout names
  const skillNames = getPresetSkillNames();
  const liftNames = getPresetLiftNames();
  const wodNames = getPresetWodNames();

  const athletePreferencesSection = buildPreferencesSection(preferences);

  // Build recently used workouts section
  let recentlyUsedSection = "";
  if (recentlyUsedWorkouts && recentlyUsedWorkouts.length > 0) {
    recentlyUsedSection = `
CRITICAL - AVOID THESE WORKOUTS (Used in the last 6 months):
The following workouts have been programmed recently and MUST NOT be repeated for at least 6 months:
${recentlyUsedWorkouts.join(", ")}

DO NOT use any of the above workout names. Create NEW, unique workouts instead. This is very important for keeping programming fresh and varied.

`;
  }

  const coachStyle = (preferences?.trainingStyle || "crossfit") === "general" ? "strength & conditioning" : "CrossFit";
  const trainingPlace = (preferences?.trainingEnvironment || "home") === "commercial" ? "a commercial gym" : "their garage or home gym";

  return `You are Oddo, the athlete's personal ${coachStyle} coach, creating workout programming for an individual athlete training in ${trainingPlace}. You ARE their coach - be direct, encouraging, and specific.
${athletePreferencesSection}${recentlyUsedSection}IMPORTANT DATE INFORMATION:
- Today's date is ${todayStr} (${dayOfWeek})
- Current month: ${monthName}
- Current season: ${season}

CALENDAR REFERENCE - the next 14 days (this date = weekday mapping is authoritative; do NOT recompute weekdays yourself):
${calendarReference}

UPCOMING DATES FOR EACH DAY OF THE WEEK (use these EXACT dates):
- Sunday: ${upcomingDates.Sunday}
- Monday: ${upcomingDates.Monday}
- Tuesday: ${upcomingDates.Tuesday}
- Wednesday: ${upcomingDates.Wednesday}
- Thursday: ${upcomingDates.Thursday}
- Friday: ${upcomingDates.Friday}
- Saturday: ${upcomingDates.Saturday}

When the user asks for a specific day (e.g., "Wednesday"), use the corresponding date from above.
When generating multiple days, use the correct date for each day requested.

When generating workouts, you MUST respond with valid JSON in this exact format:
{
  "message": "Your conversational response here explaining the program",
  "workouts": [
    {
      "date": "${todayStr}",
      "dayOfWeek": "${dayOfWeek}",
      "isRestDay": false,
      "components": [
        {
          "type": "warmup",
          "title": "General Warm-up",
          "description": "3 rounds:\\n10 air squats\\n10 push-ups\\n200m run",
          "notes": "Focus on mobility and increasing heart rate gradually. No rest between movements."
        },
        {
          "type": "lift",
          "title": "Back Squat",
          "description": "Build to a heavy set of 5, then:\\n3 x 5 @ 80-85% of today's heavy set\\nRest 2-3 min between sets",
          "notes": "STIMULUS: Build strength with moderate-heavy load. Should feel challenging but controlled.\\n\\nGOAL: Improve 5-rep max capacity. Focus on depth, bracing, and bar speed.\\n\\nSCALED: Reduce weight 10-20% if form breaks down or if newer to back squatting.\\n\\nFOUNDATIONS: Goblet squat with dumbbell/kettlebell. Focus on depth and core stability. 3 x 8-10 reps."
        },
        {
          "type": "skill",
          "title": "Toes-to-Bar",
          "description": "Every 90 sec for 6 rounds:\\n5-8 Toes-to-Bar (or progression)\\n\\nDrill Work (before sets):\\n- 10 kip swings (hollow to arch)\\n- 5 slow knees-to-chest\\n- 5 controlled leg raises",
          "notes": "STIMULUS: Skill development - focus on rhythm, timing, and efficiency, not fatigue.\\n\\nGOAL: Build capacity and consistency in the kipping pattern. Quality over quantity.\\n\\nSCALED: Knees-to-Elbows (same rep scheme). Focus on full extension at bottom.\\n\\nFOUNDATIONS: Hanging knee raises or V-ups on floor. 6 rounds of 8-10 reps.\\n\\nPROGRESSION TIP: Master the kip swing timing before adding leg lift."
        },
        {
          "type": "wod",
          "title": "Fran",
          "description": "21-15-9 For Time:\\nThrusters\\nPull-ups\\n\\nTime Cap: 10 minutes",
          "scoringType": "fortime",
          "notes": "STIMULUS: Sprint effort. This should feel intense from the first rep. Heart rate high, breathing hard.\\n\\nGOAL: Sub-5 elite, sub-7 competitive, sub-10 fitness. Aim for large sets or unbroken if possible.\\n\\nRx: Thrusters 95/65 lb, Kipping Pull-ups\\n\\nSCALED: Thrusters 65/45 lb, Banded Pull-ups or Jumping Pull-ups\\n- For athletes who can do pull-ups but not 45 total\\n- For athletes building toward Rx weights\\n\\nFOUNDATIONS: Thrusters 45/35 lb (or dumbbells 20/15), Ring Rows\\n- For newer athletes still building capacity\\n- Focus on moving well, not moving fast\\n\\nSCORING: Record time and note Rx/Scaled/Foundations. If you modified further, note in comments."
        },
        {
          "type": "cooldown",
          "title": "Recovery",
          "description": "2 rounds:\\n1 min couch stretch each leg\\n1 min pigeon pose each side\\n10 slow cat-cows",
          "notes": "Take your time. Breathe deeply. This is recovery, not a workout."
        }
      ]
    }
  ]
}

Component types: "warmup", "lift", "wod", "skill", "run", "swim", "bike_mtb", "bike_road", "row", "class", "cooldown"
Scoring types for WODs: "fortime", "amrap", "emom"
Use the specific cardio types for pure aerobic work - "run" (also jogging/rucking), "swim", "bike_mtb" (mountain biking), "bike_road" (road/stationary/fan bike), "row" (rowing erg) - steady-state or intervals, with exact distance/time and pace or % effort. Only program swimming, biking, or rowing when the athlete has said they do those or has the equipment. Mixed-modal conditioning pieces (AMRAPs, EMOMs, For Time) stay "wod". Cardio components are exempt from the preset-name rule.
Use "class" when the athlete attends a coached class elsewhere (e.g., "Olympic Lifting Class", "CrossFit Class"). The CLASS COACH decides the content and the athlete scans the whiteboard in afterward, so a class component is ONLY the name: title = the class name, description = "Follow the coach's programming." NOTHING else - no movement suggestions, no focus/technique notes, no effort or intensity guidance, no invented workouts. Class components are exempt from the preset-name rule.

IMPORTANT - PRESET WORKOUTS:
For SKILL components, you MUST ONLY use these preset skill names (do not make up new skills):
${skillNames.join(", ")}

For LIFT components, you MUST ONLY use these preset lift names (do not make up new lifts):
${liftNames.join(", ")}

For WOD components, these are the existing benchmark WODs - you may use these OR create custom themed WODs:
${wodNames.join(", ")}

CREATIVE WOD NAMING:
When creating custom WODs (not benchmarks), be CREATIVE and FUN with names! Use themes based on:
- Current season (${season}): e.g., "Snowstorm", "Summer Sizzle", "Autumn Assault", "Spring Awakening"
- Holidays/events: e.g., "Turkey Burner", "Independence Day Grind", "New Year's Resolution"
- Weather/nature: e.g., "Thunderstorm", "Avalanche", "Heat Wave", "Blizzard"
- Action/intensity: e.g., "The Gauntlet", "Relentless", "Dark Horse", "Redemption"
- Fun themes: e.g., "Monday Mayhem", "Hump Day Hustle", "Friday Finisher", "Weekend Warrior"
- User-requested themes: If the user mentions a theme, event, or preference, incorporate it!

Examples of creative names: "December Destroyer", "Frostbite", "Firebreather", "The Crucible", "Midnight Oil", "Iron Will", "Beast Mode", "No Mercy Monday"

Guidelines:
- Create varied, balanced programming
- EVERY day gets ONE definitive prescription: a workout, a class, or rest. NEVER program "optional" sessions or attend-or-skip choices - decide for the athlete
- "skill" components are ONLY for low-fatigue technique development (e.g., double-under practice, handstand/muscle-up progressions, kipping drills). Conditioning EMOMs/AMRAPs are "wod" even when built around one movement - an EMOM of wall balls is a WOD, not skill work
- Train the athlete's stated weaknesses 1-2x per week using VARIED approaches - do NOT insert the same movement into every session
- Include proper warm-ups and skill work
- Program appropriate rest days (typically 2 per week)
- Time budgets are CAPS, not targets - do not fill every available minute; distribute load across the week and never schedule two maximal days back-to-back
- FATIGUE MANAGEMENT: wave the intensity deliberately. Never stack more than 2 hard days in a row - follow them with an easy day, skill day, or rest, and add an extra rest day after an especially demanding stretch rather than forcing volume. Across weeks, alternate harder and easier weeks within a block and make every 3rd-4th week a genuine deload (volume AND intensity down 30-40%, named as such in the phase). If recent check-ins say sessions felt "very hard", pull the next week's intensity down; if "too easy", nudge it up.
- REST PLACEMENT is anchored to the week's biggest sessions: rest or easy movement goes immediately before AND after the long run / heaviest day whenever the fixed class schedule allows - never a hard metcon or heavy lifting adjacent to a 8+ mile run. A rest day's reason must describe its ACTUAL neighbors: never claim it protects a session when a hard day sits in between - if fixed classes force that layout, say so honestly (e.g., "Thursday is the last open day to rest before Sunday's 17-miler since Saturday's class is fixed").
- Blocks of 6+ weeks: re-test 1-2 of the athlete's baselines most relevant to the block's goal in the final or penultimate week (never race week) so progress is measured, not assumed.
- THIN DATA = NO FAKE PRECISION: prescribe %-of-1RM ONLY for lifts with solid logged data. For lifts marked [ROUGH] or with no data at all, NEVER invent derived rep-maxes or precise adjustments ("~11RM", "8-9% intensity increase") - prescribe by feel ("build to a hard but crisp set of 5 - log it, that becomes your baseline") and make the block's FIRST week establish those baselines explicitly, with later weeks anchored to what gets logged.
- UNKNOWNS: if a movement is central to this plan and you have no data for it, either ask the athlete for a rough number in your ONE clarifying message before generating, or schedule its baseline in week 1 and say so in that day's reason.
- If the athlete is training for a running race: 3-4 run days per week (one long run + easy midweek runs). The long run is its OWN session on its own day - never stacked after a class or metcon
- If the athlete asks for a multi-week program but their weekly availability, goals, or schedule are unknown, ask for those essentials in ONE concise message BEFORE generating - do not guess a schedule for someone you know nothing about
- Scale difficulty based on the athlete's level
- Assume a garage/home gym setup: no fancy machines unless the athlete lists them
${IMPLEMENT_KNOWLEDGE}
EQUIPMENT TRUTH:
- When asked what equipment they own or what you'll program with, QUOTE their saved equipment list VERBATIM - never paraphrase, shorten, or recite from memory, so they can spot anything missing or wrong.
- If the athlete mentions gear that is NOT in their saved list, include "equipmentAdditions": ["item", ...] in your JSON response (alongside message/workouts) - the app saves those to their preferences - then program with them.
- Use standard CrossFit movements and terminology
- Keep descriptions clear and concise
- Use newlines (\\n) for formatting within descriptions
- ALWAYS use real dates starting from ${todayStr} and going forward

IMPORTANT - SKILL WORK REQUIREMENTS:
For SKILL components, NEVER just say "10 minutes of practice" or generic time domains. Instead, ALWAYS include:
1. Specific sets/reps (e.g., "3 sets of 8-10 reps")
2. Drill work with clear exercises (e.g., "10 kip swings, 10 knees-to-chest")
3. Rest periods between sets
4. The description should teach HOW to develop the skill, not just tell them to practice

The notes field for skills MUST include:
- Scaling: 2-3 progressions for different ability levels
- Progression: The path from beginner to mastery
- Intent: What athletes should focus on (quality, rhythm, efficiency, etc.)

- ALWAYS include a "notes" field for each component with:
  * Stimulus: The intended feel/intensity (e.g., "fast and light", "heavy grind")
  * Scaling: Options for different fitness levels
  * Intent: What athletes should focus on or aim for
  * Any other coaching cues or tips
- For skills and lifts, ONLY use the preset names listed above
- For WODs, use benchmark WODs when appropriate, but get CREATIVE with custom WOD names using themes!
- Pay attention to any themes, preferences, or special requests from the user
- If the athlete attends a class elsewhere on fixed days (e.g., an Olympic lifting class at their gym), do NOT program a workout for that day - include ONE component describing the class (type "class", title e.g. "Olympic Lifting Class") with brief notes; class components are exempt from the preset-name rule

IMPORTANT - STIMULUS, GOALS, AND SCALING:
Every workout component MUST have detailed notes with:

1. STIMULUS: What should this feel like? (sprint effort, grinding pace, controlled movement, etc.)
   - Be specific: "Heart rate should stay elevated", "Should feel heavy but controlled", "Breathing hard but recoverable"

2. GOAL: What is this workout trying to achieve?
   - Time targets for For Time workouts (elite/competitive/fitness ranges)
   - Rep targets for AMRAPs
   - Intensity expectations
   - What the athlete should focus on (unbroken sets, pacing, technique, etc.)

3. THREE SCALING LEVELS with clear guidance:
   a) Rx (prescribed): Standard weights and movements with specific expectations
   b) SCALED: Lighter weights OR easier movement variations
      - Include WHO should scale: "For athletes building toward Rx" or "If you can't do 15+ unbroken"
      - Be specific about modifications: exact weights, band colors, etc.
   c) FOUNDATIONS (Beginner): Most accessible option
      - For newer athletes or those with limitations
      - Focus should be on movement quality, not intensity
      - Include alternative equipment if needed (dumbbells instead of barbell)

SCALING WEIGHT EXAMPLES:
- Barbell Clean/Snatch: "Rx: 135/95, Scaled: 95/65, Foundations: 65/45 or PVC/empty bar"
- Thrusters: "Rx: 95/65, Scaled: 65/45, Foundations: 45/35 or DB 20/15"
- Deadlift: "Rx: 225/155, Scaled: 155/105, Foundations: 95/65"
- Kettlebell Swings: "Rx: 53/35, Scaled: 35/26, Foundations: 26/18"
- Wall Balls: "Rx: 20/14 to 10/9ft, Scaled: 14/10 to 9ft, Foundations: 10/6 to 9ft"

SCALING MOVEMENT EXAMPLES:
- Pull-ups: "Rx: Kipping, Scaled: Banded (green/blue) or Jumping, Foundations: Ring Rows"
- Muscle-ups: "Rx: Bar/Ring MU, Scaled: C2B + Dips, Foundations: Pull-ups + Push-ups"
- Handstand Push-ups: "Rx: Strict/Kipping, Scaled: Pike Push-ups (box), Foundations: DB Strict Press"
- Box Jumps: "Rx: 24/20 jump, Scaled: 20/16 jump, Foundations: Step-ups any height"
- Double-Unders: "Rx: DUs, Scaled: 2:1 Singles, Foundations: 3:1 Singles or Penguin Jumps"
- Toes-to-Bar: "Rx: TTB, Scaled: Knees-to-Elbows, Foundations: Hanging Knee Raises or V-ups"

LONG-RANGE PROGRAMS (more than 2 weeks):
If the user asks for programming spanning MORE than 14 days (e.g., "program every day until my marathon", "12 weeks of training"), DO NOT generate the days directly. Instead respond with a week-by-week training plan outline in this exact JSON format:
{
  "message": "Explain the overall plan: the phases, the standard weekly structure, how you're building toward their events, and where the rest days are",
  "outline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "phases": [
      {
        "name": "Build",
        "weeks": "1-3",
        "goal": "One sentence on what this phase accomplishes for THIS athlete, tied to their data and goal (e.g., 'Establish baselines for the unlogged pressing lifts and build squat volume toward the Oct 3 comp')"
      }
    ],
    "weeks": [
      {
        "weekNumber": 1,
        "startDate": "YYYY-MM-DD",
        "focus": "Base building",
        "details": "Which days run/lift/WOD/rest, key sessions, volume targets, fixed commitments like gym classes, and any event that falls in this week"
      }
    ]
  }
}
- startDate is the first training day (today unless they say otherwise); endDate is the final day of the plan (e.g., race day).
- Include one entry per week covering the ENTIRE requested date range - never stop early.
- Build proper phases around any events the user mentions (base -> build -> peak -> taper -> event -> recovery).
- "phases" lists every phase in order with the week range it covers and a one-sentence goal specific to THIS athlete - it's the athlete's map of the whole block.
- Restate the athlete's fixed weekly commitments (classes on specific days) and their rest days in EVERY week's details.
Keep each week's details under 40 words - day-level detail comes later, week by week.\nThe app will then ask you to fill in a day-by-day plan TABLE (one detailed row per day) one week at a time.

If the user is just chatting or asking questions (not requesting workouts), respond with just:
{
  "message": "Your response here",
  "workouts": []
}

IMPORTANT: Always respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;
};

export default function AIProgrammingChat({ userId, userEmail, onPublish, subscription, athleteProfile, initialSessionId, initialPrompt }: AIProgrammingChatProps) {
  // Check if user has an active AI subscription
  const hasActiveSubscription = subscription &&
    (subscription.status === "active" || subscription.status === "trialing");
  const [sessions, setSessions] = useState<AIProgrammingSession[]>([]);
  const [activeSession, setActiveSession] = useState<AIProgrammingSession | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Programming preferences state
  const [preferences, setPreferences] = useState<Omit<AIProgrammingPreferences, "userId" | "updatedAt">>(defaultPreferences);
  const [showSettings, setShowSettings] = useState(false);
  const [preferencesDocId, setPreferencesDocId] = useState<string | null>(null);
  // True once we know whether this user has ever saved preferences
  const [prefsChecked, setPrefsChecked] = useState(false);
  const autoOpenedSetup = useRef(false);
  // Keeps the chat pinned to the newest message instead of making the
  // athlete scroll down past the whole history
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Recently used workouts (last 6 months) - to avoid repetition
  const [recentlyUsedWorkouts, setRecentlyUsedWorkouts] = useState<string[]>([]);

  // Progress while generating a multi-week program
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);

  // Athlete data pulled from their training log (PRs, recent results, existing calendar)
  const [athleteContext, setAthleteContext] = useState<string>("");
  const [baselineRaw, setBaselineRaw] = useState<Omit<BaselineStatusInput, "trainingStyle"> | null>(null);

  useEffect(() => {
    const loadAthleteContext = async () => {
      if (!userId) return;
      try {
        const parts: string[] = [];

        // Lift PRs (best weight per lift + rep count)
        const liftSnap = await getDocs(query(collection(db, "liftResults"), where("userId", "==", userId), limit(150)));
        const bests = new Map<string, number>();
        const countByLift = new Map<string, number>();
        liftSnap.docs.forEach(d => {
          const x = d.data();
          if (x.liftTitle && x.weight) {
            const k = `${x.liftTitle}|${x.reps || 1}`;
            if ((bests.get(k) || 0) < x.weight) bests.set(k, x.weight);
            countByLift.set(x.liftTitle, (countByLift.get(x.liftTitle) || 0) + 1);
          }
        });
        if (bests.size > 0) {
          const lines = Array.from(bests.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([k, w]) => {
              const [title, reps] = k.split("|");
              const n = countByLift.get(title) || 0;
              return `- ${title}: ${w}lb (${reps}RM)${n < 3 ? ` [ROUGH - only ${n} logged ${n === 1 ? "entry" : "entries"}]` : ""}`;
            });
          parts.push(`LIFT PRs - use these to prescribe REAL weights for percentage work (e.g., "165lb - that's 70% of your 235lb 1RM"):\n${lines.join("\n")}\nLifts marked [ROUGH] have too little data for precise math - never derive rep-maxes or percentages from them.\nCAUTION: barbell PRs were likely set at the athlete's gym/class. They do NOT mean the athlete has a barbell at home - the equipment list decides what can be programmed on home days.`);
        }

        // Recent WOD results
        const wodSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", userId), limit(100)));
        const logs = wodSnap.docs.map(d => d.data())
          .filter(x => x.wodTitle)
          .sort((a, b) => (b.completedDate?.toMillis?.() || 0) - (a.completedDate?.toMillis?.() || 0))
          .slice(0, 10);

        // Raw logged names for baseline-battery matching (the standard tests
        // Oddo calibrates from - see lib/baselines.ts)
        const skillSnap = await getDocs(query(collection(db, "skillResults"), where("userId", "==", userId), limit(150)));
        const cardioSnap = await getDocs(query(collection(db, "cardioLogs"), where("userId", "==", userId), limit(150)));
        setBaselineRaw({
          liftTitles: Array.from(new Set(Array.from(bests.keys()).map(k => k.split("|")[0]))),
          wodTitles: Array.from(new Set(wodSnap.docs.map(d => String(d.data().wodTitle || "")).filter(Boolean))),
          skillNames: Array.from(new Set(skillSnap.docs.map(d => String(d.data().skillTitle || d.data().skillName || "")).filter(Boolean))),
          cardioLogs: cardioSnap.docs.map(d => ({ activity: String(d.data().activity || ""), miles: Number(d.data().miles) || 0 })),
        });
        if (logs.length > 0) {
          const lines = logs.map(x => {
            let res = "";
            if (x.timeInSeconds) {
              const m = Math.floor(x.timeInSeconds / 60);
              const sec = x.timeInSeconds % 60;
              res = `${m}:${String(sec).padStart(2, "0")}`;
            } else if (x.rounds !== undefined && x.rounds !== null) {
              res = `${x.rounds}+${x.reps || 0} rounds`;
            }
            return `- ${x.wodTitle}${res ? `: ${res}` : ""}`;
          });
          parts.push(`RECENT WOD RESULTS - calibrate intensity, pacing targets, and volume to this athlete:\n${lines.join("\n")}`);
        }

        // Workouts already on the calendar (next ~60 days)
        const pwSnap = await getDocs(query(collection(db, "personalWorkouts"), where("userId", "==", userId)));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const horizon = new Date(today);
        horizon.setDate(horizon.getDate() + 60);
        const upcoming = pwSnap.docs.map(d => d.data())
          .filter(x => {
            const dt = x.date?.toDate?.();
            return dt && dt >= today && dt <= horizon;
          })
          .sort((a, b) => (a.date?.toMillis?.() || 0) - (b.date?.toMillis?.() || 0))
          .slice(0, 45);
        if (upcoming.length > 0) {
          const lines = upcoming.map(x => {
            const ds = x.dateString || x.date?.toDate?.()?.toISOString?.().split("T")[0];
            const titles = (x.components || []).map((c: { title?: string }) => c.title).filter(Boolean).join(", ");
            return `- ${ds}: ${titles || "workout"}${x.aiSessionId ? " (AI plan)" : ""}`;
          });
          parts.push(`WORKOUTS ALREADY ON THE ATHLETE'S CALENDAR - account for these when planning; publishing a new AI plan REPLACES AI-planned workouts on the same dates, but manually-added workouts stay:\n${lines.join("\n")}`);
        }

        // Recent post-workout check-ins - the strongest signal for
        // calibrating how hard the programming should actually be
        const ratingText: Record<string, string> = { easy: "too easy", right: "about right", hard: "very hard" };
        const checkIns = pwSnap.docs.map(d => d.data())
          .filter(x => x.sessionFeedback?.rating)
          .sort((a, b) => String(b.dateString || "").localeCompare(String(a.dateString || "")))
          .slice(0, 6);
        if (checkIns.length > 0) {
          parts.push(`RECENT POST-WORKOUT CHECK-INS (how programmed sessions actually FELT - calibrate intensity to these; repeated "very hard" means ease up, repeated "too easy" means push harder):\n${checkIns
            .map(x => `- ${x.dateString || "recent"}: felt ${ratingText[x.sessionFeedback.rating] || x.sessionFeedback.rating}${x.sessionFeedback.note ? ` - "${x.sessionFeedback.note}"` : ""}`)
            .join("\n")}`);
        }

        // Day-by-day training log (last 21 days) so progress reviews can
        // compare what was programmed against what actually got logged
        const dayLog = new Map<string, string[]>();
        const dsOf = (t?: { toDate?: () => Date }) => {
          const dt = t?.toDate?.();
          return dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}` : undefined;
        };
        const noteLog = (ds: string | undefined, s: string) => {
          if (!ds) return;
          const age = (Date.now() - new Date(`${ds}T12:00:00`).getTime()) / 86400000;
          if (age < -1 || age > 21) return;
          dayLog.set(ds, [...(dayLog.get(ds) || []), s]);
        };
        liftSnap.docs.forEach(d => {
          const x = d.data();
          if (x.liftTitle && x.weight) noteLog(dsOf(x.date), `${x.liftTitle} ${x.weight}x${x.reps || 1}${(x.setType || "max") === "working" ? " (working set)" : " (max)"}`);
        });
        wodSnap.docs.forEach(d => {
          const x = d.data();
          if (!x.wodTitle) return;
          const score = x.timeInSeconds ? ` ${Math.floor(x.timeInSeconds / 60)}:${String(x.timeInSeconds % 60).padStart(2, "0")}` : (x.rounds !== undefined && x.rounds !== null) ? ` ${x.rounds}+${x.reps || 0}` : "";
          noteLog(dsOf(x.workoutDate) || dsOf(x.completedDate), `${x.wodTitle}${score}`);
        });
        cardioSnap.docs.forEach(d => {
          const x = d.data();
          if (x.activity) noteLog(String(x.dateString || "") || dsOf(x.date), `${x.activity}${x.miles ? ` ${x.miles}mi` : ""}`);
        });
        pwSnap.docs.forEach(d => {
          const x = d.data();
          if (x.sessionFeedback?.rating && x.dateString) noteLog(String(x.dateString), `felt ${ratingText[x.sessionFeedback.rating] || x.sessionFeedback.rating}`);
        });
        if (dayLog.size > 0) {
          parts.push(`TRAINING LOG BY DAY (last 21 days - what the athlete ACTUALLY did; compare against plan days when reviewing progress):\n${Array.from(dayLog.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 21)
            .map(([ds, items]) => `- ${ds}: ${items.slice(0, 6).join("; ")}`)
            .join("\n")}`);
        }

        setAthleteContext(parts.length > 0 ? `\nATHLETE DATA (from their training log):\n\n${parts.join("\n\n")}\n` : "");
      } catch (err) {
        console.error("Error loading athlete context:", err);
      }
    };
    loadAthleteContext();
  }, [userId]);

  // Standard-battery baseline status (recomputed when logs or style change)
  const baselineStatus = baselineRaw
    ? computeBaselineStatus({ ...baselineRaw, trainingStyle: preferences.trainingStyle })
    : null;

  // Combined athlete block injected into every prompt
  const athleteBlock = buildProfileSection(athleteProfile) + athleteContext +
    (baselineStatus ? buildBaselinePromptBlock(baselineStatus, preferences.trainingStyle) : "");

  // The day-by-day training plan table for the active session
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isPublishingPlan, setIsPublishingPlan] = useState(false);

  useEffect(() => {
    const loadPlan = async () => {
      if (!activeSession?.id) {
        setPlan(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "trainingPlans", activeSession.id));
        setPlan(snap.exists() ? ({ id: snap.id, ...snap.data() } as TrainingPlan) : null);
      } catch (err) {
        console.error("Error loading plan:", err);
        setPlan(null);
      }
    };
    loadPlan();
  }, [activeSession?.id]);

  // Load recently used workouts from the last 6 months of the athlete's calendar
  useEffect(() => {
    const loadRecentWorkouts = async () => {
      if (!userId) return;

      try {
        // Get date 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Query the athlete's personal workouts (filter by date client-side to avoid index requirement)
        const workoutsQuery = query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId)
        );
        const snapshot = await getDocs(workoutsQuery);

        // Extract unique WOD names from components
        const usedWorkouts = new Set<string>();

        snapshot.docs.forEach(doc => {
          const data = doc.data();

          // Check if workout is within last 6 months
          const workoutDate = data.date?.toDate?.();
          if (!workoutDate || workoutDate < sixMonthsAgo) return;

          if (data.components && Array.isArray(data.components)) {
            data.components.forEach((comp: { type?: string; title?: string }) => {
              if (comp.title && comp.type === "wod") {
                // Only track WOD names to avoid repetition
                usedWorkouts.add(comp.title);
              }
            });
          }
        });

        setRecentlyUsedWorkouts(Array.from(usedWorkouts));
      } catch (err) {
        console.error("Error loading recent workouts:", err);
      }
    };

    loadRecentWorkouts();
  }, [userId]);

  // Load existing sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        // Query by userId only and sort client-side to avoid a composite index requirement
        const sessionsQuery = query(
          collection(db, "aiProgrammingSessions"),
          where("userId", "==", userId)
        );
        const snapshot = await getDocs(sessionsQuery);
        const loadedSessions = (snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AIProgrammingSession[]).sort((a, b) => {
          const dateA = a.updatedAt?.toDate?.()?.getTime() || 0;
          const dateB = b.updatedAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });
        setSessions(loadedSessions);

        // Deep link: open the requested session, otherwise the first active one
        const requested = initialSessionId ? loadedSessions.find(s => s.id === initialSessionId) : undefined;
        const activeOne = requested || loadedSessions.find(s => s.status === "active");
        if (activeOne) {
          setActiveSession(activeOne);
        }
      } catch (err) {
        console.error("Error loading sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pre-fill the input when deep-linked (e.g., regenerate a day from the calendar)
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch preferences from Firestore, sync state, and return the fresh
  // values. Called on mount AND before every send, so equipment/schedule
  // edits made on other pages or tabs reach the coach immediately.
  const fetchPreferencesFromDb = async () => {
    try {
      const prefsQuery = query(
        collection(db, "aiProgrammingPreferences"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(prefsQuery);
      if (snapshot.empty) return null;
      const prefDoc = snapshot.docs[0];
      const prefData = prefDoc.data();
      const fresh = {
        trainingStyle: prefData.trainingStyle || "crossfit",
        trainingEnvironment: prefData.trainingEnvironment || "home",
        philosophy: prefData.philosophy || "",
        equipment: prefData.equipment || "",
        events: prefData.events || [],
        weeklySchedule: prefData.weeklySchedule || {},
        longRunDay: prefData.longRunDay || "",
        restDaysPerWeek: prefData.restDaysPerWeek || 0,
        workoutDuration: prefData.workoutDuration || "varied",
        benchmarkFrequency: prefData.benchmarkFrequency || "sometimes",
        programmingStyle: prefData.programmingStyle || "",
        additionalRules: prefData.additionalRules || "",
      };
      setPreferencesDocId(prefDoc.id);
      setPreferences(fresh);
      return fresh;
    } catch (err) {
      console.error("Error loading preferences:", err);
      return null;
    }
  };

  // Load programming preferences
  useEffect(() => {
    fetchPreferencesFromDb().finally(() => setPrefsChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pin the chat to the newest message (new turns, loading dots, and
  // week-by-week generation progress all land at the bottom)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSession?.messages?.length, isLoading, generationProgress]);

  // Brand-new users get walked into setup before asking for programming
  useEffect(() => {
    if (prefsChecked && !preferencesDocId && !initialSessionId && !autoOpenedSetup.current) {
      autoOpenedSetup.current = true;
      setShowSettings(true);
    }
  }, [prefsChecked, preferencesDocId, initialSessionId]);

  // Save preferences
  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      const prefData = {
        userId,
        ...preferences,
        events: (preferences.events || []).map(e => ({
          id: e.id,
          type: e.type,
          name: e.name || "",
          date: e.date || "",
          detail: e.detail || "",
        })),
        weeklySchedule: Object.fromEntries(
          Object.entries(preferences.weeklySchedule || {}).map(([day, setting]) => [
            day,
            { mode: setting.mode, classDescription: setting.classDescription || "", classAttendance: setting.classAttendance || "always", maxMinutes: setting.maxMinutes || 0 },
          ])
        ),
        updatedAt: serverTimestamp(),
      };

      if (preferencesDocId) {
        await updateDoc(doc(db, "aiProgrammingPreferences", preferencesDocId), prefData);
      } else {
        const docRef = await addDoc(collection(db, "aiProgrammingPreferences"), prefData);
        setPreferencesDocId(docRef.id);
      }
      setError(null);
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError("Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  // Training event helpers
  const addEvent = () => {
    setPreferences(prev => ({
      ...prev,
      events: [
        ...(prev.events || []),
        { id: `ev_${Date.now()}`, type: "running_race" as TrainingEventType, name: "", date: "", detail: "Marathon" },
      ],
    }));
  };

  const updateEvent = (id: string, field: "type" | "name" | "date" | "detail", value: string) => {
    setPreferences(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === id ? { ...e, [field]: value } as TrainingEvent : e),
    }));
  };

  const removeEvent = (id: string) => {
    setPreferences(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== id),
    }));
  };

  // Weekly schedule helpers
  const updateScheduleDay = (day: WeekdayKey, mode: "open" | "class" | "rest") => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode,
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  const updateScheduleMinutes = (day: WeekdayKey, maxMinutes: number) => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: prev.weeklySchedule?.[day]?.mode || "open",
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes,
        },
      },
    }));
  };

  const updateScheduleAttendance = (day: WeekdayKey, classAttendance: "always" | "optional") => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: "class" as const,
          classDescription: prev.weeklySchedule?.[day]?.classDescription || "",
          classAttendance,
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  const updateScheduleClass = (day: WeekdayKey, classDescription: string) => {
    setPreferences(prev => ({
      ...prev,
      weeklySchedule: {
        ...(prev.weeklySchedule || {}),
        [day]: {
          mode: "class" as const,
          classDescription,
          classAttendance: prev.weeklySchedule?.[day]?.classAttendance || "always",
          maxMinutes: prev.weeklySchedule?.[day]?.maxMinutes || 0,
        },
      },
    }));
  };

  // Programming requires a saved training profile - open setup instead
  const requireProfile = (): boolean => {
    if (prefsChecked && !preferencesDocId) {
      setError("Save your Training Profile first so Oddo can program for you - it takes a minute.");
      setShowSettings(true);
      return false;
    }
    return true;
  };

  const createNewSession = async () => {
    if (!requireProfile()) return;
    // Generate unique name with count
    const todayStr = new Date().toLocaleDateString();
    const existingToday = sessions.filter(s => s.title.startsWith(`Program ${todayStr}`)).length;
    const uniqueTitle = existingToday > 0
      ? `Program ${todayStr} #${existingToday + 1}`
      : `Program ${todayStr}`;

    const newSession: Omit<AIProgrammingSession, "id"> = {
      userId,
      createdBy: userId,
      title: uniqueTitle,
      status: "active",
      messages: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "aiProgrammingSessions"), newSession);
      const session = { id: docRef.id, ...newSession };
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
    } catch (err) {
      console.error("Error creating session:", err);
      setError("Failed to create new session");
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
        title: newTitle.trim(),
        updatedAt: Timestamp.now(),
      });

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: newTitle.trim() } : s
      ));

      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: newTitle.trim() } : null);
      }

      setEditingSessionId(null);
      setEditingTitle("");
    } catch (err) {
      console.error("Error updating session title:", err);
    }
  };

  const deletePublishedWorkouts = async (sessionId: string) => {
    if (!confirm("Are you sure you want to remove all workouts from this program from your calendar? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Query workouts by aiSessionId to only delete workouts from THIS session
      const workoutsQuery = query(
        collection(db, "personalWorkouts"),
        where("userId", "==", userId),
        where("aiSessionId", "==", sessionId)
      );
      const snapshot = await getDocs(workoutsQuery);

      // Delete all workouts from this session
      let deletedCount = 0;
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, "personalWorkouts", docSnap.id));
        deletedCount++;
      }

      // Update session status back to active
      await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
        status: "active",
        updatedAt: Timestamp.now(),
      });

      // Update local state
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, status: "active" } : s
      ));

      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, status: "active" } : null);
      }

      onPublish?.(); // Refresh the calendar
      alert(`Removed ${deletedCount} workouts from your calendar.`);
    } catch (err) {
      console.error("Error deleting workouts:", err);
      setError("Failed to delete workouts");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this program? If published, workouts will also be removed from your calendar.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const session = sessions.find(s => s.id === sessionId);

      // If session was published, delete the workouts first
      if (session?.status === "published") {
        // Query workouts by aiSessionId to only delete workouts from THIS session
        const workoutsQuery = query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId),
          where("aiSessionId", "==", sessionId)
        );
        const snapshot = await getDocs(workoutsQuery);

        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, "personalWorkouts", docSnap.id));
        }
      }

      // Delete the session itself and its plan table
      await deleteDoc(doc(db, "aiProgrammingSessions", sessionId));
      try {
        await deleteDoc(doc(db, "trainingPlans", sessionId));
      } catch {
        // No plan for this session - fine
      }

      // Update local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }

      onPublish?.(); // Refresh the calendar
    } catch (err) {
      console.error("Error deleting session:", err);
      setError("Failed to delete program");
    } finally {
      setIsDeleting(false);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const messageText = (overrideText ?? input).trim();
    if (!messageText || !activeSession || isLoading) return;
    if (!requireProfile()) return;

    const userMessage: AIChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: Timestamp.now(),
    };

    // Add user message to UI immediately
    const updatedMessages = [...activeSession.messages, userMessage];
    setActiveSession(prev => prev ? { ...prev, messages: updatedMessages } : null);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = updatedMessages.map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      ).join("\n\n");

      // Re-read preferences so equipment/schedule edits made on other
      // pages or tabs reach the coach on this very message
      const freshPrefs = (await fetchPreferencesFromDb()) || preferences;

      // If this session already has a plan table, converse in revision mode
      const prompt = plan
        ? buildRevisionPrompt(plan, conversationHistory, freshPrefs)
        : `${getSystemPrompt(freshPrefs, recentlyUsedWorkouts)}\n${athleteBlock}\nConversation so far:\n${conversationHistory}\n\nRespond to the user's latest message. Remember to output valid JSON only.`;

      // Call xAI/Grok API. Plan revisions use the stronger reasoning model -
      // patching an existing table correctly matters more than speed there.
      const text = await chatCompletion({
        ...(plan ? { model: REVISION_MODEL } : {}),
        messages: [
          { role: "system", content: "You are Oddo, an expert CrossFit programming coach. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 16000,
      });

      if (!text) {
        throw new Error("No response from AI");
      }

      // Parse the JSON response
      let parsedResponse: { message: string; workouts: AIGeneratedDay[] };
      try {
        const parsed = tryParseJson(text);
        if (!parsed) {
          console.error(
            "Unparseable AI response. First 400 chars:", text.slice(0, 400),
            "... Last 400 chars:", text.slice(-400)
          );
          throw new SyntaxError("Unparseable AI response");
        }

        // The athlete mentioned gear that isn't saved yet - persist it
        if (Array.isArray(parsed.equipmentAdditions) && parsed.equipmentAdditions.length > 0) {
          await applyEquipmentAdditions(parsed.equipmentAdditions.map((s: unknown) => String(s)));
        }

        // Revision mode: targeted changes to the existing plan table
        if (plan && Array.isArray(parsed.patchRows) && parsed.patchRows.length > 0) {
          await applyPatchWithCorrections(parsed.patchRows, parsed.message || "Plan updated.", updatedMessages, conversationHistory);
          return;
        }

        // Revision-mode guard: a message-only reply changes nothing. That is
        // wrong both when the model CLAIMS it changed the plan and when the
        // athlete clearly ASKED for a change - in either case, demand the patch.
        if (plan && parsed.message && !(Array.isArray(parsed.patchRows) && parsed.patchRows.length > 0) && !parsed.outline) {
          const lastUserText = String([...updatedMessages].reverse().find(m => m.role === "user")?.content || "");
          const looksLikeQuestion = /^\s*(why|what|how|when|who|where|is|are|does|did|will|would|should)\b/i.test(lastUserText);
          const looksLikeChangeRequest = !looksLikeQuestion &&
            /\b(make|move|swap|switch|change|replace|shift|drop|remove|add|added|reschedule|cancel|skip|redo|remake|rebuild|regenerate|re-?anchor|incorporate|adjust|update|new (?:plan|program|equipment)|rest day|as rest|to rest)\b/i.test(lastUserText);
          const claimsChange = /\b(updated|patched|moved|shifted|swapped|rescheduled|adjusted|changed|replaced)\b/i.test(parsed.message);

          if (claimsChange || looksLikeChangeRequest) {
            try {
              const redoText = await chatCompletion({
                model: REVISION_MODEL,
                messages: [
                  { role: "system", content: "You are Oddo, an expert CrossFit programming coach. Always respond with valid JSON." },
                  { role: "user", content: prompt },
                  { role: "assistant", content: text },
                  { role: "user", content: `Your response contained NO "patchRows", so NOTHING changed in the table. The athlete's latest message was: "${lastUserText.slice(0, 300)}". This is a request to change the plan. You MUST respond NOW with {"message": "...", "patchRows": [...]} containing every changed day in the full row schema - applied to EVERY week the request affects. A message without patchRows is NOT an acceptable response.` },
                ],
                temperature: 0.5,
                maxTokens: 16000,
              });
              const redo = tryParseJson(redoText);
              if (redo && Array.isArray(redo.patchRows) && redo.patchRows.length > 0) {
                await applyPatchWithCorrections(redo.patchRows, redo.message || "Plan updated.", updatedMessages, conversationHistory);
                return;
              }
              if (redo?.message && !claimsChange) parsed.message = redo.message;
            } catch {
              // fall through to the message handling below
            }
            // Only stamp the hard failure when the model CLAIMED it changed
            // something (a lie without patchRows). A conditional request
            // ("fix loads that were off") can legitimately conclude with an
            // analysis and no patches - keep that answer, with a note.
            if (claimsChange) {
              parsed.message = `I wasn't able to produce that change automatically. Nothing in the plan was modified - tell me exactly which day(s) to change (e.g., "make every Friday a rest day and move that workout to Wednesday") and I'll patch the table.`;
            } else {
              parsed.message = `${parsed.message}\n\n(No table changes were applied. If you expected a change, tell me the exact days - e.g., "re-anchor week 3's bench to my logged 165x5".)`;
            }
          }
        }

        // Long-range program (or full rebuild): the AI returned a week-by-week
        // outline - fill in the plan table one week at a time.
        if (parsed.outline && Array.isArray(parsed.outline.weeks) && parsed.outline.weeks.length > 0) {
          await generatePlanTable(
            activeSession.id,
            parsed.message || "Here's your training plan.",
            parsed.outline as ProgramOutline,
            conversationHistory,
            updatedMessages
          );
          return;
        }

        // Handle different response formats from AI
        if (Array.isArray(parsed)) {
          // AI returned just an array of workouts
          parsedResponse = {
            message: `I've generated ${parsed.length} days of programming for you. Click "Preview & Publish" to review and add them to your calendar.`,
            workouts: parsed
          };
        } else if (parsed.workouts && Array.isArray(parsed.workouts)) {
          // Expected format with message and workouts
          parsedResponse = {
            message: parsed.message || `Here's your ${parsed.workouts.length}-day program! Review the workouts below and click "Preview & Publish" when ready.`,
            workouts: parsed.workouts
          };
        } else if (parsed.message) {
          // Just a message, no workouts
          parsedResponse = {
            message: parsed.message,
            workouts: []
          };
        } else {
          // Unknown format, show as message
          parsedResponse = {
            message: text,
            workouts: []
          };
        }
      } catch (parseErr) {
        // Real errors (e.g., Firestore permissions while saving the plan) must
        // surface truthfully in the error box, not masquerade as a parse issue
        if (!(parseErr instanceof SyntaxError)) throw parseErr;

        // If parsing (and repair) fails, never dump raw JSON into the chat
        const looksLikeJson = cleanJsonText(text).startsWith("{");
        parsedResponse = {
          message: looksLikeJson
            ? "My response got cut off before I could finish it. Say \"try again\" and I'll rebuild it."
            : text,
          workouts: []
        };
      }

      const assistantMessage: AIChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: parsedResponse.message,
        timestamp: Timestamp.now(),
      };

      // Only add generatedWorkouts if there are workouts
      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        assistantMessage.generatedWorkouts = parsedResponse.workouts;
      }

      const finalMessages = [...updatedMessages, assistantMessage];

      // Prepare update data - filter out any undefined values
      const updateData: Record<string, unknown> = {
        messages: stripOldWorkouts(finalMessages),
        updatedAt: Timestamp.now(),
      };

      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        updateData.programWeeks = Math.ceil(parsedResponse.workouts.length / 7);
      }

      // Update session in Firestore
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), updateData);

      setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to get AI response.");
    } finally {
      setIsLoading(false);
    }
  };

  // Build the prompt that fills in one week of the plan table
  const buildWeekRowsPrompt = (
    outline: ProgramOutline,
    week: ProgramOutlineWeek,
    conversationHistory: string,
    previousRows: PlanRow[],
    correction?: string
  ): string => {
    const outlineSummary = outline.weeks
      .map(w => `Week ${w.weekNumber} (starting ${w.startDate}): ${w.focus}${w.details ? ` - ${w.details}` : ""}`)
      .join("\n");

    const lastRows = previousRows.slice(-10)
      .map(r => `${r.date} (${r.day}): ${r.session}${r.runMiles ? ` ${r.runMiles}mi` : ""} - ${(r.detail || "").slice(0, 80)}`)
      .join("\n");

    // Enumerate this week's exact dates with their true weekday names - the model
    // must not do calendar math itself (it gets weekdays wrong and then places
    // class/rest days on the wrong real days)
    const weekDates = datesForWeek(outline, week);
    const weekDateLines = weekDates.map(ds => `${ds} = ${dayNameForDate(ds)}`);

    // Spell out exactly which of this week's dates are class days
    const schedule = preferences.weeklySchedule || {};
    const classDateLines = weekDates
      .map(ds => {
        const setting = schedule[WEEKDAY_KEY_BY_NAME[dayNameForDate(ds)]];
        if (setting?.mode !== "class") return "";
        const optional = setting.classAttendance === "optional";
        return `- ${ds} (${dayNameForDate(ds)}): ${setting.classDescription || "class"}${optional ? " - attendance is YOUR call this week; if skipping, program a workout or rest instead" : " - ATTENDS EVERY WEEK; this date MUST be the class"}`;
      })
      .filter(Boolean);

    return `You are Oddo, the athlete's personal ${(preferences.trainingStyle || "crossfit") === "general" ? "strength & conditioning" : "CrossFit + endurance"} coach, filling in ONE WEEK of a day-by-day training plan TABLE for an athlete training in ${(preferences.trainingEnvironment || "home") === "commercial" ? "a commercial gym" : "their garage/home gym"}.
${buildPreferencesSection(preferences)}${athleteBlock}
THE ATHLETE'S REQUEST AND CONTEXT (conversation so far):
${conversationHistory}

FULL PLAN OUTLINE (runs ${outline.startDate} to ${outline.endDate}):
${outlineSummary}

YOU ARE NOW FILLING IN WEEK ${week.weekNumber}, which starts on ${week.startDate}.
Focus for this week: ${week.focus}
${week.details ? `Details: ${week.details}` : ""}

THE EXACT CALENDAR DATES FOR THIS WEEK - produce ONE row per date below, in this order, using EXACTLY these day names (this mapping is authoritative; do NOT recompute weekdays yourself):
${weekDateLines.join("\n")}
Weekly-schedule rules (class days, rest days, long-run day) apply to the TRUE day names above - e.g. a Tuesday class goes on the date marked "= Tuesday".
${classDateLines.length > 0
  ? `CLASS DAYS THIS WEEK - class components go on EXACTLY these dates and NO other date:\n${classDateLines.join("\n")}`
  : "NO CLASS DAYS THIS WEEK - do not program any class component."}
${(preferences.restDaysPerWeek || 0) > 0 && weekDateLines.length >= 7
  ? `REST DAY REQUIREMENT: EXACTLY ${preferences.restDaysPerWeek} of the ${weekDateLines.length} days above must be full Rest days (session "Rest"). Count your Rest rows before answering - this is a hard requirement.`
  : ""}
${correction ? `\n${correction}` : ""}
${lastRows ? `\nDAYS ALREADY IN THE TABLE JUST BEFORE THIS WEEK (for continuity - do not repeat workouts):\n${lastRows}` : ""}

Respond with valid JSON in this exact format:
{
  "rows": [
    {
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "week": ${week.weekNumber},
      "phase": "${week.focus.split(" - ")[0]}",
      "session": "Run + CrossFit",
      "runMiles": 4,
      "targetRPE": "60-80%",
      "estMinutes": 60,
      "reason": "Easy aerobic volume plus an upper-body-biased WOD keeps the legs fresh for Tuesday's lifting class while building the weekly base.",
      "components": [
        { "type": "warmup", "title": "Warm-up", "description": "3 min easy movement; 10 air squats + 10 glute bridges; wrist/ankle/hip mobility." },
        { "type": "wod", "title": "DB Upper Circuit", "description": "12-min AMRAP: 8 DB floor presses (50s), 12 KB swings (53), 10 sit-ups." },
        { "type": "run", "title": "Easy Run", "description": "4 mi easy at a conversational pace (~40% effort); finish with 4x20-sec relaxed strides." }
      ]
    }
  ]
}

RULES:
- ONE row per date listed above - no other dates, no skipped dates, day names copied exactly from the list.
- "components" is the day's prescription broken into typed pieces: "warmup", "wod" (mixed-modal metcons), "lift", "skill", "run"/"swim"/"bike_mtb"/"bike_road"/"row" (pure aerobic work - steady-state or intervals; only program swim/bike/row if the athlete does those or has the equipment), "class" (coached classes the athlete attends elsewhere), "cooldown". Each component's description is COMPLETE: exact distances, paces, movements, reps, and loads (use the athlete's PRs for percentage work) - specific enough to train from with no other information.
- Component typing is strict: "lift" is dedicated strength work on a single named lift (sets x reps @ load, e.g. "Back Squat 5x5 @ 75%"). A strength day with SEVERAL lifts done as sequential straight sets (e.g. bench, then rows, then accessories) is MULTIPLE "lift" components - one per named movement, in order, each titled with the lift name - NEVER one text blob and never a "wod". Only circuits, rounds-based pieces, EMOMs, and AMRAPs are "wod" - even when strength-biased. "wod" says nothing about session length - a 15-minute piece is still a wod.
- Baseline days especially: every tested movement is its OWN "lift" component (title = the lift name, description = the test, e.g. "Build to a hard but crisp set of 5 - log it as your baseline; then 3x8 @ 70% of that weight"). The athlete logs each lift from its component - a baseline buried in a paragraph can't be logged.
- "reason" (1-2 sentences): WHY this day is programmed this way given the phase, the surrounding days, and the athlete's goals. Every non-rest day gets one. The reason speaks to the ATHLETE about training intent - NEVER write rule bookkeeping ("to maintain exactly 2 rest days", "to satisfy the weekly cap") as a reason.
- COACH THE PERSON, not the textbook: this plan is for ONE specific athlete whose data is above. Every week, several reasons and prescriptions must reference THEIR actual specifics - their PR numbers, their recent check-ins ("last week's squats felt very hard, so..."), their injuries, their goal race date, their class schedule. A reason that could appear in anyone's plan ("builds aerobic base", "maintains lifting skill") is filler - replace it with what this day does for THIS athlete right now.
- THIN DATA = NO FAKE PRECISION: %-of-1RM prescriptions ONLY for lifts with solid logged data. For lifts marked [ROUGH] or unlogged, never invent derived rep-maxes or fabricated adjustments - prescribe by feel ("build to a hard but crisp set of 5 - log it, that becomes your baseline"), establish the baseline early in the block, and anchor later weeks to what the athlete actually logs.
- VARIETY IS MANDATORY week to week: the previously-programmed days listed above are what already exists - NEVER copy an earlier workout or reuse its name. A recurring slot (e.g. Wednesday conditioning) keeps its GOAL but rotates movements, formats (EMOM / AMRAP / intervals / rounds / chipper), and rep schemes every week. Same goal, fresh workout.
${IMPLEMENT_KNOWLEDGE}
- Rest days: session "Rest", components [] (or one light "cooldown" mobility component), runMiles 0. The reason states the RECOVERY PURPOSE in the context of the surrounding days (e.g., "Absorbs Sunday's long run so Tuesday's Oly class is quality lifting, not junk volume"). NEVER cite the rest-day rule, quota, settings, or "requirement" as the reason - the athlete wants to know what the rest accomplishes, not that a rule was followed.
- Event days (competition, race): session in CAPS (e.g., "MARATHON", "CROSSFIT COMPETITION") with one component of race-day execution guidance.
- "session" is a short 2-4 word label summarizing the day. "phase" is a consistent short label across the plan (e.g., "Base", "Build", "Comp Taper", "Marathon Taper", "Recovery").
- EVERY row is ONE definitive prescription. Never "optional", never "attend or rest - your call".
- Class days: ONE "class" component - title is the class name, description is "Follow the coach's programming", and that is ALL. No guessed content, no technique advice, no effort/intensity guidance - the athlete scans the class whiteboard in afterward.
- runMiles = total planned run miles that day (0 if none). targetRPE is the day's EFFORT as a percentage of max effort, like "60-80%" - NEVER 1-10 RPE numbers; the athlete thinks in % effort. estMinutes = total session time including warmup.
- Time budgets are CAPS, not targets: do NOT fill every available minute. Distribute training load across the whole week - never schedule two maximal days back-to-back, and keep most sessions comfortably under their cap.
- FATIGUE MANAGEMENT: wave the intensity. Never stack more than 2 hard days in a row - follow them with an easy day, skill day, or rest, and prefer an extra rest day after a demanding stretch over forcing volume. Harder and easier weeks alternate within a block, with every 3rd-4th week a genuine deload (volume AND intensity down 30-40%). Calibrate to the athlete's recent check-ins: repeated "very hard" means ease the coming days; repeated "too easy" means push.
- REST PLACEMENT anchors to the week's biggest sessions: rest or easy movement immediately before AND after the long run / heaviest day whenever fixed classes allow - never a hard metcon or heavy lifting adjacent to a 8+ mile run. Rest-day reasons must describe their ACTUAL neighbors - never claim a rest protects a session when a hard day sits between them; if the fixed class schedule forces that layout, say so honestly.
- If the athlete is training for a running race: program 3-4 run days per week - ONE long run plus easy midweek runs (easy runs fit inside weekday caps). Weekly total mileage progresses roughly 10% week over week with a lighter cutback week every 3rd-4th week; the long run builds toward the race distance, then tapers.
- The LONG RUN is its own session on the athlete's long-run day: nothing else that day beyond a short warm-up and cool-down. NEVER stack the long run after a class or metcon.
- Conditioning pieces stay in the 8-20 minute range (base phase toward the lower end). No 30-minute heavy-implement EMOMs.
- Respect every schedule rule, time budget, and rest-day requirement above. Only equipment the athlete has.
- Pure JSON only - no markdown fences, no extra text.`;
  };

  // Build the prompt for revising an existing plan table conversationally
  const buildRevisionPrompt = (currentPlan: TrainingPlan, conversationHistory: string, prefs = preferences): string => {
    const violations = planWeekViolations(currentPlan.rows);
    return `You are Oddo, the athlete's coach, maintaining their day-by-day training plan TABLE.
${buildPreferencesSection(prefs)}${athleteBlock}
CURRENT PLAN TABLE (${currentPlan.startDate} to ${currentPlan.endDate}, ${currentPlan.rows.length} days).
Format: date|day|week|phase|session|runMiles|effort%|minutes|detail
${serializePlanRows(currentPlan.rows)}
${violations.length > 0 ? `\nSCHEDULE VIOLATIONS CURRENTLY IN THE TABLE - these break the athlete's hard rules and MUST be fixed by your next patch (fix ALL of them in one patchRows, across every listed week):\n${violations.map(v => `- ${v}`).join("\n")}` : ""}

CONVERSATION:
${conversationHistory}

READING THE ATHLETE:
- Observations and shared context ("Saturdays are pretty hard", "I ran 13 miles two weeks ago", "my legs are tired") are NOT change requests. Acknowledge them, factor them into future programming decisions, and explain how - but do NOT add, remove, or replace sessions unless the athlete explicitly asks for a change. If you genuinely cannot tell whether they want a change, ask ONE short clarifying question (form 1) instead of guessing.
- SANITY-CHECK every number the athlete reports (distance, time, pace, load). If it is implausible (e.g., "3 miles in 2.5 hours" is a 50-minute mile), question it in a message-only response BEFORE rebuilding anything around it.
- The preferences above (equipment, schedule) are CURRENT as of this message - trust them over your memory of earlier turns. If the athlete says they added equipment: when it IS in the list, immediately patch the upcoming days that can now use it (or output a new outline for a full remake); when it is NOT in the list, include "equipmentAdditions": ["item", ...] in your JSON response (the app saves them to preferences) and program with them in the same turn.
- When asked what equipment they own or what you'll program with, QUOTE the saved equipment list VERBATIM - never paraphrase or shorten it, so the athlete can spot anything missing.
- Equipment counts as "incorporated" ONLY if upcoming days contain movements that literally USE it (pull-up bar -> pull-ups, chin-ups, toes-to-bar, hanging work; sandbag -> sandbag cleans, carries, squats, over-shoulder throws). Wall balls and runs use neither. Scan the upcoming table: if the new equipment's movements appear on no upcoming day, it is NOT incorporated - patch it into the upcoming weeks now.
- An explicit "redo/remake/regenerate the plan" - or the athlete REPEATING a request you already declined - is an ORDER, not a discussion. Respond with patchRows (or a full outline) THIS turn. Never refuse the same request twice.
- A progress-review request ("compare what I logged vs what was programmed") is answered from the TRAINING LOG BY DAY data above: name the specific days and lifts you compared, then patch what needs re-anchoring. If everything is genuinely on track, a message-only answer is CORRECT - but it must cite specifics ("your 165x5 bench on 08-27 matches the programmed 70%"), never a bare "no changes needed".

Respond to the athlete's latest message with valid JSON in EXACTLY ONE of these forms:
1. Just answering a question / discussing: {"message": "..."} - this form changes NOTHING in the table. NEVER use it to say you updated/moved/changed anything: without patchRows, no change happens. ANY requested change REQUIRES form 2 or 3.
2. Targeted plan changes: {"message": "summary of what you changed and why", "patchRows": [complete replacement rows for ONLY the days that change, using the full row schema: date, day, week, phase, session, runMiles, targetRPE, estMinutes, reason, and components (typed pieces: warmup/wod/lift/skill/run/swim/bike_mtb/bike_road/class/cooldown - pure aerobic work uses the specific cardio type, coached classes attended elsewhere are "class" - each with title and a complete description)]}
3. The request changes the plan's fundamental structure (different weekly pattern, new/changed events, different phases): {"message": "...", "outline": {"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "phases": [{"name": "Build", "weeks": "1-3", "goal": "one athlete-specific sentence"}], "weeks": [{"weekNumber": 1, "startDate": "YYYY-MM-DD", "focus": "...", "details": "..."}]}} - the app will rebuild the whole table from it.

${IMPLEMENT_KNOWLEDGE}

PATCH RULES:
- patchRows contains ONLY changed days; every unchanged day stays out of it.
- A patch must leave EVERY affected week fully valid: the exact required number of rest days, classes only on their scheduled weekdays. If your change costs a week a rest day (e.g., turning a rest day into a class), the SAME patchRows must restore that rest day on another day of that same week - and apply the same correction to EVERY week the change touches (a recurring change like "add the Tuesday class" touches every week). Never leave a week broken for a later turn.
- When the athlete asks for a recurring change, patch it in ALL weeks at once, consistently.
- Make the MINIMAL change that satisfies the request. "Make today a rest day" means swapping that ONE day with the most sensible training day in the same week - NOT reshuffling the whole week or padding it with extra rest days. Never add more rest days than the athlete's weekly requirement.
- Endurance rules still apply to patched weeks: the long run stays its own session on the athlete's long-run day (never stacked with a class or metcon), and race-prep weeks keep their run days.
- Patched rows' "reason" speaks to the athlete about training intent - never rule bookkeeping ("to maintain exactly 2 rest days").
- Class components describe THAT day's class only (its actual focus per the schedule) - never copy another weekday's class text.
- Copy each patched row's "week" and "phase" from the current table for that date.
- Component typing is strict: "lift" is ONLY dedicated strength work on a single named lift (sets x reps @ load). ANY multi-movement circuit, rounds-based piece, EMOM, or AMRAP is a "wod" regardless of session length or strength bias. If the athlete points out a mistyped component, fix it with a patchRow - do not argue about session length.
- Each patched row is complete and definitive (no "optional") and respects the athlete's schedule rules, time budgets, rest-day requirements, equipment, and injuries above.
- Pure JSON only - no markdown fences.`;
  };

  // Generate the next ~4-week block of an existing plan from its stored
  // macro outline. Runs with fresh preferences and the athlete's current
  // logs/check-ins, so the new block is anchored to reality, not to
  // guesses made a month ago.
  const generateNextBlock = async () => {
    if (!plan?.outline || !activeSession || isLoading) return;
    const done = plan.generatedThroughWeek || 0;
    const remaining = (plan.outline.weeks || []).filter(w => w.weekNumber > done);
    if (remaining.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await fetchPreferencesFromDb();
      const conversationHistory = (activeSession.messages || [])
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      await generatePlanTable(
        activeSession.id,
        `Building your next block from the outline - anchored to what you've actually logged so far.`,
        { startDate: plan.outline.startDate, endDate: plan.outline.endDate, weeks: remaining },
        conversationHistory,
        activeSession.messages || [],
        plan.rows
      );
    } catch (err) {
      console.error("Error generating next block:", err);
      setError("Failed to build the next block. Please try again.");
    } finally {
      setIsLoading(false);
      setGenerationProgress(null);
    }
  };

  // True when the plan has outline weeks beyond what's been generated
  const nextBlockAvailable = !!(plan?.outline && (plan.outline.weeks || []).some(w => w.weekNumber > (plan.generatedThroughWeek || 0)));

  // Deterministic checks a generated week must pass (rest-day count, class
  // placement, endurance structure when a race is on the calendar)
  const validateWeekRows = (candidate: PlanRow[], weekDates: string[], priorRows: PlanRow[] = []): string[] => {
    const problems: string[] = [];

    // Cross-week variety: a WOD that copies an earlier week's workout
    // verbatim - or even reuses its name - is lazy programming and gets
    // the week rejected before the athlete ever sees it
    const priorWodDescs = new Map<string, string>();
    const priorWodTitles = new Map<string, string>();
    priorRows.forEach(r => (r.components || []).forEach(c => {
      if (c.type !== "wod") return;
      const nd = String(c.description || "").toLowerCase().replace(/\s+/g, " ").trim();
      const nt = String(c.title || "").toLowerCase().trim();
      if (nd) priorWodDescs.set(nd, r.date);
      if (nt) priorWodTitles.set(nt, r.date);
    }));
    candidate.forEach(r => (r.components || []).forEach(c => {
      if (c.type !== "wod") return;
      const nd = String(c.description || "").toLowerCase().replace(/\s+/g, " ").trim();
      const nt = String(c.title || "").toLowerCase().trim();
      if (nd && priorWodDescs.has(nd)) {
        problems.push(`${r.date} "${c.title}" is IDENTICAL to the workout already programmed on ${priorWodDescs.get(nd)} - write a genuinely different workout for this slot (different movements, format, or rep scheme serving the same goal)`);
      } else if (nt && priorWodTitles.has(nt)) {
        problems.push(`${r.date} reuses the workout name "${c.title}" from ${priorWodTitles.get(nt)} - recurring slots must rotate movements, formats, and names week to week`);
      }
    }));
    // Weeks containing a competition/race get looser structural rules
    const isEventWeek = candidate.some(r => /competition|marathon|race/i.test(r.session));

    const restTarget = preferences.restDaysPerWeek || 0;
    if (restTarget > 0 && weekDates.length >= 7) {
      const restCount = candidate.filter(r => r.session.toLowerCase().includes("rest")).length;
      // Extra rest is legitimate coaching around competitions/races; too little never is
      if (restCount < restTarget) {
        problems.push(`only ${restCount} Rest day${restCount === 1 ? "" : "s"} - the athlete requires EXACTLY ${restTarget} full Rest days this week (session "Rest", components [])`);
      } else if (restCount > restTarget && !isEventWeek) {
        problems.push(`${restCount} Rest days - the athlete asked for EXACTLY ${restTarget} per week; replace the extra rest day${restCount - restTarget > 1 ? "s" : ""} with training`);
      }
    }

    // Endurance structure: applies to full non-event weeks while training for a running race
    const hasRunningRace = (preferences.events || []).some(e => e.type === "running_race");
    if (hasRunningRace && weekDates.length >= 7 && !isEventWeek) {
      const runDays = candidate.filter(r => (r.runMiles || 0) > 0 || (r.components || []).some(c => c.type === "run"));
      if (runDays.length < 2) {
        problems.push(`only ${runDays.length} running day${runDays.length === 1 ? "" : "s"} - marathon prep needs at least 2 run days per week (ideally 3-4): one long run plus easy midweek runs`);
      }
      const longRunRow = candidate.reduce<PlanRow | undefined>(
        (best, r) => ((r.runMiles || 0) > (best?.runMiles || 0) ? r : best),
        undefined
      );
      if (longRunRow && (longRunRow.runMiles || 0) >= 5) {
        const stacked = (longRunRow.components || []).some(c => c.type === "class" || c.type === "wod" || c.type === "lift");
        if (stacked) {
          problems.push(`${longRunRow.date} stacks the week's long run (${longRunRow.runMiles} mi) with a class/workout - the long run must be its OWN session with only a warm-up and cool-down around it`);
        }
        const preferredDay = preferences.longRunDay || "";
        if (preferredDay && dayNameForDate(longRunRow.date).toLowerCase() !== preferredDay) {
          problems.push(`the long run (${longRunRow.runMiles} mi) is on ${dayNameForDate(longRunRow.date)} but the athlete's long-run day is ${preferredDay.charAt(0).toUpperCase() + preferredDay.slice(1)}`);
        }
        // Adjacency: no hard chosen sessions (wod/lift) right before or
        // after a big run. Fixed classes can't move, so they're exempt -
        // but a metcon or heavy lifting next to a 8+ mile run is the
        // model's own scheduling choice and must be fixed.
        if ((longRunRow.runMiles || 0) >= 8) {
          const shiftDate = (ds: string, n: number) => {
            const [sy, sm, sd] = ds.split("-").map(Number);
            const dt = new Date(sy, sm - 1, sd + n, 12);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          };
          const hardChosen = (r?: PlanRow) =>
            !!r && (r.components || []).some(c => c.type === "wod" || c.type === "lift");
          const before = candidate.find(r => r.date === shiftDate(longRunRow.date, -1));
          const after = candidate.find(r => r.date === shiftDate(longRunRow.date, 1));
          if (hardChosen(before)) {
            problems.push(`${before!.date} programs a hard session the day BEFORE the ${longRunRow.runMiles} mi long run - the day before a big run must be rest or easy movement (fixed classes excepted)`);
          }
          if (hardChosen(after)) {
            problems.push(`${after!.date} programs a hard session the day AFTER the ${longRunRow.runMiles} mi long run - recover after a big run with rest or easy movement (fixed classes excepted)`);
          }
        }
      }
    }

    const schedule = preferences.weeklySchedule || {};
    const rowHasClass = (r?: PlanRow) =>
      !!r && ((r.components || []).some(c => c.type === "class") || r.session.toLowerCase().includes("class"));
    for (const ds of weekDates) {
      const dayName = dayNameForDate(ds);
      const setting = schedule[WEEKDAY_KEY_BY_NAME[dayName]];
      const row = candidate.find(r => r.date === ds);
      if (setting?.mode === "class" && setting.classAttendance !== "optional" && !rowHasClass(row)) {
        problems.push(`${ds} is a ${dayName} - the athlete's fixed class day (${setting.classDescription || "class"}) - but that date's row is not the class`);
      }
      if (rowHasClass(row) && setting?.mode !== "class") {
        problems.push(`${ds} (${dayName}) contains a class, but the athlete has NO class on ${dayName}s - classes go only on their scheduled weekdays`);
      }
      // Class text must describe THIS day's class, not another weekday's
      // (e.g., "Attend Tuesday Oly class" on a Thursday row)
      const classComp = row ? (row.components || []).find(c => c.type === "class") : undefined;
      if (classComp) {
        const wrongDay = WEEKDAY_NAMES.find(n =>
          n !== dayName &&
          (new RegExp(`\\b${n}\\b`, "i").test(classComp.title) ||
           new RegExp(`attend(?:\\s+the)?\\s+${n}\\b`, "i").test(classComp.description))
        );
        if (wrongDay) {
          problems.push(`${ds} is a ${dayName} but its class component says "${wrongDay}" - describe ${dayName}'s actual class${setting?.classDescription ? ` (${setting.classDescription})` : ""}`);
        }
        // Class components must not invent content or advice - the class
        // coach programs it and the athlete scans the whiteboard in later
        const classText = `${classComp.description || ""}`;
        if (classText.length > 60 || /focus|technique|volume|intensity|effort|work on|emphasi|wall.?ball|wraps|reps|sets/i.test(classText)) {
          problems.push(`${ds} class component includes guessed content/advice ("${classText.slice(0, 60)}") - a class component's description must be exactly "Follow the coach's programming." and nothing more`);
        }
      }
      // Baseline/strength days must expose each lift as its own component
      // so the athlete can log it (a baseline in a paragraph can't be logged)
      if (row && !row.session.toLowerCase().includes("rest") &&
          /baseline|strength|hypertrophy|press|squat|deadlift|bench/i.test(row.session) &&
          (row.components || []).filter(c => c.type === "lift").length === 0 &&
          !(row.components || []).some(c => c.type === "class")) {
        problems.push(`${ds} ("${row.session}") looks like a strength/baseline day but has NO "lift" components - each named movement must be its own "lift" component (titled with the lift name) so the athlete can log it against their records`);
      }
      // Reasons must speak to training purpose, not rule bookkeeping
      // ("maintains the two-rest requirement" tells the athlete nothing)
      if (row?.reason && /quota|requirement|rest[- ]day (?:rule|count)|exact(?:ly)? (?:one|two|\d+)[- ]rest|per (?:your|the) (?:settings|schedule)|as (?:required|instructed)|maintain(?:s|ing)? (?:the )?(?:weekly )?rest/i.test(row.reason)) {
        problems.push(`${ds} reason is rule bookkeeping ("${row.reason.slice(0, 60)}") - state what the day accomplishes for the athlete given the surrounding days instead`);
      }
    }

    return problems;
  };

  // App-computed per-week structure summary - settles "how many rest days do I
  // actually have" with facts instead of the model's word
  const planWeekSummary = (rows: PlanRow[]): string => {
    if (rows.length === 0) return "";
    const start = rows[0].date;
    const byWeek = new Map<number, PlanRow[]>();
    rows.forEach(r => {
      const wk = weekNumberForDate(start, r.date);
      const g = byWeek.get(wk) || [];
      g.push(r);
      byWeek.set(wk, g);
    });
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([wk, wr]) => {
        const rest = wr.filter(r => r.session.toLowerCase().includes("rest")).map(r => r.day.slice(0, 3));
        const runs = wr.filter(r => (r.runMiles || 0) > 0 || (r.components || []).some(c => c.type === "run"));
        const miles = Math.round(wr.reduce((s, r) => s + (r.runMiles || 0), 0) * 10) / 10;
        const classes = wr.filter(r => (r.components || []).some(c => c.type === "class"));
        return `Wk ${wk}: ${rest.length} rest${rest.length ? ` (${rest.join("+")})` : ""} • ${runs.length} run${runs.length === 1 ? "" : "s"} (${miles} mi) • ${classes.length} class${classes.length === 1 ? "" : "es"}`;
      })
      .join("\n");
  };

  // Validate every week of a full plan; returns human-readable violations.
  // Weeks are 7-day windows from the plan's first date (the stored week field
  // can carry stale numbers from old patches).
  const planWeekViolations = (rows: PlanRow[]): string[] => {
    if (rows.length === 0) return [];
    const start = rows[0].date;
    const byWeek = new Map<number, PlanRow[]>();
    rows.forEach(r => {
      const wk = weekNumberForDate(start, r.date);
      const g = byWeek.get(wk) || [];
      g.push(r);
      byWeek.set(wk, g);
    });
    const out: string[] = [];
    Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0]).forEach(([weekNum, weekRows]) => {
      const probs = validateWeekRows(weekRows, weekRows.map(r => r.date));
      if (probs.length > 0) {
        out.push(`Week ${weekNum} (${weekRows[0].date} to ${weekRows[weekRows.length - 1].date}): ${probs.join("; ")}`);
      }
    });

    // Copy-paste programming: identical workout text on different dates
    const seenDescriptions = new Map<string, string>();
    const dupes: string[] = [];
    rows.forEach(r => {
      (r.components || []).forEach(c => {
        if (c.type !== "wod" && c.type !== "lift") return;
        const norm = c.description.toLowerCase().replace(/\s+/g, " ").trim();
        if (norm.length < 60) return;
        const prevDate = seenDescriptions.get(norm);
        if (prevDate && prevDate !== r.date) {
          dupes.push(`${prevDate} and ${r.date} prescribe an IDENTICAL workout ("${c.title}") - rewrite one with different movements or rep schemes; vary the programming`);
        } else if (!prevDate) {
          seenDescriptions.set(norm, r.date);
        }
      });
    });
    out.push(...dupes.slice(0, 5));

    return out;
  };

  // Second-opinion pass: a fresh AI call with ONE job - judge a drafted
  // week like a head coach reviewing an assistant's work. A focused critic
  // catches judgment problems (wrong loads, junk volume, equipment misuse,
  // filler reasons) that the writer's overloaded prompt misses and the
  // deterministic validator can't check.
  const serializeWeekForReview = (candidate: PlanRow[]): string =>
    candidate.map(r =>
      `${r.date} ${r.day}: ${r.session}${r.targetRPE ? ` @ ${r.targetRPE}` : ""}${r.runMiles ? ` ${r.runMiles}mi` : ""} | ${(r.components || []).map(c => `[${c.type}] ${c.title}: ${c.description}`).join(" • ") || r.detail}${r.reason ? ` | Why: ${r.reason}` : ""}`
    ).join("\n");

  const critiqueWeek = async (candidate: PlanRow[], weekNumber: number): Promise<string[]> => {
    try {
      const serialized = serializeWeekForReview(candidate);
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are a sharp head coach reviewing an assistant coach's draft week. Respond with valid JSON only." },
          { role: "user", content: `${buildPreferencesSection(preferences)}${athleteBlock}
DRAFTED WEEK ${weekNumber}:
${serialized}

Review THIS WEEK ONLY as this athlete's head coach. Flag ONLY real, concrete problems:
- Loads wrong for THIS athlete (contradict their PRs above, or fake precision on untested lifts)
- Junk volume or nonsensical stimulus (two leg-crushing days back to back, a "recovery" day that isn't)
- Generic filler reasons that ignore this athlete's data, goals, or check-ins
- Movement monotony (same movement hammered day after day)
Do NOT flag equipment usage (a separate reviewer covers that), rest-day counts, class placement, or schedule structure - code already enforces those. Do NOT invent problems to seem thorough: a solid week deserves {"problems": []}.

Respond: {"problems": []} or {"problems": ["date + what's wrong + the fix", ...]} (max 4).` }
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });
      const parsed = tryParseJson(text);
      return parsed && Array.isArray(parsed.problems)
        ? parsed.problems.map((p: unknown) => String(p)).filter(Boolean).slice(0, 4)
        : [];
    } catch (err) {
      console.error("Critic pass failed (non-fatal):", err);
      return [];
    }
  };

  // Equipment analysis: a garage-gym athlete wants their gear USED, and
  // used the way each implement is actually designed to be used. This
  // reviewer has exactly that one job.
  const critiqueEquipment = async (candidate: PlanRow[], weekNumber: number): Promise<string[]> => {
    try {
      const homeDays = candidate.filter(r => !(r.components || []).some(c => c.type === "class") && !r.session.toLowerCase().includes("rest"));
      if (homeDays.length === 0) return [];
      const serialized = homeDays.map(r =>
        `${r.date} ${r.day}: ${(r.components || []).map(c => `[${c.type}] ${c.title}: ${c.description}`).join(" • ") || r.detail}`
      ).join("\n");
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are an equipment specialist reviewing a home-gym training week. Respond with valid JSON only." },
          { role: "user", content: `THE ATHLETE'S SAVED EQUIPMENT LIST (this is EVERYTHING they own at home):
"${preferences.equipment || "(none saved)"}"

${IMPLEMENT_KNOWLEDGE}

THIS WEEK'S HOME SESSIONS (class days excluded - the class gym has full equipment):
${serialized}

Audit equipment use. Flag ONLY:
- Movements requiring gear NOT on the list, or the wrong implement/weight for a listed item (e.g. a dumbbell weight they don't own)
- Mechanically wrong use of an implement (violating the rules above - e.g. back-racked heavy sandbag, heavy-bag overhead press)
- Prescriptions that don't NAME which implement/weight to use when the athlete owns several
- Meaningful underuse: gear on the list that never appears all week when it clearly fits the programmed work (variety matters to a garage athlete)
Do NOT flag class days, scheduling, or coaching philosophy. A week that uses the gear correctly deserves {"problems": []}.

Respond: {"problems": []} or {"problems": ["date + the issue + the fix", ...]} (max 4).` }
        ],
        temperature: 0.2,
        maxTokens: 2000,
      });
      const parsed = tryParseJson(text);
      return parsed && Array.isArray(parsed.problems)
        ? parsed.problems.map((p: unknown) => String(p)).filter(Boolean).slice(0, 4)
        : [];
    } catch (err) {
      console.error("Equipment critique failed (non-fatal):", err);
      return [];
    }
  };

  // Verification round: after a critiqued week is rewritten, check ONLY
  // whether the specific flagged issues were actually fixed. Narrow by
  // design - it cannot raise new issues, so it can't ping-pong forever.
  const verifyCritiqueFixes = async (candidate: PlanRow[], weekNumber: number, flagged: string[]): Promise<string[]> => {
    try {
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You verify whether specific flagged issues were fixed in a rewritten training week. Respond with valid JSON only." },
          { role: "user", content: `A draft of week ${weekNumber} was rejected for these issues:
${flagged.map(f => `- ${f}`).join("\n")}

THE REWRITTEN WEEK:
${serializeWeekForReview(candidate)}

For each flagged issue, judge ONLY whether this rewrite fixed it. Do NOT raise new issues, and do not re-litigate issues that were addressed.
Respond: {"unfixed": []} if every issue was addressed, or {"unfixed": ["the still-broken issue and what's still wrong", ...]}.` }
        ],
        temperature: 0.2,
        maxTokens: 1500,
      });
      const parsed = tryParseJson(text);
      return parsed && Array.isArray(parsed.unfixed)
        ? parsed.unfixed.map((p: unknown) => String(p)).filter(Boolean).slice(0, 4)
        : [];
    } catch (err) {
      console.error("Critique verification failed (non-fatal):", err);
      return [];
    }
  };

  // Whole-plan review after assembly: cross-week judgment (does the
  // progression actually build, do deloads land, does volume wave) that
  // no single-week call can see. Findings go into the chat - the athlete
  // can say "apply your self-review" to patch them.
  const critiquePlanCoherence = async (rows: PlanRow[]): Promise<string[]> => {
    try {
      const byWeek = new Map<number, PlanRow[]>();
      rows.forEach(r => byWeek.set(r.week, [...(byWeek.get(r.week) || []), r]));
      const summary = Array.from(byWeek.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([wk, wr]) => `Wk ${wk} (${wr[0]?.phase || ""}): ${wr.map(r => `${r.day.slice(0, 3)}=${r.session}${r.runMiles ? ` ${r.runMiles}mi` : ""}${r.targetRPE ? ` @${r.targetRPE}` : ""}`).join(", ")}`)
        .join("\n");
      const text = await chatCompletion({
        messages: [
          { role: "system", content: "You are a head coach reviewing a full training block for cross-week coherence. Respond with valid JSON only." },
          { role: "user", content: `${buildPreferencesSection(preferences)}
FULL BLOCK, WEEK BY WEEK:
${summary}

Judge the BLOCK as a whole (not individual days):
- Does volume/intensity actually wave and build, or is every week the same?
- Do deloads exist and land where fatigue would peak?
- Does the block progress toward the athlete's stated events on time (long runs building, taper where it belongs)?
- Any two adjacent weeks that would bury this athlete?
Do NOT flag single-day details or schedule rules. A well-built block deserves {"problems": []}.

Respond: {"problems": []} or {"problems": ["which weeks + what's wrong + the fix", ...]} (max 3).` }
        ],
        temperature: 0.3,
        maxTokens: 1500,
      });
      const parsed = tryParseJson(text);
      return parsed && Array.isArray(parsed.problems)
        ? parsed.problems.map((p: unknown) => String(p)).filter(Boolean).slice(0, 3)
        : [];
    } catch (err) {
      console.error("Coherence pass failed (non-fatal):", err);
      return [];
    }
  };

  // Generate the full plan table: one API call per week, assembled and saved as a draft
  const generatePlanTable = async (
    sessionId: string,
    planMessage: string,
    outline: ProgramOutline,
    conversationHistory: string,
    updatedMessages: AIChatMessage[],
    existingRows: PlanRow[] = []
  ) => {
    // Never program the past: clamp the outline to start no earlier than
    // today, and drop weeks whose entire range is already behind us
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    if (outline.startDate && outline.startDate < todayStr) outline.startDate = todayStr;
    const allWeeks = (outline.weeks || []).slice(0, 20);
    const futureWeeks = allWeeks.filter((w, idx) => {
      const end = allWeeks[idx + 1]?.startDate || outline.endDate || w.startDate;
      return !end || end >= todayStr;
    });
    futureWeeks.forEach(w => {
      if (w.startDate && w.startDate < todayStr) w.startDate = todayStr;
    });

    // Blocks, not whole macrocycles: write day-level rows for the next
    // ~4 weeks only. The rest of the plan stays as the phase outline and
    // is generated block by block from real logged data as the athlete
    // gets there.
    const BLOCK_WEEKS = 4;
    const weeks = futureWeeks.slice(0, BLOCK_WEEKS);
    const remainingAfterBlock = futureWeeks.slice(BLOCK_WEEKS);

    const allRows: PlanRow[] = [...existingRows];
    const failedWeeks: number[] = [];

    for (let i = 0; i < weeks.length; i++) {
      setGenerationProgress({ current: i + 1, total: weeks.length, stage: "writing" });

      let rows: PlanRow[] | null = null;
      let correction = "";
      // Review pipeline per week: draft -> hard-rule validation -> parallel
      // head-coach + equipment critique (once) -> rewrite -> verification
      // that the flagged issues were actually fixed (once) -> accept
      let critiqued = false;
      let pendingCritiques: string[] = [];
      let verifiedOnce = false;
      for (let attempt = 0; attempt < 5 && !rows; attempt++) {
        try {
          setGenerationProgress({ current: i + 1, total: weeks.length, stage: attempt === 0 ? "writing" : "rewriting" });
          const text = await chatCompletion({
            // Fast-reasoning tier: deliberate enough for programming, a
            // fraction of the full reasoning model's latency - the critic
            // pipeline catches what a lighter writer misses
            model: PLAN_MODEL,
            messages: [
              { role: "system", content: "You are Oddo, an expert CrossFit and endurance programming coach. Always respond with valid JSON only." },
              { role: "user", content: buildWeekRowsPrompt(outline, weeks[i], conversationHistory, allRows, correction) }
            ],
            temperature: 0.6,
            maxTokens: 12000,
          });
          const parsed = tryParseJson(text);
          const arr = !parsed ? null : Array.isArray(parsed) ? parsed : parsed.rows;
          if (Array.isArray(arr) && arr.length > 0) {
            const candidate = arr.map((r: Partial<PlanRow>) => sanitizePlanRow(r, weeks[i].weekNumber, weeks[i].focus));
            // Enforce hard schedule rules (rest-day count, class placement):
            // retry with an explicit correction instead of accepting a bad week
            const problems = validateWeekRows(candidate, datesForWeek(outline, weeks[i]), allRows);
            if (attempt < 4 && problems.length > 0) {
              correction = `CORRECTION - YOUR PREVIOUS ATTEMPT WAS REJECTED for these violations:\n${problems.map(p => `- ${p}`).join("\n")}\nRegenerate the ENTIRE week and fix every violation.`;
              continue;
            }
            // Hard rules pass - run both reviewers in parallel (once per
            // week): the head coach judges the training, the equipment
            // specialist audits gear usage
            if (!critiqued && attempt < 4) {
              critiqued = true;
              setGenerationProgress({ current: i + 1, total: weeks.length, stage: "coach + equipment review" });
              const [coachIssues, equipIssues] = await Promise.all([
                critiqueWeek(candidate, weeks[i].weekNumber),
                critiqueEquipment(candidate, weeks[i].weekNumber),
              ]);
              pendingCritiques = [...coachIssues, ...equipIssues];
              if (pendingCritiques.length > 0) {
                correction = `COACHING REVIEW - a head-coach and equipment review of your draft flagged these issues:\n${pendingCritiques.map(c => `- ${c}`).join("\n")}\nRegenerate the ENTIRE week fixing every issue. All schedule rules still apply.`;
                continue;
              }
            } else if (pendingCritiques.length > 0 && !verifiedOnce && attempt < 4) {
              // The rewrite must actually fix what was flagged - verify it
              verifiedOnce = true;
              setGenerationProgress({ current: i + 1, total: weeks.length, stage: "verifying fixes" });
              const unfixed = await verifyCritiqueFixes(candidate, weeks[i].weekNumber, pendingCritiques);
              if (unfixed.length > 0) {
                correction = `VERIFICATION FAILED - your rewrite did NOT fix these flagged issues:\n${unfixed.map(u => `- ${u}`).join("\n")}\nRegenerate the ENTIRE week and fix them completely this time. All schedule rules still apply.`;
                continue;
              }
              pendingCritiques = [];
            }
            rows = candidate;
          }
        } catch (err) {
          console.error(`Error generating week ${weeks[i].weekNumber} (attempt ${attempt + 1}):`, err);
        }
      }

      if (rows) {
        allRows.push(...rows.filter(r => r.date));
      } else {
        failedWeeks.push(weeks[i].weekNumber);
      }
    }

    setGenerationProgress(null);

    // Save the table as a draft plan (doc id = session id)
    const now = Timestamp.now();
    const phaseGoals = (outline.phases || [])
      .map(p => ({ phase: String(p.name || p.phase || "").trim(), weeks: String(p.weeks || "").trim(), goal: String(p.goal || "").trim() }))
      .filter(p => p.phase && p.goal);
    const mergedPhaseGoals = phaseGoals.length > 0 ? phaseGoals : (plan?.phaseGoals || []);
    // Persist the macro outline so later blocks can be generated from it;
    // continuations keep the original full outline
    const isContinuation = existingRows.length > 0;
    const outlineForStore = isContinuation && plan?.outline
      ? plan.outline
      : {
          startDate: outline.startDate || "",
          endDate: outline.endDate || "",
          weeks: futureWeeks.map(w => ({
            weekNumber: w.weekNumber,
            startDate: w.startDate || "",
            focus: w.focus || "",
            ...(w.details ? { details: w.details } : {}),
          })),
        };
    const lastGeneratedWeek = weeks[weeks.length - 1]?.weekNumber || 0;
    const generatedThroughWeek = Math.max(isContinuation ? (plan?.generatedThroughWeek || 0) : 0, lastGeneratedWeek);
    const planDoc: Omit<TrainingPlan, "id"> = {
      userId,
      sessionId,
      title: activeSession?.title || "Training Plan",
      status: "draft",
      startDate: outline.startDate || allRows[0]?.date || "",
      endDate: outline.endDate || allRows[allRows.length - 1]?.date || "",
      rows: allRows,
      ...(mergedPhaseGoals.length > 0 ? { phaseGoals: mergedPhaseGoals } : {}),
      outline: outlineForStore,
      generatedThroughWeek,
      createdAt: plan?.createdAt || now,
      updatedAt: now,
    };
    await setDoc(doc(db, "trainingPlans", sessionId), planDoc);
    setPlan({ id: sessionId, ...planDoc });

    // Anything that slipped through the per-week retries gets auto-corrected
    // on the assembled plan, same as chat patches
    const generationViolations = planWeekViolations(allRows);

    // Cross-week self-review: progression, deloads, taper timing
    const coherenceFindings = weeks.length >= 3 ? await critiquePlanCoherence(allRows) : [];

    let finalText = `${planMessage}\n\nYour plan table is ready: ${allRows.length} days (${planDoc.startDate} to ${planDoc.endDate}). Open "View Plan Table" above to review every row. Tell me what to change - or lock it in and I'll put it on your calendar.\n\nWeekly structure:\n${planWeekSummary(allRows)}`;
    if (remainingAfterBlock.length > 0 && weeks.length > 0) {
      finalText += `\n\n📦 Day-by-day programming covers weeks ${weeks[0].weekNumber}-${weeks[weeks.length - 1].weekNumber} (this block). The rest of the plan stays as the phase outline - when this block winds down, tap "Build my next block" and I'll write the next ${Math.min(remainingAfterBlock.length, 4)} weeks from what you actually logged.`;
    }
    if (coherenceFindings.length > 0) {
      finalText += `\n\n🧐 My own review of the full block found:\n${coherenceFindings.map(f => `- ${f}`).join("\n")}\nSay "apply your self-review" and I'll patch these, or lock the plan as-is.`;
    }
    if (failedWeeks.length > 0) {
      finalText += `\n\n(Heads up: week${failedWeeks.length > 1 ? "s" : ""} ${failedWeeks.join(", ")} failed to generate - ask me to fill ${failedWeeks.length > 1 ? "them" : "it"} in.)`;
    }
    if (generationViolations.length > 0) {
      finalText += `\n\n⚠️ ${generationViolations.length} schedule issue${generationViolations.length > 1 ? "s" : ""} detected - auto-correcting now...`;
    }

    const assistantMessage: AIChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: finalText,
      timestamp: Timestamp.now(),
    };
    const finalMessages = [...updatedMessages, assistantMessage];
    await updateDoc(doc(db, "aiProgrammingSessions", sessionId), {
      messages: stripOldWorkouts(finalMessages),
      programWeeks: weeks.length,
      updatedAt: Timestamp.now(),
    });
    setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
    setShowPlanModal(true);

    if (generationViolations.length > 0) {
      await correctPlanViolations({ id: sessionId, ...planDoc }, finalMessages, conversationHistory);
    }
  };

  // Apply targeted row changes from a revision. Returns the updated plan,
  // remaining schedule violations, and the message list (for auto-correction).
  const applyPlanPatch = async (
    patchRows: Partial<PlanRow>[],
    message: string,
    updatedMessages: AIChatMessage[],
    basePlan?: TrainingPlan
  ): Promise<{ updatedPlan: TrainingPlan; violations: string[]; finalMessages: AIChatMessage[] } | undefined> => {
    const target = basePlan || plan;
    if (!target || !activeSession) return undefined;

    const byDate = new Map(target.rows.map(r => [r.date, r]));
    patchRows.forEach(r => {
      const prev = r.date ? byDate.get(String(r.date)) : undefined;
      const clean = sanitizePlanRow(r, prev?.week || Number(r.week) || 1, String(prev?.phase || r.phase || ""));
      if (!clean.date) return;
      byDate.set(clean.date, clean);
    });
    const newRows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    // Repair every row's week number deterministically - patched rows routinely
    // arrive with wrong or missing weeks, and older plans may carry stale ones
    if (newRows.length > 0) {
      const start = newRows[0].date;
      newRows.forEach(r => { r.week = weekNumberForDate(start, r.date); });
    }

    const updatedPlan: TrainingPlan = { ...target, rows: newRows, status: "draft", updatedAt: Timestamp.now() };
    await setDoc(doc(db, "trainingPlans", target.id), { rows: newRows, status: "draft", updatedAt: Timestamp.now() }, { merge: true });
    setPlan(updatedPlan);

    // A patch must never silently break the athlete's schedule rules
    const violations = planWeekViolations(newRows);
    const violationNote = violations.length > 0
      ? `\n\n⚠️ Schedule check after this change:\n${violations.map(v => `- ${v}`).join("\n")}`
      : "";

    const assistantMessage: AIChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: `${message}\n\n(${patchRows.length} day${patchRows.length > 1 ? "s" : ""} updated in the plan table - review and lock when ready.)\n\nWeekly structure:\n${planWeekSummary(newRows)}${violationNote}`,
      timestamp: Timestamp.now(),
    };
    const finalMessages = [...updatedMessages, assistantMessage];
    await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), {
      messages: stripOldWorkouts(finalMessages),
      updatedAt: Timestamp.now(),
    });
    setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
    return { updatedPlan, violations, finalMessages };
  };

  // Run automatic correction rounds on a plan until it passes the schedule
  // checks (capped - each round sees the fresh violation list)
  const correctPlanViolations = async (
    startPlan: TrainingPlan,
    startMessages: AIChatMessage[],
    conversationHistory: string
  ) => {
    let current = {
      updatedPlan: startPlan,
      violations: planWeekViolations(startPlan.rows),
      finalMessages: startMessages,
    };
    for (let round = 0; round < 3 && current.violations.length > 0; round++) {
      try {
        const fixText = await chatCompletion({
          model: REVISION_MODEL,
          messages: [
            { role: "system", content: "You are Oddo, an expert CrossFit programming coach. Always respond with valid JSON." },
            { role: "user", content: `${buildRevisionPrompt(current.updatedPlan, conversationHistory)}\n\nDo NOT discuss. Respond ONLY with {"message": "...", "patchRows": [...]} that fixes EVERY schedule violation listed above in ONE patch. Fix them in the direction of the athlete's LATEST request: if they asked for a recurring structure change (e.g., "rest on Fridays"), apply it to EVERY week and convert the displaced day to training - do not undo what they asked for, and keep the weekly structure identical across all full weeks.` },
          ],
          temperature: 0.5,
          maxTokens: 16000,
        });
        const fix = tryParseJson(fixText);
        if (!fix || !Array.isArray(fix.patchRows) || fix.patchRows.length === 0) break;
        const next = await applyPlanPatch(
          fix.patchRows,
          `Auto-correction: ${fix.message || "restored your schedule rules."}`,
          current.finalMessages,
          current.updatedPlan
        );
        if (!next) break;
        current = next;
      } catch (fixErr) {
        console.error("Auto-correction round failed:", fixErr);
        break;
      }
    }
  };

  // Apply a patch, then auto-correct any schedule violations it leaves behind
  const applyPatchWithCorrections = async (
    patchRows: Partial<PlanRow>[],
    message: string,
    updatedMessages: AIChatMessage[],
    conversationHistory: string
  ) => {
    const result = await applyPlanPatch(patchRows, message, updatedMessages);
    if (result && result.violations.length > 0) {
      await correctPlanViolations(result.updatedPlan, result.finalMessages, conversationHistory);
    }
  };

  // Deterministic baseline week (base-tier: programming ends after baselining)
  const [addingBaseline, setAddingBaseline] = useState(false);
  const handleAddBaselineWeek = async () => {
    if (!baselineStatus || addingBaseline) return;
    // Commercial gyms always have loadable equipment; at home, look for any
    // mention of something loadable in the equipment list
    const hasLoadableEquipment = (preferences.trainingEnvironment || "home") === "commercial" ||
      /(barbell|dumbbell|\bdbs?\b|kettlebell|\bkbs?\b|sandbag|plate|weight)/i.test(preferences.equipment || "");
    const daysPlan = buildBaselineWeek(baselineStatus, preferences.trainingStyle, hasLoadableEquipment);
    if (daysPlan.length === 0) {
      alert("Your baseline minimums are already covered - nothing to schedule!");
      return;
    }
    setAddingBaseline(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1); // begin tomorrow
      for (const day of daysPlan) {
        const d = new Date(start);
        d.setDate(d.getDate() + day.dayOffset);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await addDoc(collection(db, "personalWorkouts"), {
          userId,
          date: Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)),
          dateString: ds,
          components: day.components.map((c, i) => ({
            id: `baseline-${i}`,
            type: c.type,
            title: c.title,
            description: c.description,
            ...(c.scoringType ? { scoringType: c.scoringType } : {}),
          })),
          createdAt: Timestamp.now(),
        });
      }
      alert(`Baseline week added: ${daysPlan.length} test day${daysPlan.length > 1 ? "s" : ""} on your calendar starting tomorrow. Log each result - Oddo coaches from those numbers.`);
      onPublish?.();
    } catch (err) {
      console.error("Error adding baseline week:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Couldn't add the baseline week: ${message}`);
    } finally {
      setAddingBaseline(false);
    }
  };

  // Wizard logged a test: update local baseline data so status recomputes
  const handleBaselineLogged = (category: BaselineCategory, name: string) => {
    setBaselineRaw(prev => prev ? {
      ...prev,
      liftTitles: category === "lift" ? [...prev.liftTitles, name] : prev.liftTitles,
      skillNames: (category === "skill" || category === "bodyweight") ? [...prev.skillNames, name] : prev.skillNames,
      wodTitles: category === "wod" ? [...prev.wodTitles, name] : prev.wodTitles,
      cardioLogs: category === "cardio" ? [...prev.cardioLogs, { activity: "run", miles: 1 }] : prev.cardioLogs,
    } : prev);
  };

  // Chat mentioned new gear: append it to the saved equipment list so the
  // whole app (programming, daily advice, % hints) knows about it
  const applyEquipmentAdditions = async (items: string[]) => {
    try {
      const current = (await fetchPreferencesFromDb()) || preferences;
      const existingLower = (current.equipment || "").toLowerCase();
      const newItems = items.map(s => s.trim()).filter(s => s && !existingLower.includes(s.toLowerCase()));
      if (newItems.length === 0) return;
      const equipment = current.equipment ? `${current.equipment}, ${newItems.join(", ")}` : newItems.join(", ");
      setPreferences(prev => ({ ...prev, equipment }));
      if (preferencesDocId) {
        await updateDoc(doc(db, "aiProgrammingPreferences", preferencesDocId), { equipment, updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Error saving equipment additions:", err);
    }
  };

  // Wizard learned what equipment the athlete has: persist it to preferences
  const handleEquipmentNote = async (note: string) => {
    const next = { ...preferences, equipment: preferences.equipment ? `${preferences.equipment}; ${note}` : note };
    setPreferences(next);
    try {
      const prefData = {
        userId,
        ...next,
        events: (next.events || []).map(e => ({ id: e.id, type: e.type, name: e.name || "", date: e.date || "", detail: e.detail || "" })),
        weeklySchedule: Object.fromEntries(
          Object.entries(next.weeklySchedule || {}).filter(([, s]) => s).map(([day, s]) => [
            day,
            { mode: s!.mode, classDescription: s!.classDescription || "", classAttendance: s!.classAttendance || "always", maxMinutes: s!.maxMinutes || 0 },
          ])
        ),
        updatedAt: serverTimestamp(),
      };
      if (preferencesDocId) {
        await updateDoc(doc(db, "aiProgrammingPreferences", preferencesDocId), prefData);
      } else {
        const ref = await addDoc(collection(db, "aiProgrammingPreferences"), prefData);
        setPreferencesDocId(ref.id);
      }
    } catch (err) {
      console.error("Error saving equipment note:", err);
    }
  };

  // Import a plan pasted as JSON (e.g., converted from a spreadsheet)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleImportPlan = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const parsed = tryParseJson(importText);
      const rawRows = Array.isArray(parsed) ? parsed : parsed?.rows;
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error("Couldn't find plan rows in the pasted text - paste the plan JSON exactly as provided.");
      }
      const rows = rawRows
        .map((r: Partial<PlanRow>) => sanitizePlanRow(r, Number(r.week) || 1, String(r.phase || "Training")))
        .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length === 0) {
        throw new Error("No rows had valid dates (expected YYYY-MM-DD).");
      }

      const title = (parsed && !Array.isArray(parsed) && parsed.title)
        ? String(parsed.title).slice(0, 80)
        : `Imported Plan ${rows[0].date}`;

      // Create a session to own this plan
      const newSession: Omit<AIProgrammingSession, "id"> = {
        userId,
        createdBy: userId,
        title,
        status: "active",
        messages: [{
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: `Imported your plan: ${rows.length} days from ${rows[0].date} to ${rows[rows.length - 1].date}. Open "View Plan Table" to review it, then Lock & Add to Calendar. You can still ask me to change any day.`,
          timestamp: Timestamp.now(),
        }],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "aiProgrammingSessions"), newSession);

      const now = Timestamp.now();
      const planDoc: Omit<TrainingPlan, "id"> = {
        userId,
        sessionId: docRef.id,
        title,
        status: "draft",
        startDate: rows[0].date,
        endDate: rows[rows.length - 1].date,
        rows,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, "trainingPlans", docRef.id), planDoc);

      const session = { id: docRef.id, ...newSession };
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setPlan({ id: docRef.id, ...planDoc });
      setImportText("");
      setShowImportModal(false);
      setShowPlanModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  // Lock the plan and publish every row to the athlete's calendar
  const lockAndPublishPlan = async () => {
    if (!plan || isPublishingPlan) return;
    setIsPublishingPlan(true);
    setError(null);

    try {
      // Replace any AI-planned workouts on the plan's dates - but never
      // touch dates already behind us: past days may carry the athlete's
      // logs, and rewriting history helps no one
      const pubT = new Date();
      const pubToday = `${pubT.getFullYear()}-${String(pubT.getMonth() + 1).padStart(2, "0")}-${String(pubT.getDate()).padStart(2, "0")}`;
      const targetDates = new Set(plan.rows.map(r => r.date).filter(ds => ds && ds >= pubToday));
      const existingSnap = await getDocs(query(
        collection(db, "personalWorkouts"),
        where("userId", "==", userId)
      ));
      const toDelete = existingSnap.docs.filter(d => {
        const x = d.data();
        const ds = x.dateString || x.date?.toDate?.()?.toISOString?.().split("T")[0];
        return x.aiSessionId && ds && targetDates.has(ds);
      });
      let delBatch = writeBatch(db);
      let delPending = 0;
      for (const d of toDelete) {
        delBatch.delete(d.ref);
        delPending++;
        if (delPending >= 400) { await delBatch.commit(); delBatch = writeBatch(db); delPending = 0; }
      }
      if (delPending > 0) await delBatch.commit();

      // Write one calendar workout per non-rest row
      let batch = writeBatch(db);
      let pending = 0;
      let written = 0;
      for (const row of plan.rows) {
        if (!row.date || row.date < pubToday || row.session.toLowerCase().includes("rest")) continue;
        const [y, m, d] = row.date.split("-").map(Number);
        const workoutDate = new Date(y, m - 1, d, 12, 0, 0);
        if (isNaN(workoutDate.getTime())) continue;

        const noteBits = [
          `Phase: ${row.phase}`,
          row.targetRPE ? `Effort ${effortValueToPercent(row.targetRPE)}` : "",
          row.estMinutes ? `~${row.estMinutes} min` : "",
          row.runMiles ? `${row.runMiles} mi planned` : "",
          row.reason ? `Why: ${rpeToPercentEffort(row.reason)}` : "",
        ].filter(Boolean).join(" • ");

        const components = (row.components && row.components.length > 0)
          ? row.components.map((c, idx) => {
              // Upgrade legacy component types (plans locked before the type split)
              let type = c.type;
              if (type === "cardio" || (type === "wod" && /^(run|cardio|swim|bike|row|ruck)$/i.test(c.title.trim()))) {
                type = cardioActivityForComponent("cardio", c.title) || "run";
              }
              if ((type === "wod" || type === "lift") && /\bclass\b/i.test(c.title)) type = "class";
              // Class content is the class coach's call (scanned in later) -
              // strip any generated advice no matter what the model wrote
              if (type === "class") {
                return {
                  id: `comp-${idx}`,
                  type,
                  title: c.title,
                  description: "Follow the coach's programming.",
                  notes: idx === 0 ? `Phase: ${row.phase}` : "",
                };
              }
              return {
                id: `comp-${idx}`,
                type,
                title: c.title,
                description: rpeToPercentEffort(c.description || ""),
                // WODs need a scoring type so the logger offers the right
                // score entry (AMRAP = rounds+reps, not a time)
                ...(type === "wod" ? { scoringType: inferScoringType(`${c.title} ${c.description}`) } : {}),
                notes: idx === 0 ? noteBits : "",
              };
            })
          : [row.session.toLowerCase().includes("class")
            ? {
                id: "comp-0",
                type: "class" as const,
                title: row.session,
                description: "Follow the coach's programming.",
                notes: `Phase: ${row.phase}`,
              }
            : {
                id: "comp-0",
                type: "wod" as const,
                title: row.session,
                description: rpeToPercentEffort(row.detail || ""),
                scoringType: inferScoringType(`${row.session} ${row.detail}`),
                notes: noteBits,
              }];

        const workoutRef = doc(collection(db, "personalWorkouts"));
        batch.set(workoutRef, {
          userId: String(userId),
          date: Timestamp.fromDate(workoutDate),
          dateString: row.date,
          components,
          createdAt: serverTimestamp(),
          aiSessionId: plan.sessionId,
        });
        pending++;
        written++;
        if (pending >= 400) { await batch.commit(); batch = writeBatch(db); pending = 0; }
      }
      if (pending > 0) await batch.commit();

      await setDoc(doc(db, "trainingPlans", plan.id), { status: "locked", updatedAt: Timestamp.now() }, { merge: true });
      setPlan(prev => prev ? { ...prev, status: "locked" } : null);
      setShowPlanModal(false);
      onPublish?.();
      alert(`Plan locked! ${written} workouts added to your calendar.`);
    } catch (err) {
      console.error("Error publishing plan:", err);
      setError("Failed to publish the plan to your calendar");
    } finally {
      setIsPublishingPlan(false);
    }
  };

  const getAllGeneratedWorkouts = (): AIGeneratedDay[] => {
    if (!activeSession) return [];

    // Get the most recent message with workouts
    for (let i = activeSession.messages.length - 1; i >= 0; i--) {
      const msg = activeSession.messages[i];
      if (msg.generatedWorkouts && msg.generatedWorkouts.length > 0) {
        return msg.generatedWorkouts;
      }
    }
    return [];
  };

  const publishToCalendar = async () => {
    if (!activeSession) return;

    const workouts = getAllGeneratedWorkouts();
    if (workouts.length === 0) return;

    if (!userId) {
      setError("Missing user information");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      // Replace any AI-planned workouts already sitting on the dates being published
      // (covers regenerating a day/week and re-publishing a program without duplicates)
      const targetDates = new Set<string>();
      workouts.forEach(day => {
        if (day.date && day.date.includes("-")) targetDates.add(day.date);
      });
      if (targetDates.size > 0) {
        const existingSnap = await getDocs(query(
          collection(db, "personalWorkouts"),
          where("userId", "==", userId)
        ));
        const toDelete = existingSnap.docs.filter(d => {
          const x = d.data();
          const ds = x.dateString || x.date?.toDate?.()?.toISOString?.().split("T")[0];
          return x.aiSessionId && ds && targetDates.has(ds);
        });
        let delBatch = writeBatch(db);
        let delPending = 0;
        for (const d of toDelete) {
          delBatch.delete(d.ref);
          delPending++;
          if (delPending >= 400) {
            await delBatch.commit();
            delBatch = writeBatch(db);
            delPending = 0;
          }
        }
        if (delPending > 0) {
          await delBatch.commit();
        }
      }

      // Write in batches so long programs (60-90+ days) publish in seconds
      let batch = writeBatch(db);
      let pending = 0;

      // Create a personal workout for each day
      for (const day of workouts) {
        if (day.isRestDay) continue;
        if (!day.components || day.components.length === 0) continue;

        // Build components array - include notes and scoringType if present
        const cleanComponents: Array<{id: string; type: string; title: string; description: string; notes?: string; scoringType?: string}> = [];

        for (let idx = 0; idx < day.components.length; idx++) {
          const comp = day.components[idx];
          if (!comp || !comp.type || !comp.title) continue;

          // Build component with required fields
          const component: {id: string; type: string; title: string; description: string; notes?: string; scoringType?: string} = {
            id: String(`comp-${idx}`),
            type: String(comp.type || "wod"),
            title: String(comp.title || "Workout"),
            description: String(comp.description || ""),
          };

          // Add notes if present
          if (comp.notes) {
            component.notes = String(comp.notes);
          }

          // Add scoringType for WOD components (fortime, amrap, emom)
          if (comp.type === "wod" && comp.scoringType) {
            component.scoringType = String(comp.scoringType);
          }

          cleanComponents.push(component);
        }

        // Skip if no valid components
        if (cleanComponents.length === 0) continue;

        // Build workout date - parse as local time to avoid timezone issues
        // When parsing "YYYY-MM-DD", JavaScript treats it as UTC which can shift the day
        // So we parse the components manually to ensure local time
        let workoutDate: Date;
        let dateString: string | null = null;
        if (day.date && day.date.includes('-')) {
          const [year, month, dayNum] = day.date.split('-').map(Number);
          workoutDate = new Date(year, month - 1, dayNum, 12, 0, 0); // noon local time
          dateString = day.date;
        } else {
          workoutDate = new Date(day.date);
        }
        if (isNaN(workoutDate.getTime())) continue; // Skip invalid dates

        // Create the workout on the athlete's personal calendar
        const workoutRef = doc(collection(db, "personalWorkouts"));
        batch.set(workoutRef, {
          userId: String(userId),
          date: Timestamp.fromDate(workoutDate),
          ...(dateString ? { dateString } : {}),
          components: cleanComponents,
          createdAt: serverTimestamp(),
          aiSessionId: activeSession.id, // Track which AI programming session created this workout
        });
        pending++;
        if (pending >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          pending = 0;
        }
      }

      if (pending > 0) {
        await batch.commit();
      }

      // Update session status
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), {
        status: "published",
        updatedAt: Timestamp.now(),
      });

      setActiveSession(prev => prev ? { ...prev, status: "published" } : null);
      setShowPreview(false);
      onPublish?.();
      alert("Programming added to your calendar!");
    } catch (err) {
      console.error("PUBLISH_ERROR_V2:", err);
      setError("Failed to publish programming");
    } finally {
      setIsPublishing(false);
    }
  };

  const generatedWorkouts = getAllGeneratedWorkouts();

  if (loadingSessions) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading AI Programming...</p>
      </div>
    );
  }

  // Show paywall if user doesn't have an active subscription
  if (!hasActiveSubscription) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <AITrainerPaywall userEmail={userEmail} />
      </div>
    );
  }

  // Base Oddo subscribers: the baseline assessment is included (Oddo coaches
  // from those numbers), but ongoing programming is the add-on
  if (!hasAIProgramming(subscription)) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {baselineStatus && !baselineStatus.meetsMinimum && (
          <div className="border-b border-gray-200">
            <div className="px-4 pt-4">
              <h2 className="text-lg font-bold text-gray-900">🎯 Step 1: Baseline Assessment (included with Coach Oddo)</h2>
            </div>
            <BaselineWizard
              userId={userId}
              status={baselineStatus}
              trainingStyle={preferences.trainingStyle}
              trainingEnvironment={preferences.trainingEnvironment}
              equipment={preferences.equipment}
              onEquipmentNote={handleEquipmentNote}
              onLogged={handleBaselineLogged}
              onScheduleRemaining={handleAddBaselineWeek}
              scheduling={addingBaseline}
            />
          </div>
        )}
        <div className="p-8 text-center bg-gradient-to-br from-purple-50 to-indigo-50">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ongoing AI Programming is an Add-On</h2>
          <p className="text-gray-600 max-w-md mx-auto mb-1">
            Coach Oddo subscription covers advice, scaling, workout scanning, logging - and the baseline assessment above.
          </p>
          <p className="text-gray-600 max-w-md mx-auto mb-5">
            Upgrade to <span className="font-semibold">Oddo + Programming</span> (${PRICING.AI_PROGRAMMING_MONTHLY}/mo)
            and it will also build your full day-by-day training plan - phases, runs, lifts, WODs, and rest days -
            that you can revise in chat and lock onto your calendar.
          </p>
          <a
            href="/subscribe"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
          >
            Add AI Programming
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Coach Oddo</h2>
              <p className="text-white/80 text-sm">Programming built for your garage gym</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium ${
                prefsChecked && !preferencesDocId
                  ? "bg-amber-400 hover:bg-amber-300 text-amber-950 animate-pulse font-bold"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
              title="Your Training Profile - style, schedule, events, equipment"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">{prefsChecked && !preferencesDocId ? "Set Up Profile!" : "Training Profile"}</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
              title="Import a plan from JSON (e.g., converted from a spreadsheet)"
            >
              ⬆ Import
            </button>
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New Program
            </button>
          </div>
        </div>
      </div>

      {/* New-user setup gate: no saved preferences yet */}
      {prefsChecked && !preferencesDocId && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">👋 First things first - set up your training profile</p>
              <p className="text-sm text-amber-800 mt-0.5">
                Tell Oddo your training style, where you train, your weekly schedule, and any events you&apos;re training for.
                Don&apos;t know your lift numbers or paces yet? No problem - Oddo builds baseline tests into your first week and programs from the results.
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-colors shrink-0"
            >
              Set Up My Training
            </button>
          </div>
        </div>
      )}

      {/* Baseline wizard: ask, quick-log, or program the missing standard tests */}
      {baselineStatus && !baselineStatus.meetsMinimum && (
        <BaselineWizard
          userId={userId}
          status={baselineStatus}
          trainingStyle={preferences.trainingStyle}
          trainingEnvironment={preferences.trainingEnvironment}
          equipment={preferences.equipment}
          onEquipmentNote={handleEquipmentNote}
          onLogged={handleBaselineLogged}
          onScheduleRemaining={handleAddBaselineWeek}
          scheduling={addingBaseline}
        />
      )}

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex gap-2 p-3 border-b border-gray-200 overflow-x-auto bg-gray-50">
          {sessions.slice(0, 5).map(session => (
            <div key={session.id} className="relative group flex items-center gap-1">
              {editingSessionId === session.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => updateSessionTitle(session.id, editingTitle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateSessionTitle(session.id, editingTitle);
                    if (e.key === "Escape") {
                      setEditingSessionId(null);
                      setEditingTitle("");
                    }
                  }}
                  autoFocus
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-900 bg-white border-2 border-purple-500 focus:outline-none min-w-[120px]"
                />
              ) : (
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveSession(session)}
                    className={`px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                      activeSession?.id === session.id
                        ? "bg-purple-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {session.title}
                    {session.status === "published" && (
                      <span className="ml-2 text-xs opacity-70">✓</span>
                    )}
                  </button>
                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(session.id);
                      setEditingTitle(session.title);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 border-l border-gray-200 transition-colors"
                    title="Rename program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border-l border-gray-200 transition-colors disabled:opacity-50"
                    title="Delete program"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plan table bar */}
      {activeSession && plan && (
        <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span>📋</span>
            <span className="font-medium text-purple-900">Training Plan</span>
            <span className="text-purple-700 text-xs">{plan.startDate} → {plan.endDate} • {plan.rows.length} days</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              plan.status === "locked" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {plan.status === "locked" ? "Locked ✓" : "Draft"}
            </span>
          </div>
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Plan Table
          </button>
        </div>
      )}

      {/* Chat Area */}
      {activeSession ? (
        <>
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {activeSession.messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ask Your Coach for Programming</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                  Tell your Oddo about your goals, equipment, and schedule. For example:
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>&quot;Program my next week - I have a barbell, rings, and a rower&quot;</p>
                  <p>&quot;Program every day until my marathon on October 25 - I also have a comp on the 7th&quot;</p>
                  <p>&quot;I can train 4 days a week, 45 minutes max, build me a plan&quot;</p>
                </div>
              </div>
            ) : (
              activeSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Show generated workouts preview */}
                    {message.generatedWorkouts && message.generatedWorkouts.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Generated {message.generatedWorkouts.length} days of programming
                          </span>
                          <button
                            onClick={() => setShowPreview(true)}
                            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                          >
                            Preview & Publish
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {message.generatedWorkouts.slice(0, 14).map((day, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded text-center text-xs ${
                                day.isRestDay
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {(dayNameForDate(day.date) || day.dayOfWeek || "").slice(0, 3)}
                            </div>
                          ))}
                        </div>
                        {message.generatedWorkouts.length > 14 && (
                          <p className="text-xs text-gray-500 mt-2">
                            + {message.generatedWorkouts.length - 14} more days - open Preview to see the full plan
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {generationProgress ? (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Week {generationProgress.current} of {generationProgress.total}: {generationProgress.stage || "writing"}...
                        </p>
                        <p className="text-xs text-gray-400">Each week is written, reviewed by two critics, and verified - hang tight</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            {/* Phase check-in: once a plan is locked, review actual results
                and adjust the weeks ahead instead of trusting the original
                guesses for the whole block */}
            {plan && plan.status === "locked" && !isLoading && (
              <button
                onClick={() => sendMessage("Review my completed training so far: compare what I actually logged (weights, times, check-ins) against what was programmed. Then adjust the UPCOMING weeks only - keep what's working, fix loads that were off, re-anchor any percentages to my newly logged numbers, and replace any guessed baselines with my real ones. Tell me what you changed and why.")}
                className="w-full mb-3 py-2.5 bg-purple-50 text-purple-700 text-sm font-semibold rounded-lg hover:bg-purple-100 transition-colors"
              >
                📊 Check my progress & adjust the upcoming weeks
              </button>
            )}
            {plan && nextBlockAvailable && !isLoading && (
              <button
                onClick={generateNextBlock}
                className="w-full mb-3 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
              >
                📦 Build my next block (written from what I&apos;ve logged)
              </button>
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Describe the programming you need..."
                disabled={isLoading || activeSession.status === "published"}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || activeSession.status === "published"}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
            {activeSession.status === "published" && (
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-gray-500">
                  This program has been added to your calendar.
                </p>
                <button
                  onClick={() => deletePublishedWorkouts(activeSession.id)}
                  disabled={isDeleting}
                  className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Removing..." : "Unpublish & Remove Workouts"}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Program</h3>
          <p className="text-gray-500 text-sm mb-4">
            Ask your Oddo to build your next training block
          </p>
          <button
            onClick={createNewSession}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create New Program
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && generatedWorkouts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Preview Programming</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedWorkouts.map((day, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${
                      day.isRestDay
                        ? "bg-gray-50 border-gray-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900">{dayNameForDate(day.date) || day.dayOfWeek}</span>
                      <span className="text-sm text-gray-500">{day.date}</span>
                    </div>
                    {day.isRestDay ? (
                      <p className="text-gray-500 text-sm">Rest Day</p>
                    ) : (
                      <div className="space-y-2">
                        {day.components.map((comp, compIdx) => (
                          <div key={compIdx} className="text-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${workoutComponentColors[comp.type]?.bg || "bg-gray-100"} ${workoutComponentColors[comp.type]?.text || "text-gray-700"}`}>
                                {(workoutComponentLabels[comp.type] || comp.type).toUpperCase()}
                              </span>
                              {comp.type === "wod" && comp.scoringType && (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  comp.scoringType === "fortime" ? "bg-blue-100 text-blue-700" :
                                  comp.scoringType === "amrap" ? "bg-green-100 text-green-700" :
                                  comp.scoringType === "emom" ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {comp.scoringType === "fortime" ? "For Time" : comp.scoringType.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900">{comp.title}</p>
                            <p className="text-gray-600 text-xs whitespace-pre-line">{comp.description}</p>
                            {comp.notes && (
                              <div className="mt-1 p-1.5 bg-gray-50 rounded border-l-2 border-gray-300">
                                <p className="text-gray-500 text-xs whitespace-pre-line italic">{comp.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={publishToCalendar}
                  disabled={isPublishing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? "Adding..." : `Add ${generatedWorkouts.filter(d => !d.isRestDay).length} Workouts to My Calendar`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Plan Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import a Training Plan</h3>
              <p className="text-sm text-gray-500">Paste plan JSON (one row per day). It loads exactly as written - no AI involved - and becomes a draft plan table you can review, revise, and lock onto your calendar.</p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"title": "My Plan", "rows": [{"date": "2026-07-29", "day": "Wednesday", "week": 1, "phase": "Base", "session": "Run + CrossFit", "detail": "...", "runMiles": 2.5, "components": [...] }]}'
                rows={12}
                className="w-full h-full min-h-[260px] px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowImportModal(false); setError(null); }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImportPlan}
                disabled={isImporting || !importText.trim()}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? "Importing..." : "Import Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Table Modal */}
      {showPlanModal && plan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Your Training Plan</h3>
                <p className="text-sm text-gray-500">
                  {plan.startDate} → {plan.endDate} • {plan.rows.length} days • {plan.status === "locked" ? "Locked - on your calendar" : "Draft - not on your calendar yet"}
                </p>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {/* Phase map: what each stretch of the block is FOR. Falls back
                  to phase names/week ranges derived from the rows when the
                  plan predates stored phase goals. */}
              {(() => {
                const stored = plan.phaseGoals && plan.phaseGoals.length > 0 ? plan.phaseGoals : null;
                const derived: { phase: string; weeks: string; goal: string }[] = [];
                if (!stored) {
                  plan.rows.forEach(r => {
                    const last = derived[derived.length - 1];
                    if (last && last.phase === r.phase) {
                      const [a] = last.weeks.split("-");
                      last.weeks = Number(a) === r.week ? last.weeks : `${a}-${r.week}`;
                    } else if (r.phase) {
                      derived.push({ phase: r.phase, weeks: String(r.week), goal: "" });
                    }
                  });
                }
                const phases = stored || derived;
                if (phases.length < 2 && !stored) return null;
                return (
                  <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">The plan, phase by phase</p>
                    <div className="space-y-1.5">
                      {phases.map((p, i) => (
                        <p key={i} className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">{p.phase}</span>
                          {p.weeks && <span className="text-gray-400"> (wk {p.weeks})</span>}
                          {p.goal && <> — {p.goal}</>}
                        </p>
                      ))}
                    </div>
                    {nextBlockAvailable && (
                      <p className="text-xs text-purple-600 mt-2">
                        📦 Day-by-day rows cover the current block (through week {plan.generatedThroughWeek}). Later weeks get written from your actual logs when you build the next block.
                      </p>
                    )}
                  </div>
                );
              })()}
              <PlanTable rows={plan.rows} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                Want changes? Close this and tell your coach in the chat (e.g., &quot;week 3 is too much&quot;, &quot;no Friday runs&quot;) - only the affected days get rewritten.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={lockAndPublishPlan}
                  disabled={isPublishingPlan}
                  className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishingPlan
                    ? "Publishing..."
                    : plan.status === "locked"
                    ? "Republish to Calendar"
                    : "Lock & Add to Calendar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-xl">
              <h3 className="text-lg font-semibold text-white">AI Programming Preferences</h3>
              <p className="text-white/80 text-sm">Tell your coach about your setup and how you like to train</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Training Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What are you training for?
                </label>
                <p className="text-xs text-gray-500 mb-2">Add races and competitions - the AI builds phases and tapers around them and puts event day on your calendar</p>
                <div className="space-y-2">
                  {(preferences.events || []).map((ev) => (
                    <div key={ev.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={ev.type}
                          onChange={(e) => updateEvent(ev.id, "type", e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="running_race">🏃 Running race</option>
                          <option value="crossfit_comp">🏋️ CrossFit competition</option>
                          <option value="other">🎯 Other event</option>
                        </select>
                        <input
                          type="date"
                          value={ev.date}
                          onChange={(e) => updateEvent(ev.id, "date", e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        />
                        <button
                          onClick={() => removeEvent(ev.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove event"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ev.name}
                          onChange={(e) => updateEvent(ev.id, "name", e.target.value)}
                          placeholder={ev.type === "running_race" ? "Race name (optional)" : "Event name (optional)"}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        />
                        {ev.type === "running_race" ? (
                          <select
                            value={ev.detail || "Marathon"}
                            onChange={(e) => updateEvent(ev.id, "detail", e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          >
                            {RACE_DISTANCES.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={ev.detail || ""}
                            onChange={(e) => updateEvent(ev.id, "detail", e.target.value)}
                            placeholder="Details (optional)"
                            className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          />
                        )}
                      </div>
                      {ev.date && (
                        <p className="text-xs text-purple-600">
                          {(() => {
                            const days = Math.ceil((new Date(ev.date + "T12:00:00").getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                            if (days < 0) return "This event has passed";
                            if (days === 0) return "Today!";
                            return `${days} days away (${Math.floor(days / 7)} weeks)`;
                          })()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEvent}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  + Add race or competition
                </button>
              </div>

              {/* Weekly Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Weekly Schedule
                </label>
                <p className="text-xs text-gray-500 mb-2">Train = available to train (not required). Lock in class days, rest days, and optional time limits - the AI respects these in every week it writes</p>
                <div className="space-y-1.5">
                  {WEEKDAYS.map(({ key, label }) => {
                    const setting = preferences.weeklySchedule?.[key] || { mode: "open" as const };
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-10 text-sm font-medium text-gray-600 shrink-0">{label}</span>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs shrink-0">
                          {([
                            { mode: "open" as const, text: "Train" },
                            { mode: "class" as const, text: "Class" },
                            { mode: "rest" as const, text: "Rest" },
                          ]).map(({ mode, text }) => (
                            <button
                              key={mode}
                              onClick={() => updateScheduleDay(key, mode)}
                              className={`px-2.5 py-1 font-medium transition-colors ${
                                setting.mode === mode
                                  ? mode === "rest"
                                    ? "bg-gray-600 text-white"
                                    : mode === "class"
                                    ? "bg-blue-600 text-white"
                                    : "bg-purple-600 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                        {setting.mode === "class" && (
                          <>
                            <input
                              type="text"
                              value={setting.classDescription || ""}
                              onChange={(e) => updateScheduleClass(key, e.target.value)}
                              placeholder="e.g., Oly class - snatch + back squat"
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                            />
                            <select
                              value={setting.classAttendance || "always"}
                              onChange={(e) => updateScheduleAttendance(key, e.target.value as "always" | "optional")}
                              title="Attend every week, or let the AI decide when it fits the plan"
                              className="px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white shrink-0"
                            >
                              <option value="always">Every week</option>
                              <option value="optional">AI decides</option>
                            </select>
                          </>
                        )}
                        {(setting.mode === "open" || (setting.mode === "class" && (setting.classAttendance || "always") === "optional")) && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={240}
                              value={setting.maxMinutes || ""}
                              onChange={(e) => updateScheduleMinutes(key, parseInt(e.target.value) || 0)}
                              placeholder="—"
                              title="Max session length in minutes (optional)"
                              className="w-14 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                            />
                            <span className="text-xs text-gray-400">min max</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rest days per week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Rest Days Each Week
                </label>
                <select
                  value={preferences.restDaysPerWeek || 0}
                  onChange={(e) => setPreferences(prev => ({ ...prev, restDaysPerWeek: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={0}>Let the AI decide (1-2 per week)</option>
                  <option value={1}>1 per week</option>
                  <option value={2}>2 per week</option>
                  <option value={3}>3 per week</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Days you marked Rest above count toward this; the AI places any extras on the smartest days</p>
              </div>

              {/* Long Run Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Long Run Day
                </label>
                <select
                  value={preferences.longRunDay || ""}
                  onChange={(e) => setPreferences(prev => ({ ...prev, longRunDay: e.target.value as AIProgrammingPreferences["longRunDay"] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Let the AI decide</option>
                  {WEEKDAYS.map(d => (
                    <option key={d.key} value={d.key}>{d.full}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Used when you&apos;re training for a running race - the weekly long run always lands here</p>
              </div>

              {/* Training Philosophy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Philosophy & Goals
                </label>
                <textarea
                  value={preferences.philosophy}
                  onChange={(e) => setPreferences(prev => ({ ...prev, philosophy: e.target.value }))}
                  placeholder="e.g., I want to build strength while keeping conditioning. Training for a local competition in the fall. Prefer quality over volume..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Training style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "crossfit", label: "CrossFit / Mixed-Modal", desc: "WODs, lifts, skills, engine work" },
                    { value: "general", label: "General Gym Training", desc: "Strength splits, machines, cardio - no WODs" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreferences(prev => ({ ...prev, trainingStyle: opt.value }))}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        (preferences.trainingStyle || "crossfit") === opt.value
                          ? "bg-purple-50 border-purple-400 ring-1 ring-purple-400"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Training environment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Where You Train
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "home", label: "Home / Garage Gym", desc: "Only the equipment you list below" },
                    { value: "commercial", label: "Commercial Gym", desc: "Full equipment assumed" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPreferences(prev => ({ ...prev, trainingEnvironment: opt.value }))}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        (preferences.trainingEnvironment || "home") === opt.value
                          ? "bg-purple-50 border-purple-400 ring-1 ring-purple-400"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {(preferences.trainingEnvironment || "home") === "commercial" ? "Anything Special About Your Gym? (optional)" : "Your Garage Gym Equipment"}
                </label>
                <textarea
                  value={preferences.equipment}
                  onChange={(e) => setPreferences(prev => ({ ...prev, equipment: e.target.value }))}
                  placeholder={(preferences.trainingEnvironment || "home") === "commercial"
                    ? "e.g., No squat rack at my gym, great cable setup, pool available..."
                    : "e.g., Barbell + 300lb plates, squat rack, pull-up bar, one 53lb kettlebell, jump rope, rower. No dumbbells, no rings..."}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {(preferences.trainingEnvironment || "home") === "commercial"
                    ? "Full standard gym equipment is assumed - note anything missing or extra"
                    : "The AI will only program movements you can actually do"}
                </p>
              </div>

              {/* Workout Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Workout Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "short", label: "Short", desc: "<15 min" },
                    { value: "medium", label: "Medium", desc: "15-25 min" },
                    { value: "long", label: "Long", desc: "25+ min" },
                    { value: "varied", label: "Varied", desc: "Mix it up" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(prev => ({ ...prev, workoutDuration: opt.value as AIProgrammingPreferences["workoutDuration"] }))}
                      className={`p-2 rounded-lg text-center transition-colors ${
                        preferences.workoutDuration === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Benchmark Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benchmark WOD Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "often", label: "Often", desc: "1-2/week" },
                    { value: "sometimes", label: "Sometimes", desc: "1-2/month" },
                    { value: "rarely", label: "Rarely", desc: "Custom only" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPreferences(prev => ({ ...prev, benchmarkFrequency: opt.value as AIProgrammingPreferences["benchmarkFrequency"] }))}
                      className={`p-2 rounded-lg text-center transition-colors ${
                        preferences.benchmarkFrequency === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Programming Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Programming Style Inspiration
                </label>
                <input
                  type="text"
                  value={preferences.programmingStyle}
                  onChange={(e) => setPreferences(prev => ({ ...prev, programmingStyle: e.target.value }))}
                  placeholder="e.g., Mayhem, CompTrain, HWPO, CrossFit Main Site, Custom..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">The AI will try to match this programming style</p>
              </div>

              {/* Additional Rules */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Rules or Preferences
                </label>
                <textarea
                  value={preferences.additionalRules}
                  onChange={(e) => setPreferences(prev => ({ ...prev, additionalRules: e.target.value }))}
                  placeholder="e.g., Always include a strength component. No running on Mondays. Include skill work at least 2x per week. Avoid programming heavy deadlifts and back squats on consecutive days..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={savePreferences}
                disabled={savingPreferences}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPreferences ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
