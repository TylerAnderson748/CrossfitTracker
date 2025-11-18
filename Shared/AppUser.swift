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
    var username: String?
    var role: UserRole
    var firstName: String?
    var lastName: String?
    var displayName: String? // Computed from firstName + lastName
    var createdAt: Date
    var hideFromLeaderboards: Bool // User preference to opt out of leaderboards

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case username
        case role
        case firstName
        case lastName
        case displayName
        case createdAt
        case hideFromLeaderboards
    }

    init(id: String? = nil, email: String, username: String? = nil, role: UserRole = .athlete, firstName: String? = nil, lastName: String? = nil, hideFromLeaderboards: Bool = false) {
        self.id = id
        self.email = email
        self.username = username
        self.role = role
        self.firstName = firstName
        self.lastName = lastName
        self.displayName = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
        self.createdAt = Date()
        self.hideFromLeaderboards = hideFromLeaderboards
    }

    // Custom decoding to handle missing hideFromLeaderboards field
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Decode @DocumentID manually
        _id = try container.decodeIfPresent(DocumentID<String>.self, forKey: .id) ?? DocumentID(wrappedValue: nil)

        email = try container.decode(String.self, forKey: .email)
        username = try container.decodeIfPresent(String.self, forKey: .username)
        role = try container.decode(UserRole.self, forKey: .role)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        createdAt = try container.decode(Date.self, forKey: .createdAt)

        // Default to false if field is missing
        hideFromLeaderboards = try container.decodeIfPresent(Bool.self, forKey: .hideFromLeaderboards) ?? false
    }

    var fullName: String {
        return [firstName, lastName].compactMap { $0 }.joined(separator: " ")
    }
}
