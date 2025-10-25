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
        static let currentUser = "currentUser"
        static let users = "users"
        static let gyms = "gyms"
        static let programmingGroups = "programmingGroups"
        static let gymMemberships = "gymMemberships"
        static let scheduledWorkouts = "scheduledWorkouts"
        static let gymJoinRequests = "gymJoinRequests"
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

    // MARK: - User & Gym Management
    @Published var currentUser: User? = nil {
        didSet {
            if !isLoading { saveCurrentUser() }
        }
    }

    @Published var users: [User] = [] {
        didSet {
            if !isLoading { saveUsers() }
        }
    }

    @Published var gyms: [Gym] = [] {
        didSet {
            if !isLoading { saveGyms() }
        }
    }

    @Published var programmingGroups: [ProgrammingGroup] = [] {
        didSet {
            if !isLoading { saveProgrammingGroups() }
        }
    }

    @Published var gymMemberships: [GymMembership] = [] {
        didSet {
            if !isLoading { saveGymMemberships() }
        }
    }

    @Published var scheduledWorkouts: [ScheduledWorkout] = [] {
        didSet {
            if !isLoading { saveScheduledWorkouts() }
        }
    }

    @Published var gymJoinRequests: [GymJoinRequest] = [] {
        didSet {
            if !isLoading { saveGymJoinRequests() }
        }
    }

    private init() {
        isLoading = true
        loadUserInfo()
        loadCompletedWODs()
        loadLifts()
        loadLiftEntries()
        loadCurrentUser()
        loadUsers()
        loadGyms()
        loadProgrammingGroups()
        loadGymMemberships()
        loadScheduledWorkouts()
        loadGymJoinRequests()
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
        self.currentUser = nil
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

    // MARK: - User Management
    func createUser(name: String, email: String, role: UserRole) -> User {
        let user = User(name: name, email: email, role: role)
        users.append(user)
        return user
    }

    func setCurrentUser(_ user: User) {
        currentUser = user
        userName = user.name
        isLoggedIn = true
    }

    // MARK: - Gym Management
    func createGym(name: String) -> Gym {
        guard let user = currentUser else { fatalError("Must have current user to create gym") }
        let gym = Gym(name: name, ownerUserId: user.id)
        gyms.append(gym)

        // Create default programming groups for this gym
        let normalGroup = ProgrammingGroup(name: "Normal", gymId: gym.id)
        let compGroup = ProgrammingGroup(name: "Comp", gymId: gym.id)
        programmingGroups.append(normalGroup)
        programmingGroups.append(compGroup)

        // Update gym with group IDs
        if let idx = gyms.firstIndex(where: { $0.id == gym.id }) {
            gyms[idx].groupIds = [normalGroup.id, compGroup.id]
        }

        return gym
    }

    func getGym(byId id: UUID) -> Gym? {
        gyms.first(where: { $0.id == id })
    }

    func getGroups(for gym: Gym) -> [ProgrammingGroup] {
        programmingGroups.filter { gym.groupIds.contains($0.id) }
    }

    func getGroup(byId id: UUID) -> ProgrammingGroup? {
        programmingGroups.first(where: { $0.id == id })
    }

    func createProgrammingGroup(name: String, gymId: UUID) -> ProgrammingGroup? {
        guard let user = currentUser else { return nil }

        // Verify user owns the gym
        guard let gym = gyms.first(where: { $0.id == gymId && $0.ownerUserId == user.id }) else {
            return nil
        }

        let group = ProgrammingGroup(name: name, gymId: gymId)
        programmingGroups.append(group)

        // Add group to gym
        if let idx = gyms.firstIndex(where: { $0.id == gymId }) {
            gyms[idx].groupIds.append(group.id)
        }

        return group
    }

    func getAvailableGyms() -> [Gym] {
        // Return all gyms that the user is not already a member of
        guard let user = currentUser else { return [] }
        let userGymIds = gymMemberships.filter { $0.userId == user.id }.map { $0.gymId }
        return gyms.filter { !userGymIds.contains($0.id) && $0.ownerUserId != user.id }
    }

    // MARK: - Join Request Management
    func requestToJoinGym(_ gym: Gym) {
        guard let user = currentUser else { return }

        // Check if already a member or already requested
        if gymMemberships.contains(where: { $0.userId == user.id && $0.gymId == gym.id }) {
            return
        }

        if gymJoinRequests.contains(where: { $0.userId == user.id && $0.gymId == gym.id && $0.status == .pending }) {
            return
        }

        let request = GymJoinRequest(userId: user.id, gymId: gym.id)
        gymJoinRequests.append(request)
    }

    func getPendingRequests(for gym: Gym) -> [GymJoinRequest] {
        gymJoinRequests.filter { $0.gymId == gym.id && $0.status == .pending }
    }

    func approveJoinRequest(_ request: GymJoinRequest) {
        guard let idx = gymJoinRequests.firstIndex(where: { $0.id == request.id }) else { return }
        guard let user = currentUser else { return }
        guard let gym = gyms.first(where: { $0.id == request.gymId && $0.ownerUserId == user.id }) else { return }

        // Update request status
        gymJoinRequests[idx].status = .approved
        gymJoinRequests[idx].respondedAt = Date()

        // Get the Normal group for this gym
        let normalGroup = programmingGroups.first(where: { $0.gymId == gym.id && $0.name == "Normal" })
        let groupIds = normalGroup != nil ? [normalGroup!.id] : []

        // Create membership with Normal group
        let membership = GymMembership(userId: request.userId, gymId: request.gymId, groupIds: groupIds)
        gymMemberships.append(membership)

        // Add user to Normal group
        if let normalGroup = normalGroup,
           let groupIdx = programmingGroups.firstIndex(where: { $0.id == normalGroup.id }) {
            if !programmingGroups[groupIdx].memberIds.contains(request.userId) {
                programmingGroups[groupIdx].memberIds.append(request.userId)
            }
        }
    }

    func denyJoinRequest(_ request: GymJoinRequest) {
        guard let idx = gymJoinRequests.firstIndex(where: { $0.id == request.id }) else { return }
        gymJoinRequests[idx].status = .denied
        gymJoinRequests[idx].respondedAt = Date()
    }

    func getUser(byId id: UUID) -> User? {
        users.first(where: { $0.id == id })
    }

    // MARK: - Membership Management
    func joinGym(_ gym: Gym, groupIds: [UUID] = []) {
        guard let user = currentUser else { return }

        // Check if already a member
        if gymMemberships.contains(where: { $0.userId == user.id && $0.gymId == gym.id }) {
            return
        }

        let membership = GymMembership(userId: user.id, gymId: gym.id, groupIds: groupIds)
        gymMemberships.append(membership)

        // Add user to programming groups
        for groupId in groupIds {
            if let idx = programmingGroups.firstIndex(where: { $0.id == groupId }) {
                if !programmingGroups[idx].memberIds.contains(user.id) {
                    programmingGroups[idx].memberIds.append(user.id)
                }
            }
        }
    }

    func addUserToGroup(userId: UUID, groupId: UUID) {
        // Find the membership
        guard let membershipIdx = gymMemberships.firstIndex(where: { $0.userId == userId }),
              let groupIdx = programmingGroups.firstIndex(where: { $0.id == groupId }) else {
            return
        }

        // Add group to membership
        if !gymMemberships[membershipIdx].groupIds.contains(groupId) {
            gymMemberships[membershipIdx].groupIds.append(groupId)
        }

        // Add user to group
        if !programmingGroups[groupIdx].memberIds.contains(userId) {
            programmingGroups[groupIdx].memberIds.append(userId)
        }
    }

    func getUserGyms() -> [Gym] {
        guard let user = currentUser else { return [] }
        let userGymIds = gymMemberships.filter { $0.userId == user.id }.map { $0.gymId }
        return gyms.filter { userGymIds.contains($0.id) }
    }

    func getUserGroups(in gym: Gym) -> [ProgrammingGroup] {
        guard let user = currentUser else { return [] }
        guard let membership = gymMemberships.first(where: { $0.userId == user.id && $0.gymId == gym.id }) else {
            return []
        }
        return programmingGroups.filter { membership.groupIds.contains($0.id) }
    }

    // MARK: - Workout Scheduling
    func scheduleWOD(_ wod: WOD, for date: Date, gymId: UUID? = nil, groupId: UUID? = nil) {
        guard let user = currentUser else { return }

        let source: WorkoutSource = gymId != nil ? .coachPosted : .personal
        let scheduled = ScheduledWorkout(
            type: .wod,
            wodId: wod.id,
            date: date,
            source: source,
            createdByUserId: user.id,
            gymId: gymId,
            groupId: groupId
        )
        scheduledWorkouts.append(scheduled)
    }

    func scheduleLift(_ lift: Lift, for date: Date, gymId: UUID? = nil, groupId: UUID? = nil) {
        guard let user = currentUser else { return }

        let source: WorkoutSource = gymId != nil ? .coachPosted : .personal
        let scheduled = ScheduledWorkout(
            type: .lift,
            liftId: lift.id,
            date: date,
            source: source,
            createdByUserId: user.id,
            gymId: gymId,
            groupId: groupId
        )
        scheduledWorkouts.append(scheduled)
    }

    func deleteScheduledWorkout(_ workout: ScheduledWorkout) {
        scheduledWorkouts.removeAll { $0.id == workout.id }
    }

    // MARK: - Workout Queries
    func getScheduledWorkouts(for date: Date) -> [ScheduledWorkout] {
        guard let user = currentUser else { return [] }

        return scheduledWorkouts.filter { workout in
            // Check if scheduled for this date
            guard workout.isScheduledFor(date: date) else { return false }

            // Include personal workouts
            if workout.source == .personal && workout.createdByUserId == user.id {
                return true
            }

            // Include coach-posted workouts from user's gyms/groups
            if workout.source == .coachPosted {
                if let gymId = workout.gymId {
                    // Check if user owns this gym (coaches can see their own programmed workouts)
                    if gyms.contains(where: { $0.id == gymId && $0.ownerUserId == user.id }) {
                        return true
                    }

                    // Check if user is a member of this gym
                    guard gymMemberships.contains(where: { $0.userId == user.id && $0.gymId == gymId }) else {
                        return false
                    }

                    // If it's for a specific group, check if user is in that group
                    if let groupId = workout.groupId {
                        return programmingGroups.contains(where: { $0.id == groupId && $0.memberIds.contains(user.id) })
                    }

                    return true
                }
            }

            return false
        }.sorted { $0.date < $1.date }
    }

    func getCompletedWorkouts(for date: Date) -> [CompletedWOD] {
        completedWODs.filter { Calendar.current.isDate($0.date, inSameDayAs: date) }
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

    private func saveCurrentUser() {
        if let encoded = try? JSONEncoder().encode(currentUser) {
            UserDefaults.standard.set(encoded, forKey: Keys.currentUser)
        }
    }

    private func loadCurrentUser() {
        if let data = UserDefaults.standard.data(forKey: Keys.currentUser),
           let decoded = try? JSONDecoder().decode(User.self, from: data) {
            currentUser = decoded
        }
    }

    private func saveUsers() {
        if let encoded = try? JSONEncoder().encode(users) {
            UserDefaults.standard.set(encoded, forKey: Keys.users)
        }
    }

    private func loadUsers() {
        if let data = UserDefaults.standard.data(forKey: Keys.users),
           let decoded = try? JSONDecoder().decode([User].self, from: data) {
            users = decoded
        }
    }

    private func saveGyms() {
        if let encoded = try? JSONEncoder().encode(gyms) {
            UserDefaults.standard.set(encoded, forKey: Keys.gyms)
        }
    }

    private func loadGyms() {
        if let data = UserDefaults.standard.data(forKey: Keys.gyms),
           let decoded = try? JSONDecoder().decode([Gym].self, from: data) {
            gyms = decoded
        }
    }

    private func saveProgrammingGroups() {
        if let encoded = try? JSONEncoder().encode(programmingGroups) {
            UserDefaults.standard.set(encoded, forKey: Keys.programmingGroups)
        }
    }

    private func loadProgrammingGroups() {
        if let data = UserDefaults.standard.data(forKey: Keys.programmingGroups),
           let decoded = try? JSONDecoder().decode([ProgrammingGroup].self, from: data) {
            programmingGroups = decoded
        }
    }

    private func saveGymMemberships() {
        if let encoded = try? JSONEncoder().encode(gymMemberships) {
            UserDefaults.standard.set(encoded, forKey: Keys.gymMemberships)
        }
    }

    private func loadGymMemberships() {
        if let data = UserDefaults.standard.data(forKey: Keys.gymMemberships),
           let decoded = try? JSONDecoder().decode([GymMembership].self, from: data) {
            gymMemberships = decoded
        }
    }

    private func saveScheduledWorkouts() {
        if let encoded = try? JSONEncoder().encode(scheduledWorkouts) {
            UserDefaults.standard.set(encoded, forKey: Keys.scheduledWorkouts)
        }
    }

    private func loadScheduledWorkouts() {
        if let data = UserDefaults.standard.data(forKey: Keys.scheduledWorkouts),
           let decoded = try? JSONDecoder().decode([ScheduledWorkout].self, from: data) {
            scheduledWorkouts = decoded
        }
    }

    private func saveGymJoinRequests() {
        if let encoded = try? JSONEncoder().encode(gymJoinRequests) {
            UserDefaults.standard.set(encoded, forKey: Keys.gymJoinRequests)
        }
    }

    private func loadGymJoinRequests() {
        if let data = UserDefaults.standard.data(forKey: Keys.gymJoinRequests),
           let decoded = try? JSONDecoder().decode([GymJoinRequest].self, from: data) {
            gymJoinRequests = decoded
        }
    }
}
