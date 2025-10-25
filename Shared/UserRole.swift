//
//  UserRole.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import Foundation

enum UserRole: String, Codable, CaseIterable {
    case member = "Member"
    case coach = "Coach"
    case admin = "Admin"

    var canProgramWorkouts: Bool {
        self == .coach || self == .admin
    }

    var canManageGyms: Bool {
        self == .coach || self == .admin
    }

    var canViewMemberProgress: Bool {
        self == .coach || self == .admin
    }
}
