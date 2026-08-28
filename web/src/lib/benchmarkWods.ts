// Canonical benchmark WODs - the shared reference points that keep the
// leaderboard meaningful even though every athlete's plan is unique. A
// benchmark programmed by its EXACT canonical name flows through
// normalizeWorkoutName into the same leaderboard rows for every user, and
// repeating one months later is a progress re-test, not lazy programming.

import { getAllWods } from "./workoutData";
import { normalizeWorkoutName } from "./types";

export interface BenchmarkWod {
  name: string;
  // Canonical Rx prescription with scaling guidance - complete enough to
  // train from, and the "for time"/"AMRAP" wording drives scoringType
  description: string;
  scoringType: "fortime" | "amrap";
  // Every regex must appear in a WOD claiming this name - protects the
  // shared leaderboard from a "Fran" that isn't Fran
  signature: RegExp[];
  // Plain-text equipment requirement so the prompt can filter to what the
  // athlete actually owns
  needs: string;
}

export const BENCHMARK_WODS: BenchmarkWod[] = [
  {
    name: "Fran",
    description: "21-15-9 reps for time: thrusters (95/65 lb barbell, or 35-50 lb DBs) and pull-ups. Scale to banded pull-ups or ring rows. Log total time and load.",
    scoringType: "fortime",
    signature: [/thruster/i, /pull.?up|ring row/i],
    needs: "barbell or dumbbells + pull-up bar",
  },
  {
    name: "Cindy",
    description: "20-min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats. Scale pull-ups to banded or ring rows, push-ups to knees. Score = rounds + reps.",
    scoringType: "amrap",
    signature: [/pull.?up|ring row/i, /push.?up/i, /squat/i],
    needs: "pull-up bar",
  },
  {
    name: "Helen",
    description: "3 rounds for time: 400m run, 21 kettlebell swings (53/35 lb), 12 pull-ups. Scale KB weight and pull-ups as needed. Log total time.",
    scoringType: "fortime",
    signature: [/run/i, /swing/i, /pull.?up|ring row/i],
    needs: "kettlebell + pull-up bar + running space",
  },
  {
    name: "Grace",
    description: "30 clean & jerks for time (135/95 lb barbell; scale load or use DBs). Move crisply - drop to singles before form breaks. Log total time and load.",
    scoringType: "fortime",
    signature: [/clean/i, /jerk/i],
    needs: "barbell (or dumbbells)",
  },
  {
    name: "Isabel",
    description: "30 snatches for time (135/95 lb barbell - power snatches fine; scale load aggressively, this is a sprint). Log total time and load.",
    scoringType: "fortime",
    signature: [/snatch/i],
    needs: "barbell",
  },
  {
    name: "Diane",
    description: "21-15-9 reps for time: deadlifts (225/155 lb) and handstand push-ups. Scale to pike push-ups or DB presses; deadlift load to ~60% 1RM. Log total time.",
    scoringType: "fortime",
    signature: [/deadlift/i, /handstand|hspu|pike/i],
    needs: "barbell + wall space",
  },
  {
    name: "Karen",
    description: "150 wall-ball shots for time (20/14 lb ball to a 10/9 ft target). Break early and often; steady sets beat hero sets. Log total time.",
    scoringType: "fortime",
    signature: [/wall.?ball/i],
    needs: "wall ball + target",
  },
  {
    name: "Annie",
    description: "50-40-30-20-10 reps for time: double-unders and sit-ups. Learning DUs? Do 2x singles per rep and note it. Log total time.",
    scoringType: "fortime",
    signature: [/double.?under|single/i, /sit.?up/i],
    needs: "jump rope",
  },
  {
    name: "Angie",
    description: "For time: 100 pull-ups, 100 push-ups, 100 sit-ups, 100 air squats - finish all reps of one movement before the next. Scale volume to 50s if newer. Log total time.",
    scoringType: "fortime",
    signature: [/pull.?up|ring row/i, /push.?up/i, /sit.?up/i, /squat/i],
    needs: "pull-up bar",
  },
  {
    name: "Jackie",
    description: "For time: 1000m row, 50 thrusters (45/35 lb empty bar), 30 pull-ups. Scale pull-ups as needed. Log total time.",
    scoringType: "fortime",
    signature: [/row/i, /thruster/i, /pull.?up|ring row/i],
    needs: "rower + barbell + pull-up bar",
  },
  {
    name: "DT",
    description: "5 rounds for time: 12 deadlifts, 9 hang power cleans, 6 push jerks (155/105 lb - one bar, scale so the jerks are unbroken early). Log total time and load.",
    scoringType: "fortime",
    signature: [/deadlift/i, /clean/i, /jerk/i],
    needs: "barbell",
  },
  {
    name: "Nancy",
    description: "5 rounds for time: 400m run, 15 overhead squats (95/65 lb; scale load to keep positions crisp). Log total time.",
    scoringType: "fortime",
    signature: [/run/i, /overhead squat/i],
    needs: "barbell + running space",
  },
  {
    name: "Mary",
    description: "20-min AMRAP: 5 handstand push-ups, 10 alternating pistols, 15 pull-ups. Scale to pike push-ups / box pistols / banded pull-ups. Score = rounds + reps.",
    scoringType: "amrap",
    signature: [/handstand|hspu|pike/i, /pistol/i, /pull.?up|ring row/i],
    needs: "pull-up bar + wall space",
  },
  {
    name: "Murph",
    description: "For time: 1-mile run, 100 pull-ups, 200 push-ups, 300 air squats, 1-mile run (partition the middle as needed; 20 lb vest optional and noted). Half Murph is the standard scale. Log total time.",
    scoringType: "fortime",
    signature: [/run/i, /pull.?up|ring row/i, /push.?up/i, /squat/i],
    needs: "pull-up bar + running space",
  },
];

const BY_NAME: Map<string, BenchmarkWod> = new Map(
  BENCHMARK_WODS.map(b => [b.name.toLowerCase(), b])
);

// Match a component title to a canonical benchmark - tolerant of prefixes
// and suffixes the generator adds ("Baseline: Fran", "Fran (Re-test)")
export function benchmarkByTitle(title: string | undefined): BenchmarkWod | undefined {
  if (!title) return undefined;
  const t = title
    .toLowerCase()
    .replace(/^(baseline|benchmark|re-?test)\s*:\s*/, "")
    .replace(/\s*\((re-?test|rx|scaled|benchmark)\)\s*$/, "")
    .trim();
  return BY_NAME.get(t);
}

// Prompt block listing the canonical benchmarks with their equipment needs
export function benchmarkListForPrompt(): string {
  return BENCHMARK_WODS
    .map(b => `  - ${b.name} (needs: ${b.needs}): ${b.description}`)
    .join("\n");
}

// Cross-user leaderboards only make sense for workouts that never change:
// the classic benchmarks above plus the app's preset WOD library. A custom
// one-off workout is personal history, not a competition.
let leaderboardNames: Set<string> | null = null;

export function isLeaderboardWod(name: string | undefined): boolean {
  if (!name || !name.trim()) return false;
  if (!leaderboardNames) {
    leaderboardNames = new Set([
      ...BENCHMARK_WODS.map(b => normalizeWorkoutName(b.name)),
      ...getAllWods().map(w => normalizeWorkoutName(w.name)),
    ]);
  }
  return leaderboardNames.has(normalizeWorkoutName(name.trim()));
}
