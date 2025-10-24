//
//  WOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct WOD: Identifiable {
    let id = UUID()
    let title: String
    let description: String
}
