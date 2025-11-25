//
//  WODCategory.swift
//  CrossfitTracker
//

import Foundation
import SwiftUI

enum WODCategory: String, CaseIterable, Identifiable, Codable {
    case rx = "RX"
    case scaled = "Scaled"
    case happy = "Just Happy To Be Here"

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
}
