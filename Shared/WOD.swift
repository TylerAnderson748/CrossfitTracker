//
//  WOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct WOD: Identifiable, Codable {
    var id = UUID()
    var title: String
    var description: String
}
