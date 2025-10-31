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
    func signUp(email: String, password: String, firstName: String, lastName: String, completion: @escaping (String?) -> Void) {
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
            let newUser = AppUser(id: userId, email: email, role: .athlete, firstName: firstName, lastName: lastName)
            self?.createUserDocument(user: newUser) { firestoreError in
                if let firestoreError = firestoreError {
                    DispatchQueue.main.async {
                        completion("Account created but profile setup failed: \(firestoreError)")
                    }
                    return
                }

                print("✅ User signed up successfully: \(email)")

                // Create personal group for user
                self?.createPersonalGroup(userId: userId) { personalGroup, groupError in
                    if let groupError = groupError {
                        print("⚠️ Error creating personal group: \(groupError)")
                    } else {
                        print("✅ Personal group created for user")
                    }

                    // Return success even if personal group creation failed
                    DispatchQueue.main.async {
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

            try docRef.setData(from: gymWithId) { [weak self] error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion(nil, error.localizedDescription)
                    }
                    return
                }

                print("✅ Gym created: \(name)")

                // Create default groups for the gym
                guard let gymId = gymWithId.id else {
                    DispatchQueue.main.async {
                        completion(gymWithId, "Gym created but no ID returned")
                    }
                    return
                }

                self?.createDefaultGroupsForGym(gymId: gymId, ownerId: userId) { groupError in
                    if let groupError = groupError {
                        print("⚠️ Error creating default groups: \(groupError)")
                    } else {
                        print("✅ Default groups created for gym")
                    }

                    // Return gym even if group creation failed
                    DispatchQueue.main.async {
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

                // Auto-fix: Add owner to Members group if not already there
                for gym in gyms {
                    guard let gymId = gym.id else { continue }
                    self.ensureOwnerInMembersGroup(gymId: gymId, ownerId: userId)
                }

                DispatchQueue.main.async {
                    print("✅ Loaded \(gyms.count) gyms")
                    completion(gyms, nil)
                }
            }
    }

    // Helper function to ensure owner is in the Members group
    private func ensureOwnerInMembersGroup(gymId: String, ownerId: String) {
        db.collection("groups")
            .whereField("gymId", isEqualTo: gymId)
            .whereField("name", isEqualTo: "Members")
            .getDocuments { snapshot, error in
                guard let doc = snapshot?.documents.first,
                      let group = try? doc.data(as: WorkoutGroup.self),
                      let groupId = group.id else {
                    return
                }

                // Check if owner is already in the group
                if group.memberIds.contains(ownerId) {
                    print("✅ Owner already in Members group for gym")
                    return
                }

                // Add owner to the group
                self.addUserToGroup(groupId: groupId, userId: ownerId) { error in
                    if let error = error {
                        print("❌ Error adding owner to Members group: \(error)")
                    } else {
                        print("✅ Auto-fixed: Added owner to Members group")
                    }
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

                    // Auto-add user to auto-assign groups
                    if role == .athlete {
                        self.addUserToAutoAssignGroups(gymId: gymId, userId: userId)
                    }

                    completion(nil)
                }
            }
        }
    }

    func deleteGym(gymId: String, completion: @escaping (String?) -> Void) {
        // Delete all groups associated with this gym first
        db.collection("groups")
            .whereField("gymId", isEqualTo: gymId)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion(error.localizedDescription)
                    }
                    return
                }

                // Delete all groups
                let batch = self.db.batch()
                snapshot?.documents.forEach { doc in
                    batch.deleteDocument(doc.reference)
                }

                batch.commit { error in
                    if let error = error {
                        DispatchQueue.main.async {
                            completion(error.localizedDescription)
                        }
                        return
                    }

                    // Now delete the gym itself
                    self.db.collection("gyms").document(gymId).delete { error in
                        DispatchQueue.main.async {
                            if let error = error {
                                completion(error.localizedDescription)
                            } else {
                                print("✅ Gym and associated groups deleted")
                                completion(nil)
                            }
                        }
                    }
                }
            }
    }

    // MARK: - Group Management
    func createGroup(_ group: WorkoutGroup, completion: @escaping (WorkoutGroup?, String?) -> Void) {
        do {
            let docRef = db.collection("groups").document()
            var groupWithId = group
            groupWithId.id = docRef.documentID

            try docRef.setData(from: groupWithId) { error in
                DispatchQueue.main.async {
                    if let error = error {
                        completion(nil, error.localizedDescription)
                    } else {
                        print("✅ Group created: \(group.name)")

                        // If auto-assign, add all gym members to this group
                        if groupWithId.membershipType == .autoAssignAll, let gymId = groupWithId.gymId {
                            self.autoAssignGymMembersToGroup(gymId: gymId, groupId: docRef.documentID)
                        }

                        completion(groupWithId, nil)
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func createDefaultGroupsForGym(gymId: String, ownerId: String, completion: @escaping (String?) -> Void) {
        // Create 3 default groups: Members (undeletable), Competition Athletes, Weight Training Athletes
        // Owner is automatically added to Members group so they can see programming they create
        let defaultGroups = [
            WorkoutGroup(
                gymId: gymId,
                name: "Members",
                type: .defaultGroup,
                membershipType: .autoAssignAll,
                memberIds: [ownerId], // Add owner to Members group
                ownerId: ownerId,
                isDeletable: false
            ),
            WorkoutGroup(
                gymId: gymId,
                name: "Competition Athletes",
                type: .defaultGroup,
                membershipType: .inviteOnly,
                ownerId: ownerId
            ),
            WorkoutGroup(
                gymId: gymId,
                name: "Weight Training Athletes",
                type: .defaultGroup,
                membershipType: .inviteOnly,
                ownerId: ownerId
            )
        ]

        var createdCount = 0
        var lastError: String?

        for group in defaultGroups {
            createGroup(group) { _, error in
                if let error = error {
                    lastError = error
                }
                createdCount += 1

                if createdCount == defaultGroups.count {
                    DispatchQueue.main.async {
                        completion(lastError)
                    }
                }
            }
        }
    }

    func createPersonalGroup(userId: String, completion: @escaping (WorkoutGroup?, String?) -> Void) {
        let personalGroup = WorkoutGroup(
            gymId: nil,
            name: "Personal",
            type: .personal,
            membershipType: .inviteOnly,
            memberIds: [userId],
            ownerId: userId,
            isDeletable: false
        )

        createGroup(personalGroup, completion: completion)
    }

    func loadGroupsForGym(gymId: String, completion: @escaping ([WorkoutGroup], String?) -> Void) {
        db.collection("groups")
            .whereField("gymId", isEqualTo: gymId)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion([], error.localizedDescription)
                    }
                    return
                }

                let groups = snapshot?.documents.compactMap { doc -> WorkoutGroup? in
                    try? doc.data(as: WorkoutGroup.self)
                } ?? []

                DispatchQueue.main.async {
                    print("✅ Loaded \(groups.count) groups for gym")
                    completion(groups, nil)
                }
            }
    }

    func loadGroupsForUser(userId: String, completion: @escaping ([WorkoutGroup], String?) -> Void) {
        db.collection("groups")
            .whereField("memberIds", arrayContains: userId)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion([], error.localizedDescription)
                    }
                    return
                }

                let groups = snapshot?.documents.compactMap { doc -> WorkoutGroup? in
                    try? doc.data(as: WorkoutGroup.self)
                } ?? []

                DispatchQueue.main.async {
                    print("✅ Loaded \(groups.count) groups for user")
                    completion(groups, nil)
                }
            }
    }

    func addUserToGroup(groupId: String, userId: String, completion: @escaping (String?) -> Void) {
        db.collection("groups").document(groupId).updateData([
            "memberIds": FieldValue.arrayUnion([userId])
        ]) { error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ User added to group")
                    completion(nil)
                }
            }
        }
    }

    func removeUserFromGroup(groupId: String, userId: String, completion: @escaping (String?) -> Void) {
        db.collection("groups").document(groupId).updateData([
            "memberIds": FieldValue.arrayRemove([userId])
        ]) { error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(error.localizedDescription)
                } else {
                    print("✅ User removed from group")
                    completion(nil)
                }
            }
        }
    }

    func deleteGroup(groupId: String, completion: @escaping (String?) -> Void) {
        // First check if it's deletable
        db.collection("groups").document(groupId).getDocument { snapshot, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion(error.localizedDescription)
                }
                return
            }

            guard let group = try? snapshot?.data(as: WorkoutGroup.self) else {
                DispatchQueue.main.async {
                    completion("Group not found")
                }
                return
            }

            if !group.isDeletable {
                DispatchQueue.main.async {
                    completion("This group cannot be deleted")
                }
                return
            }

            // Delete the group
            self.db.collection("groups").document(groupId).delete { error in
                DispatchQueue.main.async {
                    if let error = error {
                        completion(error.localizedDescription)
                    } else {
                        print("✅ Group deleted")
                        completion(nil)
                    }
                }
            }
        }
    }

    // Helper function to add all gym members to a group
    private func autoAssignGymMembersToGroup(gymId: String, groupId: String) {
        loadGym(gymId: gymId) { gym, error in
            if let error = error {
                print("❌ Error loading gym for auto-assign: \(error)")
                return
            }

            guard let gym = gym else {
                print("❌ Gym not found for auto-assign")
                return
            }

            // Add all members to the group
            let batch = self.db.batch()
            let groupRef = self.db.collection("groups").document(groupId)

            for memberId in gym.memberIds {
                batch.updateData(["memberIds": FieldValue.arrayUnion([memberId])], forDocument: groupRef)
            }

            batch.commit { error in
                if let error = error {
                    print("❌ Error auto-assigning members to group: \(error.localizedDescription)")
                } else {
                    print("✅ Auto-assigned \(gym.memberIds.count) members to group")
                }
            }
        }
    }

    // Helper function to add a user to all auto-assign groups in a gym
    private func addUserToAutoAssignGroups(gymId: String, userId: String) {
        loadGroupsForGym(gymId: gymId) { groups, error in
            if let error = error {
                print("❌ Error loading groups for auto-assign: \(error)")
                return
            }

            let autoAssignGroups = groups.filter { $0.membershipType == .autoAssignAll }

            for group in autoAssignGroups {
                guard let groupId = group.id else { continue }

                self.addUserToGroup(groupId: groupId, userId: userId) { error in
                    if let error = error {
                        print("❌ Error adding user to auto-assign group: \(error)")
                    } else {
                        print("✅ Auto-assigned user to group: \(group.name)")
                    }
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

    // Save recurring workout - creates multiple instances
    func saveRecurringWorkout(_ baseWorkout: ScheduledWorkout, completion: @escaping ([ScheduledWorkout], String?) -> Void) {
        guard currentUser?.uid != nil else {
            completion([], "No user logged in")
            return
        }

        guard baseWorkout.isRecurring else {
            // Not recurring, just save single workout
            saveScheduledWorkout(baseWorkout) { workout, error in
                if let error = error {
                    completion([], error)
                } else if let workout = workout {
                    completion([workout], nil)
                } else {
                    completion([], nil)
                }
            }
            return
        }

        // Generate recurring workout instances
        let seriesId = UUID().uuidString
        let calendar = Calendar.current
        var workoutDates: [Date] = []
        var currentDate = baseWorkout.date

        // Determine end date (default to 1 year if no end date specified)
        let endDate = baseWorkout.recurrenceEndDate ?? calendar.date(byAdding: .year, value: 1, to: currentDate)!

        // Generate dates based on recurrence type
        switch baseWorkout.recurrenceType {
        case .daily:
            while currentDate <= endDate {
                workoutDates.append(currentDate)
                guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else { break }
                currentDate = nextDate

                if workoutDates.count >= 365 {
                    print("⚠️ Reached maximum of 365 recurring instances")
                    break
                }
            }

        case .weekly:
            // For weekly recurrence with specific weekdays
            let selectedWeekdays = baseWorkout.weekdays ?? [calendar.component(.weekday, from: currentDate)]

            while currentDate <= endDate {
                let weekday = calendar.component(.weekday, from: currentDate)

                // Check if this day is one of the selected weekdays
                if selectedWeekdays.contains(weekday) {
                    workoutDates.append(currentDate)
                }

                // Move to next day
                guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else { break }
                currentDate = nextDate

                if workoutDates.count >= 365 {
                    print("⚠️ Reached maximum of 365 recurring instances")
                    break
                }
            }

        case .monthly:
            while currentDate <= endDate {
                workoutDates.append(currentDate)
                guard let nextDate = calendar.date(byAdding: .month, value: 1, to: currentDate) else { break }
                currentDate = nextDate

                if workoutDates.count >= 365 {
                    print("⚠️ Reached maximum of 365 recurring instances")
                    break
                }
            }

        case .none:
            workoutDates.append(currentDate)
        }

        print("📅 Creating \(workoutDates.count) recurring workout instances")

        // Create workout instances
        var createdWorkouts: [ScheduledWorkout] = []
        var completedCount = 0

        for date in workoutDates {
            var workout = baseWorkout
            workout.id = nil // Clear ID so new one is generated
            workout.date = date
            workout.seriesId = seriesId

            saveScheduledWorkout(workout) { savedWorkout, error in
                if let error = error {
                    print("❌ Error saving recurring workout instance: \(error)")
                } else if let savedWorkout = savedWorkout {
                    createdWorkouts.append(savedWorkout)
                }

                completedCount += 1
                if completedCount == workoutDates.count {
                    DispatchQueue.main.async {
                        print("✅ Created \(createdWorkouts.count) recurring workout instances")
                        completion(createdWorkouts, nil)
                    }
                }
            }
        }

        // Handle case where no dates were generated
        if workoutDates.isEmpty {
            completion([], "No valid dates for recurrence")
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
        var allWorkouts: [ScheduledWorkout] = []
        var queriesCompleted = 0
        let totalQueries = 2 // 1 for personal workouts, 1+ for group workouts

        // Query 1: Load personal workouts (groupId == nil, createdBy == userId)
        db.collection("scheduledWorkouts")
            .whereField("createdBy", isEqualTo: userId)
            .whereField("date", isGreaterThanOrEqualTo: startDate)
            .whereField("date", isLessThanOrEqualTo: endDate)
            .getDocuments { snapshot, error in
                if let error = error {
                    print("❌ Error loading personal workouts: \(error.localizedDescription)")
                } else {
                    let personalWorkouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                        guard let workout = try? doc.data(as: ScheduledWorkout.self) else { return nil }
                        // Only include workouts with nil groupId (personal workouts)
                        return workout.groupId == nil ? workout : nil
                    } ?? []
                    allWorkouts.append(contentsOf: personalWorkouts)
                    print("✅ Loaded \(personalWorkouts.count) personal workouts")
                }

                queriesCompleted += 1
                if queriesCompleted == totalQueries {
                    DispatchQueue.main.async {
                        print("✅ Total workouts loaded: \(allWorkouts.count)")
                        completion(allWorkouts, nil)
                    }
                }
            }

        // Query 2: Load group workouts
        loadGroupsForUser(userId: userId) { groups, error in
            if let error = error {
                print("❌ Error loading groups: \(error)")
                queriesCompleted += 1
                if queriesCompleted == totalQueries {
                    DispatchQueue.main.async {
                        completion(allWorkouts, nil)
                    }
                }
                return
            }

            let groupIds = groups.compactMap { $0.id }

            if groupIds.isEmpty {
                print("⚠️ User not in any groups")
                queriesCompleted += 1
                if queriesCompleted == totalQueries {
                    DispatchQueue.main.async {
                        print("✅ Total workouts loaded: \(allWorkouts.count)")
                        completion(allWorkouts, nil)
                    }
                }
                return
            }

            print("📋 Loading workouts from \(groups.count) groups")

            // Load all workouts for user's groups within date range
            // Note: Firestore 'in' query supports max 10 items
            let batchSize = 10
            var processedBatches = 0
            let totalBatches = (groupIds.count + batchSize - 1) / batchSize

            for batchIndex in 0..<totalBatches {
                let start = batchIndex * batchSize
                let end = min(start + batchSize, groupIds.count)
                let batchGroupIds = Array(groupIds[start..<end])

                self.db.collection("scheduledWorkouts")
                    .whereField("groupId", in: batchGroupIds)
                    .whereField("date", isGreaterThanOrEqualTo: startDate)
                    .whereField("date", isLessThanOrEqualTo: endDate)
                    .getDocuments { snapshot, error in
                        if let error = error {
                            print("❌ Error loading workouts batch: \(error.localizedDescription)")
                        } else {
                            let batchWorkouts = snapshot?.documents.compactMap { doc -> ScheduledWorkout? in
                                try? doc.data(as: ScheduledWorkout.self)
                            } ?? []
                            allWorkouts.append(contentsOf: batchWorkouts)
                            print("✅ Loaded \(batchWorkouts.count) workouts from batch \(batchIndex + 1)")
                        }

                        processedBatches += 1

                        if processedBatches == totalBatches {
                            queriesCompleted += 1
                            if queriesCompleted == totalQueries {
                                DispatchQueue.main.async {
                                    print("✅ Total workouts loaded: \(allWorkouts.count) (\(groups.count) groups)")
                                    completion(allWorkouts, nil)
                                }
                            }
                        }
                    }
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

    // MARK: - Workout Logs
    func saveWorkoutLog(_ log: WorkoutLog, completion: @escaping (WorkoutLog?, String?) -> Void) {
        guard currentUser?.uid != nil else {
            completion(nil, "No user logged in")
            return
        }

        do {
            let docRef = db.collection("workoutLogs").document()
            var logWithId = log
            logWithId.id = docRef.documentID

            try docRef.setData(from: logWithId) { error in
                DispatchQueue.main.async {
                    if let error = error {
                        completion(nil, error.localizedDescription)
                    } else {
                        print("✅ Workout logged: \(log.wodTitle)")
                        completion(logWithId, nil)
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func loadWorkoutLogs(userId: String, limit: Int? = nil, completion: @escaping ([WorkoutLog], String?) -> Void) {
        var query: Query = db.collection("workoutLogs")
            .whereField("userId", isEqualTo: userId)
            .order(by: "completedDate", descending: true)

        if let limit = limit {
            query = query.limit(to: limit)
        }

        query.getDocuments { snapshot, error in
            if let error = error {
                DispatchQueue.main.async {
                    completion([], error.localizedDescription)
                }
                return
            }

            let logs = snapshot?.documents.compactMap { doc -> WorkoutLog? in
                try? doc.data(as: WorkoutLog.self)
            } ?? []

            DispatchQueue.main.async {
                print("✅ Loaded \(logs.count) workout logs")
                completion(logs, nil)
            }
        }
    }

    func loadWorkoutLogsForWorkout(userId: String, wodTitle: String, completion: @escaping ([WorkoutLog], String?) -> Void) {
        db.collection("workoutLogs")
            .whereField("userId", isEqualTo: userId)
            .whereField("wodTitle", isEqualTo: wodTitle)
            .order(by: "completedDate", descending: true)
            .getDocuments { snapshot, error in
                if let error = error {
                    DispatchQueue.main.async {
                        completion([], error.localizedDescription)
                    }
                    return
                }

                let logs = snapshot?.documents.compactMap { doc -> WorkoutLog? in
                    try? doc.data(as: WorkoutLog.self)
                } ?? []

                DispatchQueue.main.async {
                    print("✅ Loaded \(logs.count) logs for \(wodTitle)")
                    completion(logs, nil)
                }
            }
    }

    // Check if this result is a PR for this workout
    func checkIfPR(userId: String, wodTitle: String, resultType: WorkoutResultType, value: Double, completion: @escaping (Bool) -> Void) {
        loadWorkoutLogsForWorkout(userId: userId, wodTitle: wodTitle) { logs, error in
            guard error == nil else {
                completion(false)
                return
            }

            let previousBest: Double?
            switch resultType {
            case .time:
                // Lower is better for time
                previousBest = logs.compactMap { $0.timeInSeconds }.min()
                completion(previousBest == nil || value < previousBest!)
            case .rounds:
                // Higher is better for rounds
                previousBest = logs.compactMap { $0.rounds }.map { Double($0) }.max()
                completion(previousBest == nil || value > previousBest!)
            case .weight:
                // Higher is better for weight
                previousBest = logs.compactMap { $0.weight }.max()
                completion(previousBest == nil || value > previousBest!)
            case .reps:
                // Higher is better for reps
                previousBest = logs.compactMap { $0.reps }.map { Double($0) }.max()
                completion(previousBest == nil || value > previousBest!)
            case .other:
                completion(false)
            }
        }
    }
}
