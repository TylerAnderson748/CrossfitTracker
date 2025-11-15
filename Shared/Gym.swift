//
//  Gym.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation
import FirebaseFirestore

struct Gym: Codable, Identifiable {
    @DocumentID var id: String?
    var name: String
    var ownerId: String
    var coachIds: [String]
    var memberIds: [String]
    var createdAt: Date

    init(id: String? = nil, name: String, ownerId: String) {
        self.id = id
        self.name = name
        self.ownerId = ownerId
        self.coachIds = []
        self.memberIds = []
        self.createdAt = Date()
    }
}
