//
//  ScheduledWorkout.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation
import FirebaseFirestore

struct ScheduledWorkout: Codable, Identifiable {
    @DocumentID var id: String?
    var wodId: String
    var wodTitle: String
    var wodDescription: String
    var date: Date
    var groupId: String? // which group this is for, nil = personal workout
    var timeSlots: [TimeSlot] // available time slots for group workouts
    var createdBy: String
    var createdAt: Date

    init(
        id: String? = nil,
        wodId: String,
        wodTitle: String,
        wodDescription: String,
        date: Date,
        groupId: String? = nil,
        timeSlots: [TimeSlot] = [],
        createdBy: String
    ) {
        self.id = id
        self.wodId = wodId
        self.wodTitle = wodTitle
        self.wodDescription = wodDescription
        self.date = date
        self.groupId = groupId
        self.timeSlots = timeSlots
        self.createdBy = createdBy
        self.createdAt = Date()
    }

    var isPersonalWorkout: Bool {
        return groupId == nil
    }
}

