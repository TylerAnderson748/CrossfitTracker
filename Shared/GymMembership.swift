//
//  GymMembership.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

struct GymMembership: Identifiable, Codable, Hashable {
    let id: UUID
    var userId: UUID
    var gymId: UUID
    var groupIds: [UUID] // Which programming groups within this gym

    init(id: UUID = UUID(), userId: UUID, gymId: UUID, groupIds: [UUID] = []) {
        self.id = id
        self.userId = userId
        self.gymId = gymId
        self.groupIds = groupIds
    }
}
