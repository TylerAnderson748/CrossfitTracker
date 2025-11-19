//
//  SampleData.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct SampleData {
    static let wods: [WOD] = [
        // WODs
        WOD(title: "Fran", description: "21-15-9 Thrusters & Pull-ups", type: .wod),
        WOD(title: "Murph", description: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run", type: .wod),
        WOD(title: "Cindy", description: "AMRAP 20 min: 5 pull-ups, 10 push-ups, 15 squats", type: .wod),
        WOD(title: "Helen", description: "3 rounds: 400m run, 21 KB swings, 12 pull-ups", type: .wod),

        // Lifts - Squat Variations
        WOD(title: "Back Squat", description: "", type: .lift),
        WOD(title: "Front Squat", description: "", type: .lift),
        WOD(title: "Low-Bar Back Squat", description: "", type: .lift),
        WOD(title: "High-Bar Back Squat", description: "", type: .lift),
        WOD(title: "Box Squat", description: "", type: .lift),
        WOD(title: "Pause Back Squat", description: "", type: .lift),
        WOD(title: "Overhead Squat", description: "", type: .lift),
        WOD(title: "Zercher Squat", description: "", type: .lift),
        WOD(title: "Tempo Squat", description: "", type: .lift),
        WOD(title: "Pause Front Squat", description: "", type: .lift),

        // Deadlift Variations
        WOD(title: "Deadlift", description: "", type: .lift),
        WOD(title: "Sumo Deadlift", description: "", type: .lift),
        WOD(title: "Romanian Deadlift (RDL)", description: "", type: .lift),
        WOD(title: "Deficit Deadlift", description: "", type: .lift),
        WOD(title: "Block Pull Deadlift", description: "", type: .lift),
        WOD(title: "Single-Leg RDL", description: "", type: .lift),

        // Bench Press Variations
        WOD(title: "Bench Press", description: "", type: .lift),
        WOD(title: "Close-Grip Bench Press", description: "", type: .lift),
        WOD(title: "Floor Press", description: "", type: .lift),

        // Olympic Lifting - Clean
        WOD(title: "Clean", description: "", type: .lift),
        WOD(title: "Power Clean", description: "", type: .lift),
        WOD(title: "Hang Clean", description: "", type: .lift),
        WOD(title: "Clean Pull", description: "", type: .lift),

        // Olympic Lifting - Snatch
        WOD(title: "Snatch", description: "", type: .lift),
        WOD(title: "Power Snatch", description: "", type: .lift),
        WOD(title: "Hang Snatch", description: "", type: .lift),
        WOD(title: "Snatch Pull", description: "", type: .lift),

        // Pressing & Overhead Strength
        WOD(title: "Strict Press", description: "", type: .lift),
        WOD(title: "Push Press", description: "", type: .lift),
        WOD(title: "Push Jerk", description: "", type: .lift),
        WOD(title: "Split Jerk", description: "", type: .lift),
        WOD(title: "Behind-the-Neck Press", description: "", type: .lift),
        WOD(title: "Strict Dumbbell Press", description: "", type: .lift),
        WOD(title: "Seated Press", description: "", type: .lift),

        // Lower Body Strength
        WOD(title: "Bulgarian Split Squat", description: "", type: .lift),
        WOD(title: "Weighted Step-Up", description: "", type: .lift),

        // Explosive Strength / Pulling Power
        WOD(title: "Deadlift High Pull", description: "", type: .lift),
        WOD(title: "Deadlift to High Pull", description: "", type: .lift),
        WOD(title: "Kettlebell Swing", description: "", type: .lift),
        WOD(title: "Box Jump", description: "", type: .lift),
        WOD(title: "Weighted Box Step-Overs", description: "", type: .lift),
        WOD(title: "Sled Drag", description: "", type: .lift),
        WOD(title: "Sled Push", description: "", type: .lift),
        WOD(title: "Hip Thrust", description: "", type: .lift),
        WOD(title: "Barbell Hip Bridge", description: "", type: .lift),

        // Accessory Strength
        WOD(title: "Bent Over Row", description: "", type: .lift),
        WOD(title: "Pendlay Row", description: "", type: .lift),
        WOD(title: "Strict Pull-Up", description: "", type: .lift),
        WOD(title: "Barbell Shrug", description: "", type: .lift),
        WOD(title: "Good Morning", description: "", type: .lift),
        WOD(title: "GHD Hip Extension", description: "", type: .lift),
        WOD(title: "GHD Back Extension", description: "", type: .lift)
    ]
}

