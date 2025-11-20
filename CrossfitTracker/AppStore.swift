//
//  AppStore.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import SwiftUI
import Combine
import FirebaseAuth
import FirebaseFirestore

final class AppStore: ObservableObject {
    static let shared = AppStore()

    // MARK: - User info
    @Published var isLoggedIn: Bool = false
    @Published var userName: String = "Guest"
    @Published var currentUser: FirebaseAuth.User?
    @Published var appUser: AppUser? // The full app user profile

    // MARK: - WODs
    @Published var wods: [WOD] = SampleData.wods // User's WOD library (includes defaults + custom)
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

    @Published var liftEntries: [LiftEntry] = [] // all lift history entries

    // MARK: - Scheduled Workouts
    @Published var scheduledWorkouts: [ScheduledWorkout] = []

    private init() {}

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

    // MARK: - WOD Results Query
    func results(for wod: WOD) -> [CompletedWOD] {
        return completedWODs.filter { $0.wod.id == wod.id }
    }

    // MARK: - WOD Management
    func addWOD(title: String, description: String) {
        let newWOD = WOD(title: title, description: description)
        wods.append(newWOD)
    }

    func deleteWOD(id: UUID) {
        wods.removeAll { $0.id == id }
        // Also remove any scheduled workouts using this WOD
        scheduledWorkouts.removeAll { $0.wodID == id }
    }

    // MARK: - Scheduled Workout Management
    func addScheduledWorkout(_ workout: ScheduledWorkout) {
        scheduledWorkouts.append(workout)
    }

    func updateScheduledWorkout(_ workout: ScheduledWorkout) {
        if let idx = scheduledWorkouts.firstIndex(where: { $0.id == workout.id }) {
            scheduledWorkouts[idx] = workout
        }
    }

    func deleteScheduledWorkout(id: String) {
        scheduledWorkouts.removeAll { $0.id == id }
    }

    func toggleScheduledWorkout(id: String) {
        if let idx = scheduledWorkouts.firstIndex(where: { $0.id == id }) {
            scheduledWorkouts[idx].isActive.toggle()
        }
    }

    // Get scheduled workouts for a specific date
    func scheduledWorkouts(for date: Date) -> [ScheduledWorkout] {
        return scheduledWorkouts.filter { $0.shouldOccur(on: date) }
    }

    // Get workout name helper
    func workoutName(for scheduled: ScheduledWorkout) -> String {
        // Use wodTitle directly if available (new model)
        if !scheduled.wodTitle.isEmpty {
            return scheduled.wodTitle
        }

        // Fall back to legacy workoutType-based lookup
        guard let workoutType = scheduled.workoutType else {
            return "Unknown"
        }

        switch workoutType {
        case .lift:
            if let liftID = scheduled.liftID,
               let lift = lifts.first(where: { $0.id == liftID }) {
                return lift.name
            }
        case .wod:
            if let wodID = scheduled.wodID,
               let wod = wods.first(where: { $0.id == wodID }) {
                return wod.title
            }
        }
        return "Unknown"
    }

    // MARK: - Firebase Scheduled Workout Management
    func saveRecurringWorkout(_ workout: ScheduledWorkout, completion: @escaping ([ScheduledWorkout]?, String?) -> Void) {
        let db = Firestore.firestore()

        // Generate individual workout instances based on recurrence
        var instances: [ScheduledWorkout] = []
        let calendar = Calendar.current
        let startDate = workout.date
        let endDate = workout.recurrenceEndDate ?? calendar.date(byAdding: .year, value: 1, to: startDate) ?? startDate

        var currentDate = startDate
        while currentDate <= endDate {
            if workout.shouldOccur(on: currentDate) {
                var instance = workout
                instance.id = UUID().uuidString
                instance.date = currentDate
                instances.append(instance)
            }

            // Move to next day
            guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else { break }
            currentDate = nextDate
        }

        // Save all instances to Firestore
        let batch = db.batch()
        for instance in instances {
            let docRef = db.collection("scheduledWorkouts").document()
            do {
                try batch.setData(from: instance, forDocument: docRef)
            } catch {
                completion(nil, "Error encoding workout: \(error.localizedDescription)")
                return
            }
        }

        batch.commit { error in
            if let error = error {
                completion(nil, "Error saving workouts: \(error.localizedDescription)")
            } else {
                // Add to local array
                self.scheduledWorkouts.append(contentsOf: instances)
                completion(instances, nil)
            }
        }
    }
}
