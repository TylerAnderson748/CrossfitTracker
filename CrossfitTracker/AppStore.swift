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

    func deleteScheduledWorkout(id: UUID) {
        scheduledWorkouts.removeAll { $0.id == id }
    }

    func toggleScheduledWorkout(id: UUID) {
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
        switch scheduled.workoutType {
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

    // MARK: - Admin Functions
    func findUserByEmail(email: String, completion: @escaping (AppUser?, String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("users")
            .whereField("email", isEqualTo: email)
            .limit(to: 1)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion(nil, "Error searching for user: \(error.localizedDescription)")
                    return
                }

                guard let documents = snapshot?.documents, !documents.isEmpty else {
                    completion(nil, "No user found with that email")
                    return
                }

                let doc = documents[0]
                let data = doc.data()

                let user = AppUser(
                    id: doc.documentID,
                    email: data["email"] as? String ?? email,
                    username: data["username"] as? String,
                    role: UserRole(rawValue: data["role"] as? String ?? "athlete") ?? .athlete,
                    firstName: data["firstName"] as? String,
                    lastName: data["lastName"] as? String,
                    hideFromLeaderboards: data["hideFromLeaderboards"] as? Bool ?? false
                )

                completion(user, nil)
            }
    }

    func updateUserRole(userId: String, role: UserRole, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("users").document(userId).updateData([
            "role": role.rawValue
        ]) { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }
}
