// The standard baseline battery Oddo uses to calibrate programming and
// coaching. Every AI athlete goes through this: log the bare minimum, or your
// first programmed workouts ARE the missing tests.

export type BaselineCategory = "lift" | "wod" | "cardio" | "skill";

export interface BaselineItem {
  key: string;
  name: string;
  category: BaselineCategory;
  // Complete prescription, usable directly as a workout component description
  description: string;
}

export const BASELINE_LIFTS: BaselineItem[] = [
  { key: "back_squat", name: "Back Squat", category: "lift", description: "Build to a controlled 5-rep max. Warm up in sets of 5, adding weight each set; stop at the heaviest 5 you can hit with solid depth and a braced trunk. No barbell at home? Heaviest 5-rep goblet or double-DB front squat instead. Log the weight x 5." },
  { key: "deadlift", name: "Deadlift", category: "lift", description: "Build to a controlled 5-rep max with a flat back and no grinding reps. No barbell? Heaviest 5-rep double-DB or sandbag deadlift. Log the weight x 5." },
  { key: "bench_press", name: "Bench Press", category: "lift", description: "Build to a controlled 5-rep max with a spotter or safeties. No bench/barbell? Heaviest 5-rep double-DB floor press. Log the weight x 5." },
  { key: "strict_press", name: "Strict Press", category: "lift", description: "Build to a strict 5-rep max overhead - no leg drive. DB version at home. Log the weight x 5." },
  { key: "front_squat", name: "Front Squat", category: "lift", description: "Build to a controlled 5-rep max in the front rack. DB or goblet version at home. Log the weight x 5." },
];

export const BASELINE_WODS: BaselineItem[] = [
  { key: "cindy", name: "Cindy", category: "wod", description: "20-min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats. Scale pull-ups to ring rows or banded. Score = rounds + reps." },
  { key: "helen", name: "Helen", category: "wod", description: "3 rounds for time: 400m run, 21 KB swings (53/35 lb), 12 pull-ups. Scale as needed; log total time." },
  { key: "fran", name: "Fran", category: "wod", description: "21-15-9 for time: thrusters (95/65 lb barbell, or 35-50 lb DBs), pull-ups. Log total time and the load used." },
  { key: "karen", name: "Karen", category: "wod", description: "150 wall-ball shots for time (20/14 lb ball to 10/9 ft). Log total time." },
  { key: "grace", name: "Grace", category: "wod", description: "30 clean & jerks for time (135/95 lb barbell, or DB version). Log total time and load." },
];

export const BASELINE_CARDIO: BaselineItem[] = [
  { key: "mile_run", name: "1-Mile Run", category: "cardio", description: "1 mile for time on a flat course after a 5-min easy warm-up jog. Even pacing; log time." },
  { key: "run_5k", name: "5K Run", category: "cardio", description: "5K (3.1 mi) for time at a hard but sustainable effort. Log time." },
  { key: "run_10k", name: "10K Run", category: "cardio", description: "10K (6.2 mi) steady effort - a fitness check, not a race. Log time." },
  { key: "bike", name: "Bike Session", category: "cardio", description: "20+ minute bike ride (road, MTB, or stationary) at steady effort. Log miles and time." },
  { key: "swim", name: "Swim Session", category: "cardio", description: "Continuous swim session - as far as comfortable in 10-20 min. Log distance and time." },
];

export const BASELINE_SKILLS: BaselineItem[] = [
  { key: "max_pullups", name: "Max Strict Pull-ups", category: "skill", description: "One max set of strict pull-ups, dead hang to chin over bar. No kipping. Log the number (use banded if needed and note the band)." },
  { key: "max_pushups", name: "Max Push-ups", category: "skill", description: "One max unbroken set of push-ups with full range and rigid plank. Log the number." },
  { key: "max_double_unders", name: "Max Double-Unders", category: "skill", description: "Max unbroken double-unders (singles count if learning - note which). Log the number." },
  { key: "plank_hold", name: "Plank Hold", category: "skill", description: "Max-duration strict plank on elbows. Log the time." },
  { key: "handstand_hold", name: "Handstand Hold", category: "skill", description: "Max wall-supported handstand hold (or plank-to-pike hold if not there yet - note which). Log the time." },
];

