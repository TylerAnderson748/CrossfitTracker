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
    var defaultTimeSlots: [DefaultTimeSlot] // default class times for this group

    // Default hide settings
    var hideDetailsByDefault: Bool // if true, new workouts hide details by default
    var defaultRevealHoursBefore: Int // hours before workout to reveal (0 = at workout time, 24 = day before)

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
        isDeletable: Bool = true,
        defaultTimeSlots: [DefaultTimeSlot] = [],
        hideDetailsByDefault: Bool = false,
        defaultRevealHoursBefore: Int = 0
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
        self.defaultTimeSlots = defaultTimeSlots
        self.hideDetailsByDefault = hideDetailsByDefault
        self.defaultRevealHoursBefore = defaultRevealHoursBefore
    }

    // Custom decoder to handle missing fields in existing documents
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        _id = try container.decode(DocumentID<String>.self, forKey: .id)
        gymId = try container.decodeIfPresent(String.self, forKey: .gymId)
        name = try container.decode(String.self, forKey: .name)
        type = try container.decode(GroupType.self, forKey: .type)
        membershipType = try container.decode(MembershipType.self, forKey: .membershipType)
        memberIds = try container.decode([String].self, forKey: .memberIds)
        coachIds = try container.decode([String].self, forKey: .coachIds)
        ownerId = try container.decode(String.self, forKey: .ownerId)
        isPublic = try container.decode(Bool.self, forKey: .isPublic)
        isDeletable = try container.decode(Bool.self, forKey: .isDeletable)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        defaultTimeSlots = try container.decodeIfPresent([DefaultTimeSlot].self, forKey: .defaultTimeSlots) ?? []
        hideDetailsByDefault = try container.decodeIfPresent(Bool.self, forKey: .hideDetailsByDefault) ?? false
        defaultRevealHoursBefore = try container.decodeIfPresent(Int.self, forKey: .defaultRevealHoursBefore) ?? 0
    }
}
