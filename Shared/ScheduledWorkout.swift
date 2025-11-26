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
    var workoutType: WorkoutType // lift or wod
    var groupIds: [String] // which groups this is for, empty = personal workout
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
        groupIds: [String] = [],
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
        self.groupIds = groupIds
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
        return groupIds.isEmpty
    }

    var isRecurring: Bool {
        return recurrenceType != .none
    }

    // Custom decoder to handle old workouts without newer fields
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Decode core required fields (always present)
        wodId = try container.decode(String.self, forKey: .wodId)
        wodTitle = try container.decode(String.self, forKey: .wodTitle)
        wodDescription = try container.decode(String.self, forKey: .wodDescription)
        date = try container.decode(Date.self, forKey: .date)
        createdBy = try container.decode(String.self, forKey: .createdBy)
        createdAt = try container.decode(Date.self, forKey: .createdAt)

        // Decode fields with defaults for backward compatibility
        workoutType = try container.decodeIfPresent(WorkoutType.self, forKey: .workoutType) ?? .wod
        recurrenceType = try container.decodeIfPresent(RecurrenceType.self, forKey: .recurrenceType) ?? .none

        // Decode optional fields (except id - let @DocumentID handle that)
        // Handle backward compatibility: old workouts have groupId, new ones have groupIds
        if let groupIds = try container.decodeIfPresent([String].self, forKey: .groupIds) {
            self.groupIds = groupIds
        } else if let groupId = try container.decodeIfPresent(String.self, forKey: .groupId) {
            // Migrate old single groupId to array
            self.groupIds = [groupId]
        } else {
            self.groupIds = []
        }

        timeSlots = try container.decodeIfPresent([TimeSlot].self, forKey: .timeSlots) ?? []
        recurrenceEndDate = try container.decodeIfPresent(Date.self, forKey: .recurrenceEndDate)
        seriesId = try container.decodeIfPresent(String.self, forKey: .seriesId)
        weekdays = try container.decodeIfPresent([Int].self, forKey: .weekdays)
        monthlyWeekPosition = try container.decodeIfPresent(Int.self, forKey: .monthlyWeekPosition)
        monthlyWeekday = try container.decodeIfPresent(Int.self, forKey: .monthlyWeekday)

        // Let @DocumentID wrapper handle the id field from Firestore
        // This ensures the document ID is properly extracted
        _id = try DocumentID<String>(from: decoder)
    }

    private enum CodingKeys: String, CodingKey {
        case wodId, wodTitle, wodDescription, date, workoutType
        case groupId, groupIds, timeSlots, createdBy, createdAt
        case recurrenceType, recurrenceEndDate, seriesId, weekdays
        case monthlyWeekPosition, monthlyWeekday
        // Note: 'id' is intentionally excluded - @DocumentID handles it
    }

    // Custom encoder to handle the groupId/groupIds migration
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(wodId, forKey: .wodId)
        try container.encode(wodTitle, forKey: .wodTitle)
        try container.encode(wodDescription, forKey: .wodDescription)
        try container.encode(date, forKey: .date)
        try container.encode(workoutType, forKey: .workoutType)
        try container.encode(groupIds, forKey: .groupIds)
        try container.encode(timeSlots, forKey: .timeSlots)
        try container.encode(createdBy, forKey: .createdBy)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(recurrenceType, forKey: .recurrenceType)
        try container.encodeIfPresent(recurrenceEndDate, forKey: .recurrenceEndDate)
        try container.encodeIfPresent(seriesId, forKey: .seriesId)
        try container.encodeIfPresent(weekdays, forKey: .weekdays)
        try container.encodeIfPresent(monthlyWeekPosition, forKey: .monthlyWeekPosition)
        try container.encodeIfPresent(monthlyWeekday, forKey: .monthlyWeekday)
    }
}
