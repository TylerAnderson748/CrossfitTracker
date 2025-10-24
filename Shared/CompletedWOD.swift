//
//  CompletedWOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct CompletedWOD: Identifiable {
    let id = UUID()
    let wod: WOD
    let userName: String
    let time: TimeInterval
    let category: WODCategory
}
