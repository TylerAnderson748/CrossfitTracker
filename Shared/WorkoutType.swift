//
//  WorkoutType.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

enum WorkoutType: String, CaseIterable, Identifiable, Codable {
    case lift = "Lifts"
    case wod = "WODs"

    var id: String { rawValue }
}
