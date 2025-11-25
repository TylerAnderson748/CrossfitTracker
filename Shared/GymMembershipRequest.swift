//
//  GymMembershipRequest.swift
//  CrossfitTracker
//
//  Created by Claude on 11/25/25.
//

import Foundation
import FirebaseFirestore

enum RequestStatus: String, Codable {
    case pending = "pending"
    case approved = "approved"
    case denied = "denied"
}

struct GymMembershipRequest: Codable, Identifiable {
    @DocumentID var id: String?
    var gymId: String
    var gymName: String // Cached for display
    var userId: String
    var userEmail: String // Cached for display
    var userDisplayName: String? // Cached for display
    var status: RequestStatus
    var requestedAt: Date
    var processedAt: Date?
    var processedBy: String? // User ID of owner who approved/denied

    init(gymId: String, gymName: String, userId: String, userEmail: String, userDisplayName: String? = nil) {
        self.gymId = gymId
        self.gymName = gymName
        self.userId = userId
        self.userEmail = userEmail
        self.userDisplayName = userDisplayName
        self.status = .pending
        self.requestedAt = Date()
    }
}