export const BASELINE_BATTERY: BaselineItem[] = [
  ...BASELINE_LIFTS,
  ...BASELINE_WODS,
  ...BASELINE_CARDIO,
  ...BASELINE_SKILLS,
];

export interface BaselineStatusInput {
  trainingStyle?: string; // "crossfit" | "general"
  liftTitles: string[];   // logged lift titles
  wodTitles: string[];    // logged workout titles
  skillNames: string[];   // logged skill names
  cardioLogs: { activity: string; miles?: number }[];
}

export interface BaselineCategoryStatus {
  done: BaselineItem[];
  missing: BaselineItem[];
}

export interface BaselineStatus {
  lifts: BaselineCategoryStatus;
  wods: BaselineCategoryStatus;
  cardio: BaselineCategoryStatus;
  skills: BaselineCategoryStatus;
  meetsMinimum: boolean;
  minimumDescription: string;
}

function matchByName(items: BaselineItem[], loggedNames: string[]): BaselineCategoryStatus {
  const norm = loggedNames.map(n => n.toLowerCase().trim());
  const done: BaselineItem[] = [];
  const missing: BaselineItem[] = [];
  items.forEach(item => {
    const target = item.name.toLowerCase();
    if (norm.some(n => n.includes(target) || target.includes(n) && n.length > 3)) done.push(item);
    else missing.push(item);
  });
  return { done, missing };
}

function matchCardio(logs: { activity: string; miles?: number }[]): BaselineCategoryStatus {
  const done: BaselineItem[] = [];
  const missing: BaselineItem[] = [];
  const has = (pred: (l: { activity: string; miles?: number }) => boolean) => logs.some(pred);
  BASELINE_CARDIO.forEach(item => {
    let logged = false;
    if (item.key === "mile_run") logged = has(l => l.activity === "run" && (l.miles || 0) >= 0.85 && (l.miles || 0) <= 1.3);
    else if (item.key === "run_5k") logged = has(l => l.activity === "run" && (l.miles || 0) >= 2.9 && (l.miles || 0) <= 3.5);
    else if (item.key === "run_10k") logged = has(l => l.activity === "run" && (l.miles || 0) >= 5.9 && (l.miles || 0) <= 6.7);
    else if (item.key === "bike") logged = has(l => l.activity === "bike_mtb" || l.activity === "bike_road");
    else if (item.key === "swim") logged = has(l => l.activity === "swim");
    (logged ? done : missing).push(item);
  });
  return { done, missing };
}

// Bare minimum before full programming can be calibrated:
//   CrossFit: 2 lifts + 1 cardio + 1 benchmark WOD + 1 skill
//   General gym: 2 lifts + 1 cardio
export function computeBaselineStatus(input: BaselineStatusInput): BaselineStatus {
  const lifts = matchByName(BASELINE_LIFTS, input.liftTitles);
  const wods = matchByName(BASELINE_WODS, input.wodTitles);
  const skills = matchByName(BASELINE_SKILLS, input.skillNames);
  const cardio = matchCardio(input.cardioLogs);

  const general = input.trainingStyle === "general";
  const meetsMinimum = general
    ? lifts.done.length >= 2 && cardio.done.length >= 1
    : lifts.done.length >= 2 && cardio.done.length >= 1 && wods.done.length >= 1 && skills.done.length >= 1;
  const minimumDescription = general
    ? "2 baseline lifts + 1 baseline cardio test"
    : "2 baseline lifts + 1 baseline cardio test + 1 benchmark WOD + 1 skill test";

  return { lifts, wods, cardio, skills, meetsMinimum, minimumDescription };
}

// A deterministic baseline week (no AI involved) that fills the athlete's
// missing minimum tests - used for base-tier subscribers whose programming
// ends after baselining
export interface BaselineDayPlan {
  dayOffset: number; // days from the chosen start date
  components: { type: string; title: string; description: string; scoringType?: string }[];
}

const WARMUP = {
  type: "warmup",
  title: "Warm-up",
  description: "5 min easy movement (jog, bike, or jump rope); 10 air squats, 10 push-ups, arm circles; build gradually into the first test.",
};

