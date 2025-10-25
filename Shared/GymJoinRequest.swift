//
//  GymJoinRequest.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation

struct GymJoinRequest: Identifiable, Codable, Hashable {
    let id: UUID
    let userId: UUID
    let gymId: UUID
    var status: RequestStatus
    let requestedAt: Date
    var respondedAt: Date?

    init(id: UUID = UUID(), userId: UUID, gymId: UUID, status: RequestStatus = .pending, requestedAt: Date = Date(), respondedAt: Date? = nil) {
        self.id = id
        self.userId = userId
        self.gymId = gymId
        self.status = status
        self.requestedAt = requestedAt
        self.respondedAt = respondedAt
    }
}

enum RequestStatus: String, Codable {
    case pending = "Pending"
    case approved = "Approved"
    case denied = "Denied"
}
