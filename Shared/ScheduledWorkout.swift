//
//  ScheduledWorkout.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

enum WorkoutType: String, Codable {
    case wod = "WOD"
    case lift = "Lift"
}

enum WorkoutSource: String, Codable {
    case coachPosted = "Coach Posted"
    case personal = "Personal"
}

struct ScheduledWorkout: Identifiable, Codable, Hashable {
    let id: UUID
    var type: WorkoutType
    var wodId: UUID? // Reference to WOD if type is .wod
    var liftId: UUID? // Reference to Lift if type is .lift
    var customTitle: String? // For custom workouts not in the standard list
    var customDescription: String?
    var date: Date // Which day it's scheduled for
    var source: WorkoutSource
    var createdByUserId: UUID
    var gymId: UUID? // Which gym posted it (nil if personal)
    var groupId: UUID? // Which group it's posted to (nil if personal or gym-wide)

    init(
        id: UUID = UUID(),
        type: WorkoutType,
        wodId: UUID? = nil,
        liftId: UUID? = nil,
        customTitle: String? = nil,
        customDescription: String? = nil,
        date: Date,
        source: WorkoutSource,
        createdByUserId: UUID,
        gymId: UUID? = nil,
        groupId: UUID? = nil
    ) {
        self.id = id
        self.type = type
        self.wodId = wodId
        self.liftId = liftId
        self.customTitle = customTitle
        self.customDescription = customDescription
        self.date = date
        self.source = source
        self.createdByUserId = createdByUserId
        self.gymId = gymId
        self.groupId = groupId
    }

    // Helper to check if this is scheduled for a specific date (ignoring time)
    func isScheduledFor(date: Date) -> Bool {
        Calendar.current.isDate(self.date, inSameDayAs: date)
    }
}