export function buildBaselineWeek(status: BaselineStatus, trainingStyle?: string): BaselineDayPlan[] {
  const general = trainingStyle === "general";
  const days: BaselineDayPlan[] = [];

  // Day 1: lift tests (up to 2 missing toward the 2-lift minimum)
  const liftsNeeded = Math.max(0, 2 - status.lifts.done.length);
  const liftTests = status.lifts.missing.slice(0, Math.max(liftsNeeded, 0) || 0);
  if (liftTests.length > 0) {
    days.push({
      dayOffset: 0,
      components: [
        WARMUP,
        ...liftTests.map(t => ({ type: "lift", title: `Baseline: ${t.name}`, description: t.description })),
      ],
    });
  }

  // Day 3: cardio test (1-mile run) + a skill max test (CrossFit style)
  const day3: BaselineDayPlan = { dayOffset: 2, components: [WARMUP] };
  if (status.cardio.done.length === 0) {
    const mile = BASELINE_CARDIO.find(c => c.key === "mile_run")!;
    day3.components.push({ type: "run", title: `Baseline: ${mile.name}`, description: mile.description });
  }
  if (!general && status.skills.done.length === 0 && status.skills.missing.length > 0) {
    const skill = status.skills.missing.find(s => s.key === "max_pushups") || status.skills.missing[0];
    day3.components.push({ type: "skill", title: `Baseline: ${skill.name}`, description: skill.description });
  }
  if (day3.components.length > 1) days.push(day3);

  // Day 5: benchmark WOD (CrossFit style)
  if (!general && status.wods.done.length === 0 && status.wods.missing.length > 0) {
    const wod = status.wods.missing.find(w => w.key === "cindy") || status.wods.missing[0];
    days.push({
      dayOffset: 4,
      components: [
        WARMUP,
        { type: "wod", title: `Baseline: ${wod.name}`, description: wod.description, scoringType: wod.key === "cindy" ? "amrap" : "fortime" },
      ],
    });
  }

  return days;
}

// Prompt block describing the standard battery and this athlete's status
export function buildBaselinePromptBlock(status: BaselineStatus, trainingStyle?: string): string {
  const general = trainingStyle === "general";
  const fmt = (s: BaselineCategoryStatus) =>
    `logged: ${s.done.length > 0 ? s.done.map(i => i.name).join(", ") : "none"}; missing: ${s.missing.map(i => i.name).join(", ") || "none"}`;

  const battery = `STANDARD BASELINE BATTERY (the ONLY tests to use for baselining - never invent different ones):
- Lifts (5-rep max builds): ${BASELINE_LIFTS.map(i => i.name).join(", ")} [${fmt(status.lifts)}]
- Cardio: ${BASELINE_CARDIO.map(i => i.name).join(", ")} [${fmt(status.cardio)}]${general ? "" : `
- Benchmark WODs: ${BASELINE_WODS.map(i => i.name).join(", ")} [${fmt(status.wods)}]
- Skills (max tests): ${BASELINE_SKILLS.map(i => i.name).join(", ")} [${fmt(status.skills)}]`}`;

  if (status.meetsMinimum) {
    return `\n${battery}\nBASELINE MINIMUM MET. Use the logged baselines above (with the athlete's PRs and results) to calibrate every load, pace, and volume decision. Re-test a baseline roughly every 6-8 weeks or before a new phase.\n`;
  }

  return `\n${battery}
BASELINE MINIMUM NOT MET (requires ${status.minimumDescription}). This athlete cannot be programmed real loads/paces yet:
1. The FIRST 1-2 WEEKS of any new plan MUST be a BASELINE BLOCK: schedule the MISSING battery tests above (max 2-3 tests per week, spread across days, never two max-effort tests in one session). Title each component EXACTLY "Baseline: <test name>" (e.g., "Baseline: Back Squat") and use the standard prescription for that test.
2. Prioritize the tests that satisfy the minimum, matched to the athlete's goals and equipment (skip swims/bikes they can't do; use DB versions at home).
3. Everything else in the baseline block stays easy (RPE 5-6) - prescribe by RPE, NEVER percentages of unknown maxes.
4. Once the athlete logs the tests, use those results as the reference numbers for all future programming.\n`;
}
