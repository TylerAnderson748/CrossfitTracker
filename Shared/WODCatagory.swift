//
//  WODCategory.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

enum WODCategory: String, CaseIterable, Codable, Identifiable {
    case scaled = "Scaled"
    case rx = "RX"
    case rxPlus = "RX+"

    var id: String { rawValue }
}
