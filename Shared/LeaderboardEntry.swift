//
//  LeaderboardEntry.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/14/25.
//

import Foundation
import FirebaseFirestore

struct LeaderboardEntry: Codable, Identifiable {
    @DocumentID var id: String?
    var userId: String
    var userName: String // Cached for display
    var userGender: String? // User's gender for filtering
    var gymName: String? // User's gym name for display
    var workoutLogId: String // Reference to the workout log
    var normalizedWorkoutName: String // Normalized name for matching (lowercase, no spaces)
    var originalWorkoutName: String // Original workout name as entered
    var scheduledWorkoutId: String? // If from programming

    var resultType: WorkoutResultType
    var timeInSeconds: Double? // For timed workouts
    var rounds: Int? // For AMRAP
    var reps: Int? // Additional reps in AMRAP or max reps
    var weight: Double? // Weight used (lbs or kg)

    var completedDate: Date
    var createdAt: Date

    init(
        id: String? = nil,
        userId: String,
        userName: String,
        userGender: String? = nil,
        gymName: String? = nil,
        workoutLogId: String,
        normalizedWorkoutName: String,
        originalWorkoutName: String,
        scheduledWorkoutId: String? = nil,
        resultType: WorkoutResultType,
        timeInSeconds: Double? = nil,
        rounds: Int? = nil,
        reps: Int? = nil,
        weight: Double? = nil,
        completedDate: Date
    ) {
        self.id = id
        self.userId = userId
        self.userName = userName
        self.userGender = userGender
        self.gymName = gymName
        self.workoutLogId = workoutLogId
        self.normalizedWorkoutName = normalizedWorkoutName
        self.originalWorkoutName = originalWorkoutName
        self.scheduledWorkoutId = scheduledWorkoutId
        self.resultType = resultType
        self.timeInSeconds = timeInSeconds
        self.rounds = rounds
        self.reps = reps
        self.weight = weight
        self.completedDate = completedDate
        self.createdAt = Date()
    }

    /// Create a leaderboard entry from a workout log
    static func from(workoutLog: WorkoutLog, userName: String, userGender: String? = nil, gymName: String? = nil) -> LeaderboardEntry {
        return LeaderboardEntry(
            id: workoutLog.id,  // Use workout log ID for unique identification
            userId: workoutLog.userId,
            userName: userName,
            userGender: userGender,
            gymName: gymName,
            workoutLogId: workoutLog.id ?? "",
            normalizedWorkoutName: normalizeWorkoutName(workoutLog.wodTitle),
            originalWorkoutName: workoutLog.wodTitle,
            scheduledWorkoutId: workoutLog.scheduledWorkoutId,
            resultType: workoutLog.resultType,
            timeInSeconds: workoutLog.timeInSeconds,
            rounds: workoutLog.rounds,
            reps: workoutLog.reps,
            weight: workoutLog.weight,
            completedDate: workoutLog.completedDate
        )
    }

    /// Normalize a workout name for fuzzy matching
    /// Removes spaces, special characters, converts to lowercase
    static func normalizeWorkoutName(_ name: String) -> String {
        return name
            .lowercased()
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "\"", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Calculate similarity score between two workout names (0.0 to 1.0)
    /// Uses Levenshtein distance normalized by string length
    static func similarityScore(name1: String, name2: String) -> Double {
        let normalized1 = normalizeWorkoutName(name1)
        let normalized2 = normalizeWorkoutName(name2)

        if normalized1 == normalized2 {
            return 1.0
        }

        let distance = levenshteinDistance(normalized1, normalized2)
        let maxLength = max(normalized1.count, normalized2.count)

        guard maxLength > 0 else { return 1.0 }

        return 1.0 - (Double(distance) / Double(maxLength))
    }

    /// Calculate Levenshtein distance between two strings
    private static func levenshteinDistance(_ str1: String, _ str2: String) -> Int {
        let str1Array = Array(str1)
        let str2Array = Array(str2)

        let m = str1Array.count
        let n = str2Array.count

        var matrix = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)

        for i in 0...m {
            matrix[i][0] = i
        }

        for j in 0...n {
            matrix[0][j] = j
        }

        for i in 1...m {
            for j in 1...n {
                if str1Array[i - 1] == str2Array[j - 1] {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = min(
                        matrix[i - 1][j] + 1,      // deletion
                        matrix[i][j - 1] + 1,      // insertion
                        matrix[i - 1][j - 1] + 1   // substitution
                    )
                }
            }
        }

        return matrix[m][n]
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
            return ""
        }
    }
}
