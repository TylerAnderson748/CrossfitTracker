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

enum WorkoutType: String, Codable {
    case wod = "wod"
    case lift = "lift"
}

struct ScheduledWorkout: Codable, Identifiable {
    @DocumentID var id: String?
    var wodId: String
    var wodTitle: String
    var wodDescription: String
    var date: Date
    var workoutType: WorkoutType // lift or wod
    var groupId: String? // which group this is for, nil = personal workout
    var timeSlots: [TimeSlot] // available time slots for group workouts
    var createdBy: String
    var createdAt: Date

    // Recurrence fields
    var recurrenceType: RecurrenceType // how often this repeats
    var recurrenceEndDate: Date? // when recurrence stops (nil = no end)
    var seriesId: String? // links recurring workouts together
    var weekdays: [Int]? // for weekly recurrence: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat (Calendar.component weekday values)

    // Monthly recurrence fields (week-based)
    var monthlyWeekPosition: Int? // 1=First, 2=Second, 3=Third, 4=Fourth, 5=Last
    var monthlyWeekday: Int? // 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat

    init(
        id: String? = nil,
        wodId: String,
        wodTitle: String,
        wodDescription: String,
        date: Date,
        workoutType: WorkoutType = .wod,
        groupId: String? = nil,
        timeSlots: [TimeSlot] = [],
        createdBy: String,
        recurrenceType: RecurrenceType = .none,
        recurrenceEndDate: Date? = nil,
        seriesId: String? = nil,
        weekdays: [Int]? = nil,
        monthlyWeekPosition: Int? = nil,
        monthlyWeekday: Int? = nil
    ) {
        self.id = id
        self.wodId = wodId
        self.wodTitle = wodTitle
        self.wodDescription = wodDescription
        self.date = date
        self.workoutType = workoutType
        self.groupId = groupId
        self.timeSlots = timeSlots
        self.createdBy = createdBy
        self.createdAt = Date()
        self.recurrenceType = recurrenceType
        self.recurrenceEndDate = recurrenceEndDate
        self.seriesId = seriesId
        self.weekdays = weekdays
        self.monthlyWeekPosition = monthlyWeekPosition
        self.monthlyWeekday = monthlyWeekday
    }

    var isPersonalWorkout: Bool {
        return groupId == nil
    }

    var isRecurring: Bool {
        return recurrenceType != .none
    }
}

