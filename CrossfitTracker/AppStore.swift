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

    // MARK: - Scheduled Workout Management
    func loadScheduledWorkouts(groupId: String?, userId: String, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        let db = Firestore.firestore()
        var query: Query = db.collection("scheduledWorkouts")

        if let groupId = groupId {
            query = query.whereField("groupId", isEqualTo: groupId)
        } else {
            // Load personal workouts for this user
            query = query.whereField("createdBy", isEqualTo: userId)
                         .whereField("groupId", isEqualTo: NSNull())
        }

        query.getDocuments { snapshot, error in
            if let error = error {
                completion([], "Error loading workouts: \(error.localizedDescription)")
                return
            }

            let workouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                try? doc.data(as: ScheduledWorkout.self)
            } ?? []

            completion(workouts, nil)
        }
    }

    // Overload for date-based loading (for CoachProgrammingView)
    func loadScheduledWorkouts(startDate: Date, endDate: Date, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("scheduledWorkouts")
            .whereField("date", isGreaterThanOrEqualTo: startDate)
            .whereField("date", isLessThan: endDate)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion([], error.localizedDescription)
                    return
                }

                let workouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                    try? doc.data(as: ScheduledWorkout.self)
                } ?? []

                completion(workouts, nil)
            }
    }

    // For WeeklyPlanView - user-specific date-based loading
    func loadScheduledWorkoutsForUser(userId: String, startDate: Date, endDate: Date, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("scheduledWorkouts")
            .whereField("date", isGreaterThanOrEqualTo: startDate)
            .whereField("date", isLessThan: endDate)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion([], error.localizedDescription)
                    return
                }

                var workouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                    try? doc.data(as: ScheduledWorkout.self)
                } ?? []

                // Filter to personal workouts for this user or group workouts they're in
                workouts = workouts.filter { workout in
                    // Personal workout created by user
                    if workout.isPersonalWorkout && workout.createdBy == userId {
                        return true
                    }
                    // Group workout - would need to check if user is in group
                    // For now, include all non-personal workouts
                    if !workout.isPersonalWorkout {
                        return true
                    }
                    return false
                }

                completion(workouts, nil)
            }
    }

    func saveScheduledWorkout(_ workout: ScheduledWorkout, completion: @escaping (ScheduledWorkout?, String?) -> Void) {
        let db = Firestore.firestore()

        do {
            if let id = workout.id {
                // Update existing workout
                try db.collection("scheduledWorkouts").document(id).setData(from: workout, merge: true) { error in
                    if let error = error {
                        completion(nil, error.localizedDescription)
                    } else {
                        completion(workout, nil)
                    }
                }
            } else {
                // Create new workout
                var newWorkout = workout
                let docRef = db.collection("scheduledWorkouts").document()
                newWorkout.id = docRef.documentID
                try docRef.setData(from: newWorkout) { error in
                    if let error = error {
                        completion(nil, error.localizedDescription)
                    } else {
                        completion(newWorkout, nil)
                    }
                }
            }
        } catch {
            completion(nil, error.localizedDescription)
        }
    }

    func deleteScheduledWorkout(workoutId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("scheduledWorkouts").document(workoutId).delete { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    func saveRecurringWorkout(_ workout: ScheduledWorkout, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        // For recurring workouts, we create multiple ScheduledWorkout entries
        var workoutsToSave: [ScheduledWorkout] = []
        let calendar = Calendar.current

        guard let endDate = workout.recurrenceEndDate else {
            // If no end date, just save the single workout
            saveScheduledWorkout(workout) { saved, error in
                if let error = error {
                    completion([], error)
                } else if let saved = saved {
                    completion([saved], nil)
                } else {
                    completion([], nil)
                }
            }
            return
        }

        var currentDate = workout.date
        while currentDate <= endDate {
            // Check if this date matches the recurrence pattern
            var shouldInclude = false

            switch workout.recurrenceType {
            case .daily:
                shouldInclude = true
            case .weekly:
                if let weekdays = workout.weekdays {
                    let weekday = calendar.component(.weekday, from: currentDate)
                    shouldInclude = weekdays.contains(weekday)
                }
            case .once:
                shouldInclude = calendar.isDate(currentDate, inSameDayAs: workout.date)
            default:
                break
            }

            if shouldInclude {
                var workoutCopy = workout
                workoutCopy.id = nil // Generate new ID for each instance
                workoutCopy.date = currentDate
                workoutsToSave.append(workoutCopy)
            }

            // Move to next day
            guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else {
                break
            }
            currentDate = nextDate
        }

        // Save all workouts
        let group = DispatchGroup()
        var savedWorkouts: [ScheduledWorkout] = []
        var saveError: String?

        for workout in workoutsToSave {
            group.enter()
            saveScheduledWorkout(workout) { saved, error in
                if let error = error {
                    saveError = error
                } else if let saved = saved {
                    savedWorkouts.append(saved)
                }
                group.leave()
            }
        }

        group.notify(queue: .main) {
            completion(savedWorkouts, saveError)
        }
    }

    // MARK: - Gym Management
    func loadGyms(forUserId userId: String, completion: @escaping ([Gym], String?) -> Void) {
        let db = Firestore.firestore()

        // Load gyms where user is owner, coach, or member
        db.collection("gyms")
            .whereField("memberIds", arrayContains: userId)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion([], error.localizedDescription)
                    return
                }

                let gyms = snapshot?.documents.compactMap { doc -> Gym? in
                    try? doc.data(as: Gym.self)
                } ?? []

                completion(gyms, nil)
            }
    }

    func loadGym(gymId: String, completion: @escaping (Gym?, String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("gyms").document(gymId).getDocument { snapshot, error in
            if let error = error {
                completion(nil, error.localizedDescription)
                return
            }

            guard let snapshot = snapshot, snapshot.exists else {
                completion(nil, "Gym not found")
                return
            }

            let gym = try? snapshot.data(as: Gym.self)
            completion(gym, nil)
        }
    }

    func createGym(name: String, ownerId: String, completion: @escaping (Gym?, String?) -> Void) {
        let db = Firestore.firestore()
        let gym = Gym(name: name, ownerId: ownerId)

        do {
            let docRef = db.collection("gyms").document()
            var newGym = gym
            newGym.id = docRef.documentID
            newGym.memberIds = [ownerId] // Owner is automatically a member

            try docRef.setData(from: newGym) { error in
                if let error = error {
                    completion(nil, error.localizedDescription)
                } else {
                    completion(newGym, nil)
                }
            }
        } catch {
            completion(nil, error.localizedDescription)
        }
    }

    func deleteGym(gymId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("gyms").document(gymId).delete { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    func addUserToGym(gymId: String, userId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("gyms").document(gymId).updateData([
            "memberIds": FieldValue.arrayUnion([userId])
        ]) { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    // MARK: - Group Management
    func loadGroupsForGym(gymId: String, completion: @escaping ([WorkoutGroup], String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("groups")
            .whereField("gymId", isEqualTo: gymId)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion([], error.localizedDescription)
                    return
                }

                let groups = snapshot?.documents.compactMap { doc -> WorkoutGroup? in
                    try? doc.data(as: WorkoutGroup.self)
                } ?? []

                completion(groups, nil)
            }
    }

    func loadGroupsForUser(userId: String, completion: @escaping ([WorkoutGroup], String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("groups")
            .whereField("memberIds", arrayContains: userId)
            .getDocuments { snapshot, error in
                if let error = error {
                    completion([], error.localizedDescription)
                    return
                }

                let groups = snapshot?.documents.compactMap { doc -> WorkoutGroup? in
                    try? doc.data(as: WorkoutGroup.self)
                } ?? []

                completion(groups, nil)
            }
    }

    func createGroup(_ group: WorkoutGroup, completion: @escaping (WorkoutGroup?, String?) -> Void) {
        let db = Firestore.firestore()

        do {
            let docRef = db.collection("groups").document()
            var newGroup = group
            newGroup.id = docRef.documentID

            try docRef.setData(from: newGroup) { error in
                if let error = error {
                    completion(nil, error.localizedDescription)
                } else {
                    completion(newGroup, nil)
                }
            }
        } catch {
            completion(nil, error.localizedDescription)
        }
    }

    func deleteGroup(groupId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("groups").document(groupId).delete { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    func addUserToGroup(groupId: String, userId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("groups").document(groupId).updateData([
            "memberIds": FieldValue.arrayUnion([userId])
        ]) { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    func removeUserFromGroup(groupId: String, userId: String, completion: @escaping (String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("groups").document(groupId).updateData([
            "memberIds": FieldValue.arrayRemove([userId])
        ]) { error in
            if let error = error {
                completion(error.localizedDescription)
            } else {
                completion(nil)
            }
        }
    }

    // MARK: - User Loading
    func loadUser(userId: String, completion: @escaping (AppUser?, String?) -> Void) {
        let db = Firestore.firestore()

        db.collection("users").document(userId).getDocument { snapshot, error in
            if let error = error {
                completion(nil, error.localizedDescription)
                return
            }

            guard let snapshot = snapshot, snapshot.exists else {
                completion(nil, "User not found")
                return
            }

            let user = try? snapshot.data(as: AppUser.self)
            completion(user, nil)
        }
    }
}
