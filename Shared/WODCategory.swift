//
//  WODCategory.swift
//  CrossfitTracker
//

import Foundation
import SwiftUI

enum WODCategory: String, CaseIterable, Identifiable, Codable {
    case rx = "RX"
    case scaled = "Scaled"
    case happy = "Just for Fun"

    var id: String { rawValue }

    /// Determines leaderboard order
    var priority: Int {
        switch self {
        case .rx: return 0
        case .scaled: return 1
        case .happy: return 2
        }
    }

    /// Optional color for UI
    var color: Color {
        switch self {
        case .rx: return .blue
        case .scaled: return .gray
        case .happy: return .green
        }
    }

    /// Get category from notes string, handling legacy values
    static func fromNotes(_ notes: String?) -> WODCategory {
        guard let notes = notes, !notes.isEmpty else { return .happy }

        // Check for exact matches first
        if let category = WODCategory(rawValue: notes) {
            return category
        }

        // Handle legacy "Just Happy To Be Here" value
        if notes == "Just Happy To Be Here" {
            return .happy
        }

        // Default to happy for unknown values
        return .happy
    }

    /// Short display name for UI
    var shortName: String {
        switch self {
        case .rx: return "RX"
        case .scaled: return "Scaled"
        case .happy: return "Fun"
        }
    }
}
