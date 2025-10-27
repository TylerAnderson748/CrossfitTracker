//
//  AppUser.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import Foundation
import FirebaseFirestore

struct AppUser: Codable, Identifiable {
    @DocumentID var id: String?
    var email: String
    var role: UserRole
    var firstName: String?
    var lastName: String?
    var displayName: String? // Computed from firstName + lastName
    var createdAt: Date

    init(id: String? = nil, email: String, role: UserRole = .athlete, firstName: String? = nil, lastName: String? = nil) {
        self.id = id
        self.email = email
        self.role = role
        self.firstName = firstName
        self.lastName = lastName
        self.displayName = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
        self.createdAt = Date()
    }

    var fullName: String {
        return [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
}
