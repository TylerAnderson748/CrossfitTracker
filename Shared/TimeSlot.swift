//
//  TimeSlot.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/26/25.
//

import Foundation

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
