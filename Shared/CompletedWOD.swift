//
//  CompletedWOD.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

struct CompletedWOD: Identifiable, Codable {
    let id: UUID
    var wod: WOD
    var userName: String
    var time: TimeInterval
    var category: WODCategory
    var date: Date

    init(id: UUID = UUID(), wod: WOD, userName: String, time: TimeInterval, category: WODCategory, date: Date = Date()) {
        self.id = id
        self.wod = wod
        self.userName = userName
        self.time = time
        self.category = category
        self.date = date
    }
}
