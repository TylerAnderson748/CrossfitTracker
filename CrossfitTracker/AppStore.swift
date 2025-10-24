//
//  AppStore.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

// AppStore.swift
// Additions for Lifts (replace/merge into your AppStore)

import Foundation
import SwiftUI
import Combine

final class AppStore: ObservableObject {
    static let shared = AppStore()

    // Existing user/WOD properties (keep your existing ones)
    @Published var isLoggedIn: Bool = false
    @Published var userName: String = "Guest"

    // WOD-related (if you used these earlier)
    @Published var activeWOD: WOD? = nil
    @Published var wodStartTime: Date? = nil
    @Published var completedWODs: [CompletedWOD] = []

    // -------------------------
    // Lifts-related properties
    // -------------------------
    @Published var lifts: [Lift] = [
        Lift(name: "Back Squat"),
        Lift(name: "Front Squat"),
        Lift(name: "Deadlift"),
        Lift(name: "Snatch"),
        Lift(name: "Clean"),
        Lift(name: "Overhead Press")
    ]

    @Published var liftEntries: [LiftEntry] = [] // all historical entries for all lifts

    // initializer (keep your existing observers if any)
    private init() {
        // existing notifications / setup can remain
    }

    // MARK: - Lift methods

    /// Add a new lift to the list (user-created)
    func addLift(name: String) {
        let new = Lift(name: name)
        lifts.append(new)
    }

    /// Add a lift entry (a recorded max for a lift + reps)
    func addLiftEntry(lift: Lift, weight: Double, reps: Int, date: Date = Date()) {
        let entry = LiftEntry(liftID: lift.id, userName: userName, weight: weight, reps: reps, date: date)
        liftEntries.append(entry)
    }

    /// Edit an existing lift entry (by id)
    func editLiftEntry(entryID: UUID, newWeight: Double, newReps: Int, newDate: Date) {
        if let idx = liftEntries.firstIndex(where: { $0.id == entryID }) {
            liftEntries[idx].weight = newWeight
            liftEntries[idx].reps = newReps
            liftEntries[idx].date = newDate
        }
    }

    /// Delete lift entry
    func deleteLiftEntry(entryID: UUID) {
        liftEntries.removeAll { $0.id == entryID }
    }

    /// Get history entries for a given lift (optionally filter by reps)
    func entries(for lift: Lift, reps: Int? = nil) -> [LiftEntry] {
        var filtered = liftEntries.filter { $0.liftID == lift.id }
        if let r = reps { filtered = filtered.filter { $0.reps == r } }
        return filtered.sorted { $0.date < $1.date }
    }

    /// Most recent weight for a lift/reps combination (nil if none)
    func mostRecentWeight(for lift: Lift, reps: Int) -> Double? {
        let entries = entries(for: lift, reps: reps).sorted { $0.date > $1.date }
        return entries.first?.weight
    }
    
    // MARK: - Authentication methods
        func logIn(name: String) {
            self.userName = name
            self.isLoggedIn = true
        }

        func logOut() {
            self.userName = "Guest"
            self.isLoggedIn = false
            self.activeWOD = nil
            self.wodStartTime = nil
        }
    
    // MARK: - WOD Methods

    func startWOD(_ wod: WOD) {
        activeWOD = wod
        wodStartTime = Date()
    }

    func stopWOD(category: WODCategory, time: TimeInterval? = nil) {
        guard let wod = activeWOD else { return }
        let elapsed = time ?? (wodStartTime.map { Date().timeIntervalSince($0) } ?? 0)
        let completed = CompletedWOD(
            wod: wod,
            userName: userName,
            time: elapsed,
            category: category
        )
        completedWODs.append(completed)
        activeWOD = nil
        wodStartTime = nil
    }


}
