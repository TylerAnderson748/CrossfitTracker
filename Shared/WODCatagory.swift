//
//  WODCatagory.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

enum WODCategory: String, CaseIterable, Identifiable {
    case scaled = "Scaled"
    case rx = "RX"
    case elite = "Elite"
    
    var id: String { self.rawValue }
}
