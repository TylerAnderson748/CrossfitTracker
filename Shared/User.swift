//
//  User.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

struct User: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var email: String
    var role: UserRole
    var gymMembershipIds: [UUID] // IDs of GymMembership objects

    init(id: UUID = UUID(), name: String, email: String = "", role: UserRole, gymMembershipIds: [UUID] = []) {
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.gymMembershipIds = gymMembershipIds
    }
}
