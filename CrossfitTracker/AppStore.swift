//
//  AppStore.swift
//  CrossfitTracker
//

import Foundation
import SwiftUI
import Combine

final class AppStore: ObservableObject {
    static let shared = AppStore()

    // MARK: - User Info
    @Published var isLoggedIn: Bool = false
    @Published var userName: String = "Guest"

    // MARK: - WODs
    @Published var activeWOD: WOD? = nil
    @Published var wodStartTime: Date? = nil
    @Published var completedWODs: [CompletedWOD] = []

    // MARK: - Lifts
    @Published var lifts: [Lift] = [
        Lift(name: "Back Squat"),
        Lift(name: "Front Squat"),
        Lift(name: "Deadlift"),
        Lift(name: "Snatch"),
        Lift(name: "Clean"),
        Lift(name: "Overhead Press")
    ]
    @Published var liftEntries: [LiftEntry] = []

    private init() {}

    // MARK: - Login
    func logIn(name: String) {
        userName = name
        isLoggedIn = true
    }

    func logOut() {
        userName = "Guest"
        isLoggedIn = false
        activeWOD = nil
        wodStartTime = nil
    }

    // MARK: - WOD Handling
    func startWOD(_ wod: WOD) {
        activeWOD = wod
        wodStartTime = Date()
    }

    func stopWOD(category: WODCategory) {
        guard let wod = activeWOD, let start = wodStartTime else { return }
        let elapsed = Date().timeIntervalSince(start)
        let completed = CompletedWOD(wod: wod, userName: userName, time: elapsed, category: category, date: Date())
        completedWODs.append(completed)
        activeWOD = nil
        wodStartTime = nil
    }

    func addManualWODResult(wod: WOD, category: WODCategory, time: TimeInterval) {
        let completed = CompletedWOD(wod: wod, userName: userName, time: time, category: category, date: Date())
        completedWODs.append(completed)
    }

    func results(for wod: WOD) -> [CompletedWOD] {
        completedWODs
            .filter { $0.wod.id == wod.id }
            .sorted { $0.time < $1.time }
    }

    // MARK: - Lift Handling
    func addLift(name: String) {
        let newLift = Lift(name: name)
        lifts.append(newLift)
    }

    func addLiftEntry(lift: Lift, weight: Double, reps: Int, date: Date = Date()) {
        let entry = LiftEntry(liftID: lift.id, userName: userName, weight: weight, reps: reps, date: date)
        liftEntries.append(entry)
    }

    func editLiftEntry(entryID: UUID, newWeight: Double, newReps: Int, newDate: Date) {
        if let idx = liftEntries.firstIndex(where: { $0.id == entryID }) {
            liftEntries[idx].weight = newWeight
            liftEntries[idx].reps = newReps
            liftEntries[idx].date = newDate
        }
    }

    func deleteLiftEntry(entryID: UUID) {
        liftEntries.removeAll { $0.id == entryID }
    }

    func entries(for lift: Lift, reps: Int? = nil) -> [LiftEntry] {
        var filtered = liftEntries.filter { $0.liftID == lift.id }
        if let reps = reps {
            filtered = filtered.filter { $0.reps == reps }
        }
        return filtered.sorted { $0.date < $1.date }
    }

    func mostRecentWeight(for lift: Lift, reps: Int) -> Double? {
        let recent = entries(for: lift, reps: reps).sorted { $0.date > $1.date }
        return recent.first?.weight
    }
}
