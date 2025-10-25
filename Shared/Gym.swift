//
//  Gym.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

struct Gym: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var ownerUserId: UUID
    var groupIds: [UUID] // IDs of ProgrammingGroup objects

    init(id: UUID = UUID(), name: String, ownerUserId: UUID, groupIds: [UUID] = []) {
        self.id = id
        self.name = name
        self.ownerUserId = ownerUserId
        self.groupIds = groupIds
    }
}
