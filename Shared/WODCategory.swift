//
//  WODCategory.swift
//  CrossfitTracker
//

import Foundation
import SwiftUI

enum WODCategory: String, CaseIterable, Identifiable, Codable {
    case rxPlus = "RX+"
    case rx = "RX"
    case scaled = "Scaled"
    case happy = "Just Happy To Be Here"

    var id: String { rawValue }

    /// Determines leaderboard order
    var priority: Int {
        switch self {
        case .rxPlus: return 0      // top tier
        case .rx: return 1
        case .scaled: return 2
        case .happy: return 3       // lowest tier
        }
    }

    /// Optional color for UI
    var color: Color {
        switch self {
        case .rxPlus: return .orange
        case .rx: return .blue
        case .scaled: return .gray
        case .happy: return .green
        }
    }
}
