//
//  Lift.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

// Lift.swift
// Models for lifts and lift entries

import Foundation

struct Lift: Identifiable, Codable, Equatable, Hashable {
    let id: UUID
    var name: String

    init(id: UUID = UUID(), name: String) {
        self.id = id
        self.name = name
    }
}

struct LiftEntry: Identifiable, Codable {
    let id: UUID
    let liftID: UUID
    let userName: String
    var weight: Double
    var reps: Int
    var date: Date

    init(id: UUID = UUID(), liftID: UUID, userName: String, weight: Double, reps: Int, date: Date = Date()) {
        self.id = id
        self.liftID = liftID
        self.userName = userName
        self.weight = weight
        self.reps = reps
        self.date = date
    }
}
