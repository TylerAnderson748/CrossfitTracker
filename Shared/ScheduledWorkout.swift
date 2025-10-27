//
//  ScheduledWorkout.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation
import FirebaseFirestore

enum RecurrenceType: String, Codable {
    case none = "none"
    case daily = "daily"
    case weekly = "weekly"
    case monthly = "monthly"
}

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

    // Recurrence fields
    var recurrenceType: RecurrenceType // how often this repeats
    var recurrenceEndDate: Date? // when recurrence stops (nil = no end)
    var seriesId: String? // links recurring workouts together
    var weekdays: [Int]? // for weekly recurrence: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat (Calendar.component weekday values)

    init(
        id: String? = nil,
        wodId: String,
        wodTitle: String,
        wodDescription: String,
        date: Date,
        groupId: String? = nil,
        timeSlots: [TimeSlot] = [],
        createdBy: String,
        recurrenceType: RecurrenceType = .none,
        recurrenceEndDate: Date? = nil,
        seriesId: String? = nil,
        weekdays: [Int]? = nil
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
        self.recurrenceType = recurrenceType
        self.recurrenceEndDate = recurrenceEndDate
        self.seriesId = seriesId
        self.weekdays = weekdays
    }

    var isPersonalWorkout: Bool {
        return groupId == nil
    }

    var isRecurring: Bool {
        return recurrenceType != .none
    }
}

