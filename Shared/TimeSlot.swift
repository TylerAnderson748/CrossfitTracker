//
//  TimeSlot.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/26/25.
//

import Foundation

// Default time slot for group settings (just time, no date)
struct DefaultTimeSlot: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var hour: Int // 0-23
    var minute: Int // 0-59
    var capacity: Int // max attendees, 0 = unlimited

    init(id: String = UUID().uuidString, hour: Int, minute: Int, capacity: Int = 20) {
        self.id = id
        self.hour = hour
        self.minute = minute
        self.capacity = capacity
    }

    var timeString: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        let calendar = Calendar.current
        let date = calendar.date(from: DateComponents(hour: hour, minute: minute)) ?? Date()
        return formatter.string(from: date)
    }

    // Convert to a TimeSlot for a specific date
    func toTimeSlot(for date: Date) -> TimeSlot {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month, .day], from: date)
        components.hour = hour
        components.minute = minute
        let slotDate = calendar.date(from: components) ?? date
        return TimeSlot(startTime: slotDate, capacity: capacity)
    }
}

struct TimeSlot: Codable, Identifiable {
    var id: String = UUID().uuidString
    var startTime: Date
    var capacity: Int // max attendees, 0 = unlimited
    var signedUpUserIds: [String]

    init(id: String = UUID().uuidString, startTime: Date, capacity: Int, signedUpUserIds: [String] = []) {
        self.id = id
        self.startTime = startTime
        self.capacity = capacity
        self.signedUpUserIds = signedUpUserIds
    }

    var isFull: Bool {
        return capacity > 0 && signedUpUserIds.count >= capacity
    }

    var spotsRemaining: Int {
        if capacity == 0 { return Int.max } // unlimited
        return max(0, capacity - signedUpUserIds.count)
    }
}
