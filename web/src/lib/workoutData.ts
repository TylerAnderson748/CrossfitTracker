// Workout data organized to match iOS app

export interface Workout {
  name: string;
  description: string;
  type: "wod" | "lift";
}

export interface WorkoutCategory {
  name: string;
  icon?: string;
  workouts: Workout[];
}

// =====================
// WOD CATEGORIES
// =====================

export const WOD_CATEGORIES: WorkoutCategory[] = [
  {
    name: "Popular WODs",
    icon: "⭐",
    workouts: [
      { name: "Fran", description: "21-15-9: Thrusters (95/65) & Pull-ups", type: "wod" },
      { name: "Murph", description: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run", type: "wod" },
      { name: "Cindy", description: "AMRAP 20: 5 pull-ups, 10 push-ups, 15 squats", type: "wod" },
      { name: "Grace", description: "30 Clean & Jerks (135/95)", type: "wod" },
      { name: "Helen", description: "3 RFT: 400m run, 21 KB swings, 12 pull-ups", type: "wod" },
      { name: "Diane", description: "21-15-9: Deadlifts (225/155) & HSPU", type: "wod" },
    ],
  },
  {
    name: "Classic Benchmarks",
    workouts: [
      { name: "Annie", description: "50-40-30-20-10: Double-unders & Sit-ups", type: "wod" },
      { name: "Barbara", description: "5 RFT: 20 pull-ups, 30 push-ups, 40 sit-ups, 50 squats", type: "wod" },
      { name: "Chelsea", description: "EMOM 30: 5 pull-ups, 10 push-ups, 15 squats", type: "wod" },
      { name: "Elizabeth", description: "21-15-9: Cleans (135/95) & Ring Dips", type: "wod" },
      { name: "Eva", description: "5 RFT: 800m run, 30 KB swings (70/53), 30 pull-ups", type: "wod" },
      { name: "Isabel", description: "30 Snatches (135/95)", type: "wod" },
      { name: "Jackie", description: "1000m row, 50 thrusters (45), 30 pull-ups", type: "wod" },
      { name: "Karen", description: "150 Wall Balls (20/14)", type: "wod" },
      { name: "Kelly", description: "5 RFT: 400m run, 30 box jumps, 30 wall balls", type: "wod" },
      { name: "Linda", description: "10-9-8-7-6-5-4-3-2-1: Deadlift (1.5 BW), Bench (BW), Clean (0.75 BW)", type: "wod" },
      { name: "Mary", description: "AMRAP 20: 5 HSPU, 10 pistols, 15 pull-ups", type: "wod" },
      { name: "Nancy", description: "5 RFT: 400m run, 15 OHS (95/65)", type: "wod" },
    ],
  },
  {
    name: "Endurance Benchmarks",
    workouts: [
      { name: "2k Row", description: "2000m row for time", type: "wod" },
      { name: "5k Row", description: "5000m row for time", type: "wod" },
      { name: "10k Row", description: "10000m row for time", type: "wod" },
      { name: "1 Mile Run", description: "1 mile run for time", type: "wod" },
      { name: "5k Run", description: "5k run for time", type: "wod" },
      { name: "400m Run", description: "400m sprint for time", type: "wod" },
      { name: "100 Burpees", description: "100 burpees for time", type: "wod" },
      { name: "Filthy Fifty", description: "50 box jumps, 50 jumping pull-ups, 50 KB swings, 50 walking lunges, 50 K2E, 50 push press, 50 back extensions, 50 wall balls, 50 burpees, 50 double-unders", type: "wod" },
    ],
  },
  {
    name: "Hero WODs A-D",
    workouts: [
      { name: "Arnie", description: "With a single KB: 21 Turkish get-ups (R), 50 KB swings, 21 OHS (L), 50 KB swings, 21 OHS (R), 50 KB swings, 21 Turkish get-ups (L)", type: "wod" },
      { name: "Badger", description: "3 RFT: 30 squat cleans (95/65), 30 pull-ups, 800m run", type: "wod" },
      { name: "Blake", description: "4 RFT: 100ft walking lunges, 30 box jumps (24/20), 20 wall balls (20/14), 10 HSPU", type: "wod" },
      { name: "Bradley", description: "10 RFT: 100m sprint, 10 pull-ups, 100m sprint, 10 burpees, rest 30 sec", type: "wod" },
      { name: "Brenton", description: "5 RFT: 100m bear crawl, 20 push-ups, 100m bear crawl, 20 burpees", type: "wod" },
      { name: "Clovis", description: "10 mile run, 150 burpee pull-ups", type: "wod" },
      { name: "DT", description: "5 RFT: 12 deadlifts (155/105), 9 hang power cleans, 6 push jerks", type: "wod" },
      { name: "Daniel", description: "50 pull-ups, 400m run, 21 thrusters (95/65), 800m run, 21 thrusters, 400m run, 50 pull-ups", type: "wod" },
    ],
  },
  {
    name: "Hero WODs E-J",
    workouts: [
      { name: "Erin", description: "5 RFT: 15 dumbbell split cleans, 21 pull-ups", type: "wod" },
      { name: "Forrest", description: "20 L-pull-ups, 30 toes-to-bar, 40 burpees, 800m run, 3 RFT", type: "wod" },
      { name: "Glen", description: "30 clean & jerks (135/95), 1 mile run, 10 rope climbs, 1 mile run, 100 burpees", type: "wod" },
      { name: "Griff", description: "2 RFT: 800m run, 400m backwards run", type: "wod" },
      { name: "Jack", description: "AMRAP 20: 10 push press (115/75), 10 KB swings (53/35), 10 box jumps (24/20)", type: "wod" },
      { name: "Jason", description: "100 squats, 5 muscle-ups, 75 squats, 10 muscle-ups, 50 squats, 15 muscle-ups, 25 squats, 20 muscle-ups", type: "wod" },
      { name: "Jerry", description: "1 mile run, 2k row, 1 mile run", type: "wod" },
      { name: "JT", description: "21-15-9: HSPU, ring dips, push-ups", type: "wod" },
      { name: "Jag 28", description: "28 min AMRAP: 800m run, 28 KB swings (70/53), 28 strict pull-ups, 28 KB cleans, 28 strict pull-ups", type: "wod" },
    ],
  },
  {
    name: "Hero WODs K-M",
    workouts: [
      { name: "Klepto", description: "4 RFT: 27 box jumps (24/20), 20 burpees, 11 squat cleans (145/100)", type: "wod" },
      { name: "Luce", description: "3 RFT wearing 20lb vest: 1k run, 10 muscle-ups, 100 squats", type: "wod" },
      { name: "Manion", description: "7 RFT: 400m run, 29 back squats (135/95)", type: "wod" },
      { name: "McGhee", description: "AMRAP 30: 5 deadlifts (275/185), 13 push-ups, 9 box jumps (24/20)", type: "wod" },
      { name: "Michael", description: "3 RFT: 800m run, 50 back extensions, 50 sit-ups", type: "wod" },
      { name: "Moore", description: "20 min AMRAP: 15 foot rope climb, 400m run, max rep bench press (BW)", type: "wod" },
      { name: "Morrison", description: "50-40-30-20-10: Wall balls (20/14), box jumps (24/20), KB swings (53/35)", type: "wod" },
      { name: "Mr Joshua", description: "5 RFT: 400m run, 30 GHD sit-ups, 15 deadlifts (250/175)", type: "wod" },
    ],
  },
  {
    name: "Hero WODs N-R",
    workouts: [
      { name: "Nate", description: "AMRAP 20: 2 muscle-ups, 4 HSPU, 8 KB swings (70/53)", type: "wod" },
      { name: "Nutts", description: "10 HSPU, 15 deadlifts (250/175), 25 box jumps (30/24), 50 pull-ups, 100 wall balls (20/14), 200 double-unders, 400m run (45/25 plate)", type: "wod" },
      { name: "Paul", description: "5 RFT: 50 double-unders, 35 KB swings (53/35), 20 box jumps (24/20)", type: "wod" },
      { name: "RJ", description: "5 RFT: 800m run, 5 rope climbs, 50 push-ups", type: "wod" },
      { name: "Randy", description: "75 power snatches (75/55)", type: "wod" },
      { name: "Rankel", description: "AMRAP 20: 6 deadlifts (225/155), 7 burpee pull-ups, 10 KB swings (70/53), 200m run", type: "wod" },
      { name: "Roy", description: "5 RFT: 15 deadlifts (225/155), 20 box jumps (24/20), 25 pull-ups", type: "wod" },
      { name: "Ryan", description: "5 RFT: 7 muscle-ups, 21 burpees", type: "wod" },
    ],
  },
  {
    name: "Hero WODs S-Z",
    workouts: [
      { name: "Santora", description: "50 deadlifts (225/155), 50 push-ups, 50 pull-ups, 50 box jumps (30/24), 50 cleans (135/95), 50 HSPU", type: "wod" },
      { name: "Small", description: "3 RFT: 1k row, 50 burpees, 50 box jumps (24/20), 800m run", type: "wod" },
      { name: "Stephen", description: "30-25-20-15-10-5: GHD sit-ups, back extensions. Then 1 mile weighted run (45/25 plate)", type: "wod" },
      { name: "The Seven", description: "7 RFT: 7 HSPU, 7 thrusters (135/95), 7 K2E, 7 deadlifts (245/175), 7 burpees, 7 KB swings (70/53), 7 pull-ups", type: "wod" },
      { name: "Tommy V", description: "21 thrusters (115/75), 12 rope climbs (15ft), 15 thrusters, 9 rope climbs, 9 thrusters, 6 rope climbs", type: "wod" },
      { name: "War Frank", description: "3 RFT: 25 muscle-ups, 100 squats, 35 GHD sit-ups", type: "wod" },
      { name: "White", description: "5 RFT: 3 rope climbs, 10 toes-to-bar, 21 walking lunges, 400m run", type: "wod" },
      { name: "Wittman", description: "7 RFT: 15 KB swings (53/35), 15 power cleans (95/65), 15 box jumps (24/20)", type: "wod" },
    ],
  },
  {
    name: "New Girls",
    workouts: [
      { name: "Amanda", description: "9-7-5: Muscle-ups & Squat snatches (135/95)", type: "wod" },
      { name: "Gwen", description: "15-12-9 unbroken clean & jerks. Add weight each round. 1 min rest between rounds.", type: "wod" },
      { name: "Hope", description: "3 RFT: 30 sec burpees, 30 sec snatches (75/55), 30 sec box jumps (24/20), 30 sec thrusters (75/55), 30 sec C2B pull-ups. 1 min rest between rounds.", type: "wod" },
      { name: "Ingrid", description: "10 RFT: 3 snatches (105/70)", type: "wod" },
      { name: "Marguerita", description: "50 burpee box jumps (24/20), 25 ring dips, 25 bar muscle-ups", type: "wod" },
    ],
  },
  {
    name: "Original Girls",
    workouts: [
      { name: "Angie", description: "100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats", type: "wod" },
      { name: "Annie", description: "50-40-30-20-10: Double-unders & Sit-ups", type: "wod" },
      { name: "Barbara", description: "5 RFT: 20 pull-ups, 30 push-ups, 40 sit-ups, 50 squats. 3 min rest between rounds.", type: "wod" },
      { name: "Chelsea", description: "EMOM 30: 5 pull-ups, 10 push-ups, 15 squats", type: "wod" },
      { name: "Cindy", description: "AMRAP 20: 5 pull-ups, 10 push-ups, 15 squats", type: "wod" },
      { name: "Diane", description: "21-15-9: Deadlifts (225/155) & HSPU", type: "wod" },
      { name: "Elizabeth", description: "21-15-9: Cleans (135/95) & Ring Dips", type: "wod" },
      { name: "Fran", description: "21-15-9: Thrusters (95/65) & Pull-ups", type: "wod" },
      { name: "Grace", description: "30 Clean & Jerks (135/95)", type: "wod" },
      { name: "Helen", description: "3 RFT: 400m run, 21 KB swings (53/35), 12 pull-ups", type: "wod" },
      { name: "Isabel", description: "30 Snatches (135/95)", type: "wod" },
      { name: "Jackie", description: "1000m row, 50 thrusters (45/35), 30 pull-ups", type: "wod" },
      { name: "Karen", description: "150 Wall Balls (20/14)", type: "wod" },
      { name: "Kelly", description: "5 RFT: 400m run, 30 box jumps (24/20), 30 wall balls (20/14)", type: "wod" },
      { name: "Linda", description: "10-9-8-7-6-5-4-3-2-1: Deadlift (1.5 BW), Bench (BW), Clean (0.75 BW)", type: "wod" },
      { name: "Mary", description: "AMRAP 20: 5 HSPU, 10 pistols, 15 pull-ups", type: "wod" },
      { name: "Nancy", description: "5 RFT: 400m run, 15 OHS (95/65)", type: "wod" },
    ],
  },
];

// =====================
// LIFT CATEGORIES
// =====================

export const LIFT_CATEGORIES: WorkoutCategory[] = [
  {
    name: "Popular Lifts",
    icon: "⭐",
    workouts: [
      { name: "Back Squat", description: "Barbell back squat", type: "lift" },
      { name: "Front Squat", description: "Barbell front squat", type: "lift" },
      { name: "Overhead Squat", description: "Barbell overhead squat", type: "lift" },
      { name: "Deadlift", description: "Conventional deadlift", type: "lift" },
      { name: "Clean", description: "Power or squat clean", type: "lift" },
      { name: "Snatch", description: "Power or squat snatch", type: "lift" },
      { name: "Clean & Jerk", description: "Full clean and jerk", type: "lift" },
      { name: "Bench Press", description: "Barbell bench press", type: "lift" },
      { name: "Strict Press", description: "Shoulder press", type: "lift" },
      { name: "Push Press", description: "Push press", type: "lift" },
    ],
  },
  {
    name: "Accessory Strength",
    workouts: [
      { name: "Barbell Row", description: "Bent over barbell row", type: "lift" },
      { name: "Dumbbell Row", description: "Single arm dumbbell row", type: "lift" },
      { name: "Pendlay Row", description: "Strict barbell row from floor", type: "lift" },
      { name: "Pull-up", description: "Strict pull-up", type: "lift" },
      { name: "Weighted Pull-up", description: "Pull-up with added weight", type: "lift" },
      { name: "Weighted Dip", description: "Dip with added weight", type: "lift" },
      { name: "Dumbbell Curl", description: "Bicep curl with dumbbells", type: "lift" },
      { name: "Tricep Extension", description: "Tricep extension", type: "lift" },
      { name: "GHD Hip Extension", description: "Glute-ham developer hip extension", type: "lift" },
      { name: "Good Morning", description: "Barbell good morning", type: "lift" },
    ],
  },
  {
    name: "Deadlift Variations",
    workouts: [
      { name: "Deadlift", description: "Conventional deadlift", type: "lift" },
      { name: "Sumo Deadlift", description: "Wide stance deadlift", type: "lift" },
      { name: "Romanian Deadlift", description: "RDL - stiff leg variation", type: "lift" },
      { name: "Deficit Deadlift", description: "Deadlift from elevated platform", type: "lift" },
      { name: "Rack Pull", description: "Partial deadlift from rack", type: "lift" },
      { name: "Trap Bar Deadlift", description: "Deadlift with trap/hex bar", type: "lift" },
      { name: "Single Leg Deadlift", description: "Unilateral deadlift", type: "lift" },
      { name: "Stiff Leg Deadlift", description: "Straight leg deadlift", type: "lift" },
    ],
  },
  {
    name: "Explosive Strength",
    workouts: [
      { name: "Power Clean", description: "Clean caught above parallel", type: "lift" },
      { name: "Power Snatch", description: "Snatch caught above parallel", type: "lift" },
      { name: "Hang Power Clean", description: "Power clean from hang position", type: "lift" },
      { name: "Hang Power Snatch", description: "Power snatch from hang position", type: "lift" },
      { name: "Clean Pull", description: "Clean deadlift with explosive extension", type: "lift" },
      { name: "Snatch Pull", description: "Snatch deadlift with explosive extension", type: "lift" },
      { name: "Box Jump", description: "Explosive jump onto box", type: "lift" },
      { name: "Broad Jump", description: "Standing long jump", type: "lift" },
    ],
  },
  {
    name: "Jerk Variations",
    workouts: [
      { name: "Push Jerk", description: "Jerk with push dip and drive", type: "lift" },
      { name: "Split Jerk", description: "Jerk with split stance catch", type: "lift" },
      { name: "Power Jerk", description: "Jerk caught with feet together", type: "lift" },
      { name: "Behind Neck Jerk", description: "Jerk from behind neck position", type: "lift" },
      { name: "Jerk Balance", description: "Footwork drill for split jerk", type: "lift" },
      { name: "Jerk Dip", description: "Dip and drive portion of jerk", type: "lift" },
      { name: "Jerk Recovery", description: "Recovery practice from split position", type: "lift" },
    ],
  },
  {
    name: "Lower Body Strength",
    workouts: [
      { name: "Back Squat", description: "Barbell back squat", type: "lift" },
      { name: "Front Squat", description: "Barbell front squat", type: "lift" },
      { name: "Goblet Squat", description: "Squat holding weight at chest", type: "lift" },
      { name: "Bulgarian Split Squat", description: "Rear foot elevated split squat", type: "lift" },
      { name: "Walking Lunge", description: "Forward walking lunges", type: "lift" },
      { name: "Reverse Lunge", description: "Step back lunge", type: "lift" },
      { name: "Step Up", description: "Weighted step up onto box", type: "lift" },
      { name: "Hip Thrust", description: "Barbell hip thrust", type: "lift" },
      { name: "Leg Press", description: "Machine leg press", type: "lift" },
      { name: "Leg Curl", description: "Hamstring curl", type: "lift" },
      { name: "Leg Extension", description: "Quadricep extension", type: "lift" },
      { name: "Calf Raise", description: "Standing or seated calf raise", type: "lift" },
    ],
  },
  {
    name: "Olympic Lifting",
    workouts: [
      { name: "Snatch", description: "Full squat snatch", type: "lift" },
      { name: "Clean", description: "Full squat clean", type: "lift" },
      { name: "Clean & Jerk", description: "Full clean and jerk", type: "lift" },
      { name: "Power Snatch", description: "Snatch caught above parallel", type: "lift" },
      { name: "Power Clean", description: "Clean caught above parallel", type: "lift" },
      { name: "Hang Snatch", description: "Snatch from hang position", type: "lift" },
      { name: "Hang Clean", description: "Clean from hang position", type: "lift" },
      { name: "Snatch Balance", description: "Drop snatch drill", type: "lift" },
      { name: "Overhead Squat", description: "Squat with barbell overhead", type: "lift" },
      { name: "Snatch Grip Deadlift", description: "Deadlift with wide snatch grip", type: "lift" },
      { name: "Clean Grip Deadlift", description: "Deadlift with clean grip", type: "lift" },
    ],
  },
  {
    name: "Pressing & Overhead",
    workouts: [
      { name: "Strict Press", description: "Standing shoulder press", type: "lift" },
      { name: "Push Press", description: "Press with leg drive", type: "lift" },
      { name: "Push Jerk", description: "Jerk with push and dip", type: "lift" },
      { name: "Bench Press", description: "Flat barbell bench press", type: "lift" },
      { name: "Incline Bench Press", description: "Incline barbell bench press", type: "lift" },
      { name: "Dumbbell Press", description: "Standing dumbbell press", type: "lift" },
      { name: "Dumbbell Bench Press", description: "Flat dumbbell bench press", type: "lift" },
      { name: "Close Grip Bench Press", description: "Narrow grip bench press", type: "lift" },
      { name: "Floor Press", description: "Bench press from floor", type: "lift" },
      { name: "Z Press", description: "Seated press with no back support", type: "lift" },
      { name: "Landmine Press", description: "Angled barbell press", type: "lift" },
    ],
  },
  {
    name: "Squat Variations",
    workouts: [
      { name: "Back Squat", description: "High bar or low bar back squat", type: "lift" },
      { name: "Front Squat", description: "Barbell front squat", type: "lift" },
      { name: "Overhead Squat", description: "Squat with barbell overhead", type: "lift" },
      { name: "Goblet Squat", description: "Squat holding KB/DB at chest", type: "lift" },
      { name: "Zercher Squat", description: "Squat with bar in elbow crease", type: "lift" },
      { name: "Box Squat", description: "Squat to box", type: "lift" },
      { name: "Pause Squat", description: "Squat with pause at bottom", type: "lift" },
      { name: "Tempo Squat", description: "Squat with controlled tempo", type: "lift" },
      { name: "Anderson Squat", description: "Squat starting from pins", type: "lift" },
      { name: "Safety Bar Squat", description: "Squat with safety squat bar", type: "lift" },
    ],
  },
];

// Helper function to get all workouts from categories
export const getAllWods = (): Workout[] => {
  const seen = new Set<string>();
  const workouts: Workout[] = [];
  WOD_CATEGORIES.forEach(cat => {
    cat.workouts.forEach(w => {
      if (!seen.has(w.name)) {
        seen.add(w.name);
        workouts.push(w);
      }
    });
  });
  return workouts;
};

export const getAllLifts = (): Workout[] => {
  const seen = new Set<string>();
  const workouts: Workout[] = [];
  LIFT_CATEGORIES.forEach(cat => {
    cat.workouts.forEach(w => {
      if (!seen.has(w.name)) {
        seen.add(w.name);
        workouts.push(w);
      }
    });
  });
  return workouts;
};
