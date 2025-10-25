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
    private let db = Firestore.firestore()

    // MARK: - User info
    @Published var isLoggedIn: Bool = false
    @Published var userName: String = "Guest"
    @Published var currentUser: FirebaseAuth.User?
    @Published var userRole: UserRole = .athlete
    @Published var appUser: AppUser?

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

    @Published var liftEntries: [LiftEntry] = [] // all lift history entries

    private init() {
        // Listen for Firebase auth state changes
        Auth.auth().addStateDidChangeListener { [weak self] _, user in
            DispatchQueue.main.async {
                self?.currentUser = user
                self?.isLoggedIn = user != nil
                self?.userName = user?.email ?? "Guest"

                // Fetch user role from Firestore
                if let userId = user?.uid {
                    self?.fetchUserRole(userId: userId)
                } else {
                    self?.userRole = .athlete
                    self?.appUser = nil
                }
            }
        }
    }

    // MARK: - Firebase Authentication
    func signUp(email: String, password: String, completion: @escaping (String?) -> Void) {
        Auth.auth().createUser(withEmail: email, password: password) { [weak self] result, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion(error.localizedDescription)
                }
                return
            }

            guard let userId = result?.user.uid else {
                DispatchQueue.main.async {
                    completion("Failed to get user ID")
                }
                return
            }

            // Create user document in Firestore with athlete role by default
            let newUser = AppUser(id: userId, email: email, role: .athlete)
            self?.createUserDocument(user: newUser) { firestoreError in
                DispatchQueue.main.async {
                    if let firestoreError = firestoreError {
                        completion("Account created but profile setup failed: \(firestoreError)")
                    } else {
                        print("✅ User signed up successfully: \(email)")
                        completion(nil)
                    }
                }
            }
        }
    }

    func signIn(email: String, password: String, completion: @escaping (String?) -> Void) {
        Auth.auth().signIn(withEmail: email, password: password) { result, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ User signed in successfully: \(email)")
                    completion(nil)
                }
            }
        }
    }

    func logOut() {
        do {
            try Auth.auth().signOut()
            print("✅ User signed out successfully")
            self.activeWOD = nil
            self.wodStartTime = nil
            self.userRole = .athlete
            self.appUser = nil
        } catch {
            print("❌ Error signing out: \(error.localizedDescription)")
        }
    }

    // MARK: - Firestore User Management
    private func createUserDocument(user: AppUser, completion: @escaping (String?) -> Void) {
        guard let userId = user.id else {
            completion("No user ID provided")
            return
        }

        do {
            try db.collection("users").document(userId).setData(from: user) { error in
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ User document created in Firestore")
                    completion(nil)
                }
            }
        } catch {
            completion(error.localizedDescription)
        }
    }

    private func fetchUserRole(userId: String) {
        db.collection("users").document(userId).getDocument { [weak self] snapshot, error in
            if let error = error {
                print("❌ Error fetching user role: \(error.localizedDescription)")
                return
            }

            guard let snapshot = snapshot, snapshot.exists else {
                print("⚠️ User document doesn't exist, creating one...")
                // Create user document if it doesn't exist (for existing Firebase Auth users)
                if let email = self?.currentUser?.email {
                    let newUser = AppUser(id: userId, email: email, role: .athlete)
                    self?.createUserDocument(user: newUser) { _ in }
                }
                return
            }

            do {
                let appUser = try snapshot.data(as: AppUser.self)
                DispatchQueue.main.async {
                    self?.appUser = appUser
                    self?.userRole = appUser.role
                    self?.userName = appUser.displayName ?? appUser.email
                    print("✅ User role loaded: \(appUser.role.displayName)")
                }
            } catch {
                print("❌ Error decoding user: \(error.localizedDescription)")
            }
        }
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

    // MARK: - User Management
    func loadUser(userId: String, completion: @escaping (AppUser?, String?) -> Void) {
        db.collection("users").document(userId).getDocument { snapshot, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion(nil, error.localizedDescription)
                }
                return
            }

            guard let snapshot = snapshot, snapshot.exists else {
                DispatchQueue.main.async {
                    completion(nil, "User not found")
                }
                return
            }

            do {
                let user = try snapshot.data(as: AppUser.self)
                DispatchQueue.main.async {
                    completion(user, nil)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(nil, error.localizedDescription)
                }
            }
        }
    }

    func findUserByEmail(email: String, completion: @escaping (AppUser?, String?) -> Void) {
        db.collection("users")
            .whereField("email", isEqualTo: email)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion(nil, error.localizedDescription)
                    }
                    return
                }

                guard let document = snapshot?.documents.first else {
                    DispatchQueue.main.async {
                        completion(nil, "User with email '\(email)' not found")
                    }
                    return
                }

                do {
                    let user = try document.data(as: AppUser.self)
                    DispatchQueue.main.async {
                        completion(user, nil)
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion(nil, error.localizedDescription)
                    }
                }
            }
    }

    // MARK: - Gym Management
    func createGym(name: String, completion: @escaping (Gym?, String?) -> Void) {
        guard let userId = currentUser?.uid else {
            completion(nil, "No user logged in")
            return
        }

        let gym = Gym(name: name, ownerId: userId)

        do {
            let docRef = db.collection("gyms").document()
            var gymWithId = gym
            gymWithId.id = docRef.documentID

            try docRef.setData(from: gymWithId) { error in
                DispatchQueue.main.async {
                    if let error = error {
                        completion(nil, error.localizedDescription)
                    } else {
                        print("✅ Gym created: \(name)")
                        completion(gymWithId, nil)
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func loadGyms(completion: @escaping ([Gym], String?) -> Void) {
        guard let userId = currentUser?.uid else {
            completion([], "No user logged in")
            return
        }

        // Load gyms where user is owner
        db.collection("gyms")
            .whereField("ownerId", isEqualTo: userId)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion([], error.localizedDescription)
                    }
                    return
                }

                let gyms = snapshot?.documents.compactMap { doc -> Gym? in
                    try? doc.data(as: Gym.self)
                } ?? []

                DispatchQueue.main.async {
                    print("✅ Loaded \(gyms.count) gyms")
                    completion(gyms, nil)
                }
            }
    }

    func loadGym(gymId: String, completion: @escaping (Gym?, String?) -> Void) {
        db.collection("gyms").document(gymId).getDocument { snapshot, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion(nil, error.localizedDescription)
                }
                return
            }

            guard let snapshot = snapshot, snapshot.exists else {
                DispatchQueue.main.async {
                    completion(nil, "Gym not found")
                }
                return
            }

            do {
                let gym = try snapshot.data(as: Gym.self)
                DispatchQueue.main.async {
                    completion(gym, nil)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(nil, error.localizedDescription)
                }
            }
        }
    }

    func addUserToGym(gymId: String, userId: String, role: UserRole, completion: @escaping (String?) -> Void) {
        let fieldName = role == .coach ? "coachIds" : "memberIds"

        db.collection("gyms").document(gymId).updateData([
            fieldName: FieldValue.arrayUnion([userId])
        ]) { error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ User added to gym as \(role.displayName)")
                    completion(nil)
                }
            }
        }
    }

    // MARK: - Scheduled Workouts
    func saveScheduledWorkout(_ workout: ScheduledWorkout, completion: @escaping (ScheduledWorkout?, String?) -> Void) {
        guard currentUser?.uid != nil else {
            completion(nil, "No user logged in")
            return
        }

        do {
            if let workoutId = workout.id {
                // Update existing workout
                try db.collection("scheduledWorkouts").document(workoutId).setData(from: workout) { error in
                    DispatchQueue.main.async {
                        if let error = error {
                            completion(nil, error.localizedDescription)
                        } else {
                            print("✅ Workout updated: \(workout.wodTitle)")
                            completion(workout, nil)
                        }
                    }
                }
            } else {
                // Create new workout
                let docRef = db.collection("scheduledWorkouts").document()
                var workoutWithId = workout
                workoutWithId.id = docRef.documentID

                try docRef.setData(from: workoutWithId) { error in
                    DispatchQueue.main.async {
                        if let error = error {
                            completion(nil, error.localizedDescription)
                        } else {
                            print("✅ Workout scheduled: \(workout.wodTitle) for \(workout.date)")
                            completion(workoutWithId, nil)
                        }
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func loadScheduledWorkouts(startDate: Date, endDate: Date, gymId: String? = nil, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        var query: Query = db.collection("scheduledWorkouts")
            .whereField("date", isGreaterThanOrEqualTo: startDate)
            .whereField("date", isLessThanOrEqualTo: endDate)

        if let gymId = gymId {
            query = query.whereField("gymId", isEqualTo: gymId)
        }

        query.getDocuments { snapshot, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion([], error.localizedDescription)
                }
                return
            }

            let workouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                try? doc.data(as: ScheduledWorkout.self)
            } ?? []

            DispatchQueue.main.async {
                print("✅ Loaded \(workouts.count) scheduled workouts")
                completion(workouts, nil)
            }
        }
    }

    func loadScheduledWorkoutsForUser(userId: String, startDate: Date, endDate: Date, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        db.collection("scheduledWorkouts")
            .whereField("assignedToUserIds", arrayContains: userId)
            .whereField("date", isGreaterThanOrEqualTo: startDate)
            .whereField("date", isLessThanOrEqualTo: endDate)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion([], error.localizedDescription)
                    }
                    return
                }

                let workouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                    try? doc.data(as: ScheduledWorkout.self)
                } ?? []

                DispatchQueue.main.async {
                    print("✅ Loaded \(workouts.count) scheduled workouts for user")
                    completion(workouts, nil)
                }
            }
    }

    func deleteScheduledWorkout(workoutId: String, completion: @escaping (String?) -> Void) {
        db.collection("scheduledWorkouts").document(workoutId).delete { error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ Workout deleted")
                    completion(nil)
                }
            }
        }
    }
}
