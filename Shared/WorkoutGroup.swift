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
    var defaultRevealDaysBefore: Int // 0 = same day, 1 = day before, 2 = two days before
    var defaultRevealHour: Int // hour of day to reveal (0-23), e.g., 16 = 4 PM
    var defaultRevealMinute: Int // minute of hour to reveal (0-59)

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
        defaultRevealDaysBefore: Int = 0,
        defaultRevealHour: Int = 9,
        defaultRevealMinute: Int = 0
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
        self.defaultRevealDaysBefore = defaultRevealDaysBefore
        self.defaultRevealHour = defaultRevealHour
        self.defaultRevealMinute = defaultRevealMinute
    }

    // CodingKeys for current format
    private enum CodingKeys: String, CodingKey {
        case id, gymId, name, type, membershipType, memberIds, coachIds, ownerId
        case isPublic, isDeletable, createdAt, defaultTimeSlots
        case hideDetailsByDefault, defaultRevealDaysBefore, defaultRevealHour, defaultRevealMinute
    }

    // Legacy keys for backward compatibility (decode only)
    private enum LegacyCodingKeys: String, CodingKey {
        case defaultRevealHoursBefore
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

        // Try new format first
        if let daysBefore = try container.decodeIfPresent(Int.self, forKey: .defaultRevealDaysBefore) {
            defaultRevealDaysBefore = daysBefore
            defaultRevealHour = try container.decodeIfPresent(Int.self, forKey: .defaultRevealHour) ?? 9
            defaultRevealMinute = try container.decodeIfPresent(Int.self, forKey: .defaultRevealMinute) ?? 0
        } else {
            // Fall back to old format for backward compatibility
            let legacyContainer = try decoder.container(keyedBy: LegacyCodingKeys.self)
            if let hoursBefore = try legacyContainer.decodeIfPresent(Int.self, forKey: .defaultRevealHoursBefore) {
                // Migrate old format: convert hours before to days before + time
                // Assume first class is at 9 AM, so 24 hours before = day before at 9 AM
                defaultRevealDaysBefore = hoursBefore / 24
                let remainingHours = hoursBefore % 24
                // Calculate what time that would be (e.g., 2 hours before 9 AM = 7 AM same day)
                defaultRevealHour = max(0, 9 - remainingHours)
                defaultRevealMinute = 0
            } else {
                defaultRevealDaysBefore = 0
                defaultRevealHour = 9
                defaultRevealMinute = 0
            }
        }
    }
}
