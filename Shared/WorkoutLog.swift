//
//  WorkoutLog.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/26/25.
//

import Foundation
import FirebaseFirestore

enum WorkoutResultType: String, Codable {
    case time = "time" // For time (AMRAP counted in rounds+reps)
    case rounds = "rounds" // AMRAP - as many rounds as possible
    case weight = "weight" // Max weight lifted
    case reps = "reps" // Max reps
    case other = "other" // Custom
}

struct WorkoutLog: Codable, Identifiable {
    @DocumentID var id: String?
    var userId: String
    var scheduledWorkoutId: String? // Links to the scheduled workout if from programming
    var wodTitle: String
    var wodDescription: String
    var workoutDate: Date // When the workout was scheduled for
    var completedDate: Date // When they actually completed it

    // Results
    var resultType: WorkoutResultType
    var timeInSeconds: Double? // For timed workouts
    var rounds: Int? // For AMRAP
    var reps: Int? // Additional reps in AMRAP or max reps
    var weight: Double? // Weight used (lbs or kg)
    var notes: String? // User notes

    // PR tracking
    var isPersonalRecord: Bool // Was this a PR when logged?

    init(
        id: String? = nil,
        userId: String,
        scheduledWorkoutId: String? = nil,
        wodTitle: String,
        wodDescription: String,
        workoutDate: Date,
        completedDate: Date = Date(),
        resultType: WorkoutResultType,
        timeInSeconds: Double? = nil,
        rounds: Int? = nil,
        reps: Int? = nil,
        weight: Double? = nil,
        notes: String? = nil,
        isPersonalRecord: Bool = false
    ) {
        self.id = id
        self.userId = userId
        self.scheduledWorkoutId = scheduledWorkoutId
        self.wodTitle = wodTitle
        self.wodDescription = wodDescription
        self.workoutDate = workoutDate
        self.completedDate = completedDate
        self.resultType = resultType
        self.timeInSeconds = timeInSeconds
        self.rounds = rounds
        self.reps = reps
        self.weight = weight
        self.notes = notes
        self.isPersonalRecord = isPersonalRecord
    }

    var formattedTime: String {
        guard let seconds = timeInSeconds else { return "" }
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    var formattedRounds: String {
        guard let rounds = rounds else { return "" }
        if let reps = reps, reps > 0 {
            return "\(rounds) rounds + \(reps) reps"
        }
        return "\(rounds) rounds"
    }

    var resultSummary: String {
        switch resultType {
        case .time:
            return formattedTime
        case .rounds:
            return formattedRounds
        case .weight:
            if let weight = weight {
                return "\(Int(weight)) lbs"
            }
            return ""
        case .reps:
            if let reps = reps {
                return "\(reps) reps"
            }
            return ""
        case .other:
            return notes ?? ""
        }
    }
}
