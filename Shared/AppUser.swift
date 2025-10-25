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
    var displayName: String?
    var createdAt: Date

    init(id: String? = nil, email: String, role: UserRole = .athlete, displayName: String? = nil) {
        self.id = id
        self.email = email
        self.role = role
        self.displayName = displayName
        self.createdAt = Date()
    }
}
