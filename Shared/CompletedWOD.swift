//
//  CompletedWOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct CompletedWOD: Identifiable, Codable {
    var id = UUID()
    var wod: WOD
    var userName: String
    var time: TimeInterval
    var category: WODCategory
    var date: Date = Date() // ✅ Used in history graphs and sorting
}
