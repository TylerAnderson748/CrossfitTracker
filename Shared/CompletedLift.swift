//
//  CompletedLift.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

import Foundation
import SwiftUI

// Note: This struct is currently unused. The app uses LiftEntry instead.
struct CompletedLift: Identifiable, Codable {
    let id: UUID
    let lift: Lift
    let userName: String
    let weight: Double
    let reps: Int
    let date: Date

    init(id: UUID = UUID(), lift: Lift, userName: String, weight: Double, reps: Int, date: Date = Date()) {
        self.id = id
        self.lift = lift
        self.userName = userName
        self.weight = weight
        self.reps = reps
        self.date = date
    }
}

