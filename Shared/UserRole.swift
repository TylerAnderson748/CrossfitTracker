//
//  UserRole.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation

enum UserRole: String, Codable {
    case superAdmin = "superAdmin"
    case owner = "owner"
    case coach = "coach"
    case athlete = "athlete"

    var displayName: String {
        switch self {
        case .superAdmin: return "Super Admin"
        case .owner: return "Gym Owner"
        case .coach: return "Coach"
        case .athlete: return "Athlete"
        }
    }

    // Role hierarchy - higher number = more permissions
    var level: Int {
        switch self {
        case .superAdmin: return 4
        case .owner: return 3
        case .coach: return 2
        case .athlete: return 1
        }
    }

    // Check if this role has permission to do something
    func hasPermission(minimumRole: UserRole) -> Bool {
        return self.level >= minimumRole.level
    }
}
