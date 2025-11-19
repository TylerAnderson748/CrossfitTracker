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

        // Lifts
        WOD(title: "Back Squat", description: "5x5 heavy back squats", type: .lift),
        WOD(title: "Deadlift", description: "1 rep max deadlift", type: .lift),
        WOD(title: "Bench Press", description: "5-5-3-3-1-1", type: .lift),
        WOD(title: "Clean & Jerk", description: "Work up to heavy single", type: .lift),
        WOD(title: "Snatch", description: "EMOMs 12 min: 2 power snatches", type: .lift)
    ]
}

