//
//  CompletedWOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct CompletedWOD: Identifiable, Codable {
    let id: UUID
    var wod: WOD
    var userName: String
    var time: TimeInterval
    var category: WODCategory
    var date: Date
    var scheduledWorkoutId: UUID? // Link to the scheduled workout, if completed from schedule

    init(id: UUID = UUID(), wod: WOD, userName: String, time: TimeInterval, category: WODCategory, date: Date = Date(), scheduledWorkoutId: UUID? = nil) {
        self.id = id
        self.wod = wod
        self.userName = userName
        self.time = time
        self.category = category
        self.date = date
        self.scheduledWorkoutId = scheduledWorkoutId
    }
}
