//
//  SampleData.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct SampleData {
    static let wods: [WOD] = [
        // MARK: - GIRLS WORKOUTS

        // Original Girls
        WOD(title: "Angie", description: "100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats", type: .wod, category: "Original Girls"),
        WOD(title: "Annie", description: "50-40-30-20-10 double-unders and sit-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Amanda", description: "9-7-5 muscle-ups and squat snatches (135/95)", type: .wod, category: "Original Girls"),
        WOD(title: "Barbara", description: "5 rounds: 20 pull-ups, 30 push-ups, 40 sit-ups, 50 squats", type: .wod, category: "Original Girls"),
        WOD(title: "Chelsea", description: "EMOM 30: 5 pull-ups, 10 push-ups, 15 squats", type: .wod, category: "Original Girls"),
        WOD(title: "Cindy", description: "AMRAP 20 min: 5 pull-ups, 10 push-ups, 15 squats", type: .wod, category: "Original Girls"),
        WOD(title: "Diane", description: "21-15-9 deadlifts (225/155) and handstand push-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Elizabeth", description: "21-15-9 cleans (135/95) and ring dips", type: .wod, category: "Original Girls"),
        WOD(title: "Eva", description: "5 rounds: 800m run, 30 KB swings (53/35), 30 pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Fran", description: "21-15-9 thrusters (95/65) and pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Grace", description: "30 clean and jerks (135/95) for time", type: .wod, category: "Original Girls"),
        WOD(title: "Helen", description: "3 rounds: 400m run, 21 KB swings (53/35), 12 pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Isabel", description: "30 snatches (135/95) for time", type: .wod, category: "Original Girls"),
        WOD(title: "Jackie", description: "1000m row, 50 thrusters (45/35), 30 pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Karen", description: "150 wall balls (20/14) for time", type: .wod, category: "Original Girls"),
        WOD(title: "Kelly", description: "5 rounds: 400m run, 30 box jumps (24/20), 30 wall balls (20/14)", type: .wod, category: "Original Girls"),
        WOD(title: "Linda", description: "10-9-8-7-6-5-4-3-2-1 deadlift (1.5x BW), bench press (BW), clean (.75x BW)", type: .wod, category: "Original Girls"),
        WOD(title: "Lynne", description: "5 rounds: max rep bench press (BW), max rep pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Mary", description: "AMRAP 20 min: 5 handstand push-ups, 10 pistols, 15 pull-ups", type: .wod, category: "Original Girls"),
        WOD(title: "Nancy", description: "5 rounds: 400m run, 15 OHS (95/65)", type: .wod, category: "Original Girls"),
        WOD(title: "Nicole", description: "AMRAP 20 min: 400m run, max rep pull-ups", type: .wod, category: "Original Girls"),

        // New Girls
        WOD(title: "Gwen", description: "15-12-9 touch-and-go clean and jerks, increasing weight each round", type: .wod, category: "New Girls"),
        WOD(title: "Marguerita", description: "20 min AMRAP: 10 thrusters (95/65), 10 chest-to-bar pull-ups, 10 sumo deadlift high pulls", type: .wod, category: "New Girls"),
        WOD(title: "Lila", description: "15 rounds: 15 wall balls (20/14), 15 burpees", type: .wod, category: "New Girls"),
        WOD(title: "Candice", description: "21-15-9-15-21: deadlifts (225/155), box jumps (24/20)", type: .wod, category: "New Girls"),
        WOD(title: "Caroline", description: "5 rounds: 200m run, 10 thrusters (95/65), 10 pull-ups", type: .wod, category: "New Girls"),
        WOD(title: "Maggie", description: "5 rounds: 20 handstand push-ups, 40 pull-ups, 60 KB swings (53/35)", type: .wod, category: "New Girls"),
        WOD(title: "Molly", description: "5 rounds: 15 burpees, 200m run", type: .wod, category: "New Girls"),
        WOD(title: "Joyce", description: "5 rounds: 15 wall climbs, 30 dumbbell snatches (50/35)", type: .wod, category: "New Girls"),
        WOD(title: "Hope", description: "3 rounds: 1 min burpees, 1 min power snatches (75/55), 1 min box jumps, 1 min thrusters (75/55), 1 min chest-to-bar pull-ups", type: .wod, category: "New Girls"),
        WOD(title: "Joshie", description: "21-15-9: OHS (115/75), ring dips", type: .wod, category: "New Girls"),
        WOD(title: "Randy", description: "75 power snatches (75/55) for time", type: .wod, category: "New Girls"),
        WOD(title: "Frelen", description: "5 rounds: 10 handstand push-ups, 10 pistols per leg, 10 ring rows", type: .wod, category: "New Girls"),

        // MARK: - HERO WORKOUTS

        // Hero WODs A-D
        WOD(title: "Aaron", description: "5 rounds: 30 GHD sit-ups, 30 hip extensions", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Adam Brown", description: "2 rounds: 295 sit-ups, then 29 squats, 29 push-ups, 29 pull-ups, 29 box jumps, 29 KB swings, 29 lunges, 29 burpees", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Adrian", description: "7 rounds: 10 ring rows, 200m run", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Badger", description: "3 rounds: 30 squat cleans (95/65), 30 pull-ups, 800m run", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Blake", description: "4 rounds: 100ft walking lunge, 30 box jumps (24/20), 20 wall balls (20/14)", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Bradshaw", description: "10 rounds: 3 muscle-ups, 3 squat cleans (245/165)", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Bull", description: "2 rounds: 200 double-unders, 50 OHS (135/95), 50 pull-ups, 1 mile run", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Chad", description: "1000 step-ups (24/20) wearing 45/25 lb vest", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Daniel", description: "50 pull-ups, 400m run, 21 thrusters (95/65), 800m run, 21 thrusters, 400m run, 50 pull-ups", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "Danny", description: "20 min AMRAP: 30 box jumps (24/20), 20 push-ups, 10 pull-ups", type: .wod, category: "Hero WODs A-D"),
        WOD(title: "DT", description: "5 rounds: 12 deadlifts (155/105), 9 hang power cleans, 6 push jerks", type: .wod, category: "Hero WODs A-D"),

        // Hero WODs E-J
        WOD(title: "Erin", description: "5 rounds: 15 dumbbell split cleans (40/25), 21 pull-ups", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Forrest", description: "3 rounds: 20 L pull-ups, 30 toes-to-bar, 40 burpees, 800m run", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Gallant", description: "6 rounds: 5 muscle-ups, 10 pistols (alternating), 15 toes-to-bar", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Griff", description: "For time: 800m run, 100 pull-ups, 200 push-ups, 300 squats, 800m run", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Havana", description: "3 rounds: 200m run, 8 burpees, 8 thrusters (135/95)", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Holleyman", description: "30 rounds AFAP: 5 wall balls (20/14), 3 handstand push-ups, 1 power clean (225/155)", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Jack", description: "AMRAP 20: 10 push presses (115/75), 10 KB swings (53/35), 10 box jumps (24/20)", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Jason", description: "100-75-50-25: squats, sit-ups, back extensions, burpees", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "JT", description: "21-15-9: handstand push-ups, ring dips, push-ups", type: .wod, category: "Hero WODs E-J"),
        WOD(title: "Joshie", description: "21-15-9: OHS (115/75), ring dips", type: .wod, category: "Hero WODs E-J"),

        // Hero WODs K-M
        WOD(title: "Kalsu", description: "100 thrusters (135/95), EMOM 5 burpees", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "Klepto", description: "27-21-15-9: burpees, power cleans (135/95)", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "Lumberjack 20", description: "20 deadlifts (275/185), 400m run (repeat for 5 rounds)", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "Luke", description: "400m run, 30 squats, 30 push-ups (repeat for 6 rounds)", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "McGhee", description: "5 rounds: 10 burpee pull-ups, 10 thrusters (115/75), 10 KB swings (70/53)", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "Michael", description: "3 rounds: 800m run, 50 back extensions, 50 sit-ups", type: .wod, category: "Hero WODs K-M"),
        WOD(title: "Murph", description: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run (with 20lb vest)", type: .wod, category: "Hero WODs K-M"),

        // Hero WODs N-R
        WOD(title: "Nate", description: "AMRAP 20: 2 muscle-ups, 4 handstand push-ups, 8 KB swings (70/53)", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Nick", description: "10 rounds: 15 squats, 10 pull-ups, 10 push-ups", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Nutts", description: "10 handstand push-ups, 15 deadlifts (250/175), 25 box jumps, 50 pull-ups, 100 wall balls (20/14) - repeat", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Paul", description: "5 rounds: 50 double-unders, 35 sit-ups, 20 burpees", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Ricky", description: "10 rounds: 4 thrusters (135/95), 8 ring dips, 400m run", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Robbie", description: "5 rounds: 20 pull-ups, 30 push-ups, 40 sit-ups, 50 squats", type: .wod, category: "Hero WODs N-R"),
        WOD(title: "Roy", description: "5 rounds: 15 deadlifts (225/155), 20 box jumps (24/20), 25 pull-ups", type: .wod, category: "Hero WODs N-R"),

        // Hero WODs S-Z
        WOD(title: "Santana", description: "3 rounds: 12 thrusters (95/65), 12 burpees, 400m run", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Sean", description: "11 burpees, 11 thrusters (95/65), 200m run (repeat for time)", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Severin", description: "50 strict pull-ups, 100 push-ups, then 5 rounds: 10 OHS (115/75), 15 burpees", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Stephen", description: "5 rounds: 30-25-20-15-10: GHD sit-ups, back extensions, KB swings (70/53)", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Thompson", description: "3 rounds: 800m run, 30 thrusters (95/65), 30 pull-ups", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Tommy V", description: "21-15-9: thrusters (115/80), rope climbs", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Wittman", description: "7 rounds: 15 KB swings (70/53), 15 power cleans (95/65), 15 box jumps (24/20)", type: .wod, category: "Hero WODs S-Z"),
        WOD(title: "Zembiec", description: "5 rounds: 11 back squats (185/125), 7 strict burpees, 400m run", type: .wod, category: "Hero WODs S-Z"),

        // MARK: - CLASSIC BENCHMARKS

        WOD(title: "Fight Gone Bad", description: "3 rounds: 1 min each - wall balls, sumo deadlift high pulls, box jumps, push press, row", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Filthy 50", description: "50 reps each: box jumps, jumping pull-ups, KB swings, lunges, knees-to-elbows, push press, back extensions, wall balls, burpees, double-unders", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Dirty 30", description: "30 reps each: box jumps, jumping pull-ups, KB swings, lunges, knees-to-elbows, push press, back extensions, wall balls, burpees, double-unders", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "The Seven", description: "7 rounds: 7 handstand push-ups, 7 thrusters (135/95), 7 knees-to-elbows, 7 deadlifts (245/165), 7 burpees, 7 KB swings (70/53), 7 pull-ups", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "The Chief", description: "Max rounds in 3 min of: 3 power cleans (135/95), 6 push-ups, 9 squats. Rest 1 min. Repeat 5 times", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "The Ghost", description: "6 rounds: 1 min row (calories), 1 min burpees, 1 min double-unders, 1 min rest", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Bear Complex", description: "7 sets of: power clean, front squat, push press, back squat, push press", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "King Kong", description: "3 rounds: 1 deadlift (455/315), 2 muscle-ups, 3 squat cleans (250/165), 4 handstand push-ups", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Hotshots 19", description: "6 rounds: 30 squats, 19 power cleans (125/85), 7 strict pull-ups, 400m run", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "9/11 Tribute", description: "2001m row, then 11 rounds: 9 thrusters (125/85), 11 pull-ups", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Tabata Something Else", description: "Tabata: pull-ups, push-ups, sit-ups, squats (complete all rounds of each before moving to next)", type: .wod, category: "Classic Benchmarks"),
        WOD(title: "Baseline", description: "500m row, 40 squats, 30 sit-ups, 20 push-ups, 10 pull-ups", type: .wod, category: "Classic Benchmarks"),

        // MARK: - LIFTS

        // Squat Variations
        WOD(title: "Back Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Front Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Low-Bar Back Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "High-Bar Back Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Box Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Pause Back Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Overhead Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Zercher Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Tempo Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Pause Front Squat", description: "", type: .lift, category: "Squat Variations"),
        WOD(title: "Bulgarian Split Squat", description: "", type: .lift, category: "Squat Variations"),

        // Deadlift Variations
        WOD(title: "Deadlift", description: "", type: .lift, category: "Deadlift Variations"),
        WOD(title: "Sumo Deadlift", description: "", type: .lift, category: "Deadlift Variations"),
        WOD(title: "Romanian Deadlift (RDL)", description: "", type: .lift, category: "Deadlift Variations"),
        WOD(title: "Deficit Deadlift", description: "", type: .lift, category: "Deadlift Variations"),
        WOD(title: "Block Pull Deadlift", description: "", type: .lift, category: "Deadlift Variations"),
        WOD(title: "Single-Leg RDL", description: "", type: .lift, category: "Deadlift Variations"),

        // Bench Press Variations
        WOD(title: "Bench Press", description: "", type: .lift, category: "Bench Press Variations"),
        WOD(title: "Close-Grip Bench Press", description: "", type: .lift, category: "Bench Press Variations"),
        WOD(title: "Floor Press", description: "", type: .lift, category: "Bench Press Variations"),

        // Olympic Lifting - Clean
        WOD(title: "Clean", description: "", type: .lift, category: "Olympic Lifting - Clean"),
        WOD(title: "Power Clean", description: "", type: .lift, category: "Olympic Lifting - Clean"),
        WOD(title: "Hang Clean", description: "", type: .lift, category: "Olympic Lifting - Clean"),
        WOD(title: "Clean Pull", description: "", type: .lift, category: "Olympic Lifting - Clean"),

        // Olympic Lifting - Snatch
        WOD(title: "Snatch", description: "", type: .lift, category: "Olympic Lifting - Snatch"),
        WOD(title: "Power Snatch", description: "", type: .lift, category: "Olympic Lifting - Snatch"),
        WOD(title: "Hang Snatch", description: "", type: .lift, category: "Olympic Lifting - Snatch"),
        WOD(title: "Snatch Pull", description: "", type: .lift, category: "Olympic Lifting - Snatch"),

        // Pressing & Overhead Strength
        WOD(title: "Strict Press", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Push Press", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Push Jerk", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Split Jerk", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Behind-the-Neck Press", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Strict Dumbbell Press", description: "", type: .lift, category: "Pressing & Overhead"),
        WOD(title: "Seated Press", description: "", type: .lift, category: "Pressing & Overhead"),

        // Lower Body Strength
        WOD(title: "Weighted Step-Up", description: "", type: .lift, category: "Lower Body Strength"),
        WOD(title: "Hip Thrust", description: "", type: .lift, category: "Lower Body Strength"),
        WOD(title: "Barbell Hip Bridge", description: "", type: .lift, category: "Lower Body Strength"),

        // Explosive Strength / Pulling Power
        WOD(title: "Deadlift High Pull", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Deadlift to High Pull", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Kettlebell Swing", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Box Jump", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Weighted Box Step-Overs", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Sled Drag", description: "", type: .lift, category: "Explosive Strength"),
        WOD(title: "Sled Push", description: "", type: .lift, category: "Explosive Strength"),

        // Accessory Strength
        WOD(title: "Bent Over Row", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "Pendlay Row", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "Strict Pull-Up", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "Barbell Shrug", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "Good Morning", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "GHD Hip Extension", description: "", type: .lift, category: "Accessory Strength"),
        WOD(title: "GHD Back Extension", description: "", type: .lift, category: "Accessory Strength"),

        // MARK: - STRENGTH BENCHMARKS

        WOD(title: "CrossFit Total", description: "1RM Back Squat + 1RM Shoulder Press + 1RM Deadlift", type: .wod, category: "Strength Benchmarks"),
        WOD(title: "1RM Back Squat", description: "Find your 1 rep max back squat", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Front Squat", description: "Find your 1 rep max front squat", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Deadlift", description: "Find your 1 rep max deadlift", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Snatch", description: "Find your 1 rep max snatch", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Clean", description: "Find your 1 rep max clean", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Clean & Jerk", description: "Find your 1 rep max clean and jerk", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Shoulder Press", description: "Find your 1 rep max shoulder press", type: .lift, category: "Strength Benchmarks"),
        WOD(title: "1RM Bench Press", description: "Find your 1 rep max bench press", type: .lift, category: "Strength Benchmarks"),

        // MARK: - ENDURANCE BENCHMARKS

        WOD(title: "5k Run", description: "Run 5 kilometers for time", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "10k Run", description: "Run 10 kilometers for time", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "2k Row", description: "Row 2000 meters for time", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "5k Row", description: "Row 5000 meters for time", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "Max Pull-ups", description: "Max unbroken pull-ups", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "Max Handstand Hold", description: "Max time handstand hold", type: .wod, category: "Endurance Benchmarks"),
        WOD(title: "Max Double-Unders", description: "Max unbroken double-unders", type: .wod, category: "Endurance Benchmarks"),
    ]
}
