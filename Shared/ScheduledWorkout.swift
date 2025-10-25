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
    var gymId: String?
    var assignedToUserIds: [String]
    var createdBy: String
    var createdAt: Date

    init(id: String? = nil, wodId: String, wodTitle: String, wodDescription: String, date: Date, gymId: String? = nil, assignedToUserIds: [String] = [], createdBy: String) {
        self.id = id
        self.wodId = wodId
        self.wodTitle = wodTitle
        self.wodDescription = wodDescription
        self.date = date
        self.gymId = gymId
        self.assignedToUserIds = assignedToUserIds
        self.createdBy = createdBy
        self.createdAt = Date()
    }
}
