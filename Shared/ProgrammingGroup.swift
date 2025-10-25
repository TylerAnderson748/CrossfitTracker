//
//  ProgrammingGroup.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

struct ProgrammingGroup: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var gymId: UUID
    var memberIds: [UUID] // User IDs who belong to this group

    init(id: UUID = UUID(), name: String, gymId: UUID, memberIds: [UUID] = []) {
        self.id = id
        self.name = name
        self.gymId = gymId
        self.memberIds = memberIds
    }
}
