//
//  CompletedLift.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

import Foundation
import SwiftUI

struct CompletedLift: Identifiable {
    let id = UUID()
    let lift: Lift
    let userName: String
    let weight: Double
    let reps: Int
    let date: Date
}

