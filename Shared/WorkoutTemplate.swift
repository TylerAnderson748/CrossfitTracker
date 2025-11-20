//
//  WorkoutTemplate.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/20/25.
//

import Foundation
import FirebaseFirestore

struct WorkoutTemplate: Codable, Identifiable {
    @DocumentID var id: String?
    var title: String
    var description: String
    var workoutType: WorkoutType // lift or wod
    var createdBy: String // userId who created/saved this template
    var createdAt: Date
    var isPersonal: Bool // true if in user's personal library
    var originalWorkoutId: String? // reference to original workout if copied from group programming

    init(
        id: String? = nil,
        title: String,
        description: String,
        workoutType: WorkoutType,
        createdBy: String,
        isPersonal: Bool = true,
        originalWorkoutId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.workoutType = workoutType
        self.createdBy = createdBy
        self.createdAt = Date()
        self.isPersonal = isPersonal
        self.originalWorkoutId = originalWorkoutId
    }
}
