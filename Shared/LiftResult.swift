//
//  LiftResult.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/19/25.
//

import Foundation
import FirebaseFirestore

struct LiftResult: Identifiable, Codable {
    @DocumentID var id: String?
    var userId: String
    var userName: String
    var liftTitle: String
    var weight: Double
    var reps: Int
    var date: Date
    var notes: String?

    init(
        id: String? = nil,
        userId: String,
        userName: String,
        liftTitle: String,
        weight: Double,
        reps: Int,
        date: Date = Date(),
        notes: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.userName = userName
        self.liftTitle = liftTitle
        self.weight = weight
        self.reps = reps
        self.date = date
        self.notes = notes
    }

    // Calculate 1RM using Epley formula
    var estimatedOneRepMax: Double {
        if reps == 1 {
            return weight
        }
        return weight * (1 + Double(reps) / 30)
    }

    // Get percentage of 1RM in 5% intervals from 50% to 100%
    func percentageWeights(of oneRepMax: Double) -> [(percentage: Int, weight: Double)] {
        var results: [(Int, Double)] = []
        for percentage in stride(from: 50, through: 100, by: 5) {
            let weight = oneRepMax * (Double(percentage) / 100.0)
            results.append((percentage, weight))
        }
        return results
    }
}
