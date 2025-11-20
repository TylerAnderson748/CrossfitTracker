//
//  WorkoutGroup.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/26/25.
//

import Foundation
import FirebaseFirestore

enum GroupType: String, Codable {
    case defaultGroup = "default"
    case custom = "custom"
    case personal = "personal"
}

enum MembershipType: String, Codable {
    case autoAssignAll = "auto-assign-all"
    case inviteOnly = "invite-only"
}

struct WorkoutGroup: Codable, Identifiable {
    @DocumentID var id: String?
    var gymId: String? // nil for personal groups
    var name: String
    var type: GroupType
    var membershipType: MembershipType
    var memberIds: [String]
    var coachIds: [String] // who can program for this group
    var ownerId: String
    var isPublic: Bool
    var isDeletable: Bool // false for "Members" default group
    var createdAt: Date

    init(
        id: String? = nil,
        gymId: String?,
        name: String,
        type: GroupType,
        membershipType: MembershipType,
        memberIds: [String] = [],
        coachIds: [String] = [],
        ownerId: String,
        isPublic: Bool = false,
        isDeletable: Bool = true
    ) {
        self.id = id
        self.gymId = gymId
        self.name = name
        self.type = type
        self.membershipType = membershipType
        self.memberIds = memberIds
        self.coachIds = coachIds
        self.ownerId = ownerId
        self.isPublic = isPublic
        self.isDeletable = isDeletable
        self.createdAt = Date()
    }
}
