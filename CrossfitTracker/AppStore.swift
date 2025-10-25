//
//  AppStore.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import SwiftUI
import Combine

final class AppStore: ObservableObject {
    static let shared = AppStore()

    // MARK: - UserDefaults Keys
    private enum Keys {
        static let isLoggedIn = "isLoggedIn"
        static let userName = "userName"
        static let completedWODs = "completedWODs"
        static let lifts = "lifts"
        static let liftEntries = "liftEntries"
    }

    private var isLoading = false

    // MARK: - User info
    @Published var isLoggedIn: Bool = false {
        didSet {
            if !isLoading { saveUserInfo() }
        }
    }
    @Published var userName: String = "Guest" {
        didSet {
            if !isLoading { saveUserInfo() }
        }
    }

    // MARK: - WODs
    @Published var activeWOD: WOD? = nil
    @Published var wodStartTime: Date? = nil
    @Published var completedWODs: [CompletedWOD] = [] {
        didSet {
            if !isLoading { saveCompletedWODs() }
        }
    }

    // MARK: - Lifts
    @Published var lifts: [Lift] = [
        Lift(name: "Back Squat"),
        Lift(name: "Front Squat"),
        Lift(name: "Deadlift"),
        Lift(name: "Snatch"),
        Lift(name: "Clean"),
        Lift(name: "Overhead Press")
    ] {
        didSet {
            if !isLoading { saveLifts() }
        }
    }

    @Published var liftEntries: [LiftEntry] = [] {
        didSet {
            if !isLoading { saveLiftEntries() }
        }
    }

    private init() {
        isLoading = true
        loadUserInfo()
        loadCompletedWODs()
        loadLifts()
        loadLiftEntries()
        isLoading = false
    }

    // MARK: - User Actions
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

    // MARK: - WOD Actions
    func startWOD(_ wod: WOD) {
        activeWOD = wod
        wodStartTime = Date()
    }

    func stopWOD(category: WODCategory) {
        guard let wod = activeWOD, let start = wodStartTime else { return }
        let elapsed = Date().timeIntervalSince(start)
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

    // MARK: - Lift Actions
    func addLift(name: String) {
        let new = Lift(name: name)
        lifts.append(new)
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
        if let reps = reps { filtered = filtered.filter { $0.reps == reps } }
        return filtered.sorted { $0.date < $1.date }
    }

    func mostRecentWeight(for lift: Lift, reps: Int) -> Double? {
        let entries = liftEntries.filter { $0.liftID == lift.id && $0.reps == reps }
        return entries.sorted(by: { $0.date > $1.date }).first?.weight
    }
    
    // MARK: - Manual WOD Result
    func addManualWODResult(wod: WOD, time: TimeInterval, category: WODCategory) {
        let completed = CompletedWOD(
            wod: wod,
            userName: userName,
            time: time,
            category: category
        )
        completedWODs.append(completed)
    }

    func editCompletedWOD(entryID: UUID, newTime: TimeInterval, newDate: Date, newCategory: WODCategory) {
        if let idx = completedWODs.firstIndex(where: { $0.id == entryID }) {
            completedWODs[idx].time = newTime
            completedWODs[idx].date = newDate
            completedWODs[idx].category = newCategory
        }
    }

    func deleteCompletedWOD(entryID: UUID) {
        completedWODs.removeAll { $0.id == entryID }
    }

    // MARK: - WOD Results Query
    func results(for wod: WOD) -> [CompletedWOD] {
        return completedWODs.filter { $0.wod.id == wod.id }
    }

    // MARK: - Persistence
    private func saveUserInfo() {
        UserDefaults.standard.set(isLoggedIn, forKey: Keys.isLoggedIn)
        UserDefaults.standard.set(userName, forKey: Keys.userName)
    }

    private func loadUserInfo() {
        isLoggedIn = UserDefaults.standard.bool(forKey: Keys.isLoggedIn)
        if let name = UserDefaults.standard.string(forKey: Keys.userName) {
            userName = name
        }
    }

    private func saveCompletedWODs() {
        if let encoded = try? JSONEncoder().encode(completedWODs) {
            UserDefaults.standard.set(encoded, forKey: Keys.completedWODs)
        }
    }

    private func loadCompletedWODs() {
        if let data = UserDefaults.standard.data(forKey: Keys.completedWODs),
           let decoded = try? JSONDecoder().decode([CompletedWOD].self, from: data) {
            completedWODs = decoded
        }
    }

    private func saveLifts() {
        if let encoded = try? JSONEncoder().encode(lifts) {
            UserDefaults.standard.set(encoded, forKey: Keys.lifts)
        }
    }

    private func loadLifts() {
        if let data = UserDefaults.standard.data(forKey: Keys.lifts),
           let decoded = try? JSONDecoder().decode([Lift].self, from: data) {
            lifts = decoded
        }
    }

    private func saveLiftEntries() {
        if let encoded = try? JSONEncoder().encode(liftEntries) {
            UserDefaults.standard.set(encoded, forKey: Keys.liftEntries)
        }
    }

    private func loadLiftEntries() {
        if let data = UserDefaults.standard.data(forKey: Keys.liftEntries),
           let decoded = try? JSONDecoder().decode([LiftEntry].self, from: data) {
            liftEntries = decoded
        }
    }
}
