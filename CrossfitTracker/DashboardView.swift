//
//  DashboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var store: AppStore
    @State private var upcomingWorkouts: [ScheduledWorkout] = []
    @State private var workoutLogs: [String: [WorkoutLog]] = [:] // workoutId -> logs
    @State private var gymUsers: [String: AppUser] = [:] // userId -> user
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var navigationPath = NavigationPath()

    // Group workouts by day, sorted with closest day first
    private var workoutsByDay: [(date: Date, workouts: [ScheduledWorkout])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: upcomingWorkouts) { workout in
            calendar.startOfDay(for: workout.date)
        }
        return grouped.sorted { $0.key < $1.key }.map { (date: $0.key, workouts: $0.value) }
    }

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter
    }

    private func isToday(_ date: Date) -> Bool {
        Calendar.current.isDateInToday(date)
    }

    private func isTomorrow(_ date: Date) -> Bool {
        Calendar.current.isDateInTomorrow(date)
    }

    private func dayLabel(for date: Date) -> String {
        if isToday(date) {
            return "Today"
        } else if isTomorrow(date) {
            return "Tomorrow"
        } else {
            return dateFormatter.string(from: date)
        }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 8) {
                        Text("Upcoming Workouts")
                            .font(.title.bold())
                        Text("Your scheduled workouts and group programming")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top)

                    if isLoading {
                        ProgressView()
                            .padding()
                    } else if upcomingWorkouts.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text("No upcoming workouts")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            Text("Check back later or ask your coach to add workouts!")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        .padding(.vertical, 40)
                    } else {
                        // Workouts grouped by day
                        ForEach(workoutsByDay, id: \.date) { dayGroup in
                            VStack(alignment: .leading, spacing: 12) {
                                // Day header
                                HStack {
                                    Text(dayLabel(for: dayGroup.date))
                                        .font(.headline)
                                        .foregroundColor(isToday(dayGroup.date) ? .blue : .primary)

                                    if isToday(dayGroup.date) {
                                        Text("TODAY")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2)
                                            .background(Color.blue)
                                            .cornerRadius(4)
                                    }

                                    Spacer()
                                }
                                .padding(.horizontal)

                                // Workouts for this day
                                ForEach(dayGroup.workouts) { workout in
                                    WorkoutCard(
                                        workout: workout,
                                        logs: workoutLogs[workout.id ?? ""] ?? [],
                                        gymUsers: gymUsers,
                                        navigationPath: $navigationPath
                                    )
                                    .padding(.horizontal)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Dashboard")
            .navigationDestination(for: WODDestination.self) { destination in
                switch destination {
                case .timer(let wod):
                    WODTimerView(wod: wod)
                case .liftEntry(let wod):
                    LiftEntryView(lift: wod)
                case .leaderboard(let wod):
                    LeaderboardView(wod: wod)
                }
            }
            .onAppear {
                loadUpcomingWorkouts()
            }
            .refreshable {
                loadUpcomingWorkouts()
            }
        }
    }

    private func loadUpcomingWorkouts() {
        isLoading = true

        guard let userId = store.currentUser?.uid else {
            errorMessage = "User not logged in"
            isLoading = false
            return
        }

        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        let endDate = calendar.date(byAdding: .day, value: 7, to: startOfToday)!

        store.loadScheduledWorkoutsForUser(userId: userId, startDate: startOfToday, endDate: endDate) { workouts, error in
            if let error = error {
                errorMessage = error
                isLoading = false
                return
            }

            // Sort by date (closest first)
            upcomingWorkouts = workouts.sorted { $0.date < $1.date }

            // Load logs for each workout
            for workout in workouts {
                loadLogsForWorkout(workout)
            }

            isLoading = false
        }
    }

    private func loadLogsForWorkout(_ workout: ScheduledWorkout) {
        store.loadGymMemberLogs(for: workout, limit: 5) { logs, users, error in
            if let error = error {
                print("❌ Error loading logs: \(error)")
                return
            }

            // Store logs for this workout
            workoutLogs[workout.id ?? ""] = logs

            // Store user info
            for user in users {
                if let userId = user.id {
                    gymUsers[userId] = user
                }
            }
        }
    }
}

// MARK: - Workout Card Component

struct WorkoutCard: View {
    @EnvironmentObject var store: AppStore
    @State var workout: ScheduledWorkout
    let logs: [WorkoutLog]
    let gymUsers: [String: AppUser]
    @Binding var navigationPath: NavigationPath

    @State private var showTimeSlotPicker = false
    @State private var showSignUpError = false
    @State private var signUpErrorMessage = ""

    private var currentUserId: String? {
        store.currentUser?.uid
    }

    private var userSignedUpSlot: TimeSlot? {
        guard let userId = currentUserId else { return nil }
        return workout.timeSlots.first { $0.signedUpUserIds.contains(userId) }
    }

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }

    // Check if current user is a coach/owner who can see hidden details
    private var canSeeHiddenDetails: Bool {
        guard let userId = currentUserId else { return false }
        // Creator can always see
        if workout.createdBy == userId { return true }
        // Check if user is a coach for any of the groups
        for groupId in workout.groupIds {
            if let group = store.groups.first(where: { $0.id == groupId }) {
                if group.coachIds.contains(userId) || group.ownerId == userId {
                    return true
                }
            }
        }
        return false
    }

    // Whether to show workout details (name/description)
    private var shouldShowDetails: Bool {
        if !workout.hideDetails { return true }
        if canSeeHiddenDetails { return true }
        return workout.shouldRevealDetails
    }

    private var revealDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Workout Header
            VStack(alignment: .leading, spacing: 8) {
                Text(shouldShowDetails ? workout.wodTitle : "Workout")
                    .font(.title2.bold())
                if shouldShowDetails {
                    Text(workout.wodDescription)
                        .font(.body)
                        .foregroundColor(.secondary)
                } else {
                    HStack {
                        Image(systemName: "eye.slash")
                            .foregroundColor(.secondary)
                        if let revealDate = workout.revealDate {
                            Text("Details revealed \(revealDateFormatter.string(from: revealDate))")
                                .font(.body)
                                .foregroundColor(.secondary)
                        } else {
                            Text("Workout details hidden")
                                .font(.body)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            // Time slot sign-up for group workouts
            if !workout.isPersonalWorkout && !workout.timeSlots.isEmpty {
                HStack {
                    if let signedUpSlot = userSignedUpSlot {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Signed up for \(timeFormatter.string(from: signedUpSlot.startTime))")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }

                        Spacer()

                        Button(action: {
                            cancelSignUp(signedUpSlot)
                        }) {
                            Text("Cancel")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                    } else {
                        Text("\(workout.timeSlots.count) class time\(workout.timeSlots.count == 1 ? "" : "s") available")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Spacer()

                        Button(action: {
                            showTimeSlotPicker = true
                        }) {
                            Label("Sign Up", systemImage: "calendar.badge.plus")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.blue)
                    }
                }
                .padding(.vertical, 4)
            }

            // Action Buttons
            HStack(spacing: 12) {
                Button(action: {
                    // Create WOD from ScheduledWorkout for timer
                    let wod = WOD(
                        title: workout.wodTitle,
                        description: workout.wodDescription,
                        type: .wod
                    )
                    navigationPath.append(WODDestination.timer(wod))
                }) {
                    Label("Start Timer", systemImage: "timer")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

                Button(action: {
                    let wod = WOD(
                        title: workout.wodTitle,
                        description: workout.wodDescription,
                        type: .wod
                    )
                    navigationPath.append(WODDestination.leaderboard(wod))
                }) {
                    Label("Leaderboard", systemImage: "list.number")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            // Community Results Feed
            if !logs.isEmpty {
                Divider()

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "person.2.fill")
                            .foregroundColor(.blue)
                        Text("Recent Results")
                            .font(.headline)
                    }

                    Text("\(logs.count) member\(logs.count == 1 ? "" : "s") completed this workout")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack(spacing: 12) {
                    ForEach(logs.prefix(5)) { log in
                        ResultRow(log: log, user: gymUsers[log.userId])
                    }
                }
            } else {
                Divider()
                HStack {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                    Text("Be the first to complete this workout!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 5, x: 0, y: 2)
        .alert("Sign-up Error", isPresented: $showSignUpError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(signUpErrorMessage)
        }
        .sheet(isPresented: $showTimeSlotPicker) {
            DashboardTimeSlotPickerSheet(
                workout: workout,
                timeFormatter: timeFormatter,
                onSelectSlot: { slot in
                    signUpForSlot(slot)
                }
            )
        }
    }

    private func signUpForSlot(_ slot: TimeSlot) {
        guard let workoutId = workout.id,
              let userId = currentUserId else { return }

        store.signUpForTimeSlot(workoutId: workoutId, timeSlotId: slot.id, userId: userId) { updatedWorkout, error in
            if let error = error {
                signUpErrorMessage = error
                showSignUpError = true
            } else if let updatedWorkout = updatedWorkout {
                self.workout = updatedWorkout
            }
        }
    }

    private func cancelSignUp(_ slot: TimeSlot) {
        guard let workoutId = workout.id,
              let userId = currentUserId else { return }

        store.cancelTimeSlotSignUp(workoutId: workoutId, timeSlotId: slot.id, userId: userId) { updatedWorkout, error in
            if let error = error {
                signUpErrorMessage = error
                showSignUpError = true
            } else if let updatedWorkout = updatedWorkout {
                self.workout = updatedWorkout
            }
        }
    }
}

// MARK: - Dashboard Time Slot Picker

struct DashboardTimeSlotPickerSheet: View {
    @Environment(\.dismiss) var dismiss
    let workout: ScheduledWorkout
    let timeFormatter: DateFormatter
    let onSelectSlot: (TimeSlot) -> Void

    var body: some View {
        NavigationView {
            List {
                Section {
                    Text(workout.wodTitle)
                        .font(.headline)
                    Text(workout.wodDescription)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Section("Select a Class Time") {
                    ForEach(workout.timeSlots) { slot in
                        Button(action: {
                            onSelectSlot(slot)
                            dismiss()
                        }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(timeFormatter.string(from: slot.startTime))
                                        .font(.headline)
                                        .foregroundColor(.primary)

                                    if slot.capacity > 0 {
                                        Text("\(slot.spotsRemaining) spots remaining")
                                            .font(.caption)
                                            .foregroundColor(slot.isFull ? .red : .secondary)
                                    } else {
                                        Text("\(slot.signedUpUserIds.count) signed up")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }

                                Spacer()

                                if slot.isFull {
                                    Text("Full")
                                        .font(.caption)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.red)
                                        .cornerRadius(6)
                                } else {
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .disabled(slot.isFull)
                    }
                }
            }
            .navigationTitle("Sign Up for Class")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Result Row Component

struct ResultRow: View {
    let log: WorkoutLog
    let user: AppUser?

    var body: some View {
        HStack(spacing: 12) {
            // User Avatar
            Image(systemName: "person.circle.fill")
                .font(.title2)
                .foregroundColor(.blue)

            // User Info & Result
            VStack(alignment: .leading, spacing: 2) {
                Text(user?.fullName.isEmpty == false ? user!.fullName : user?.email ?? "Unknown User")
                    .font(.subheadline.bold())

                HStack(spacing: 4) {
                    Text(log.resultSummary)
                        .font(.caption)
                        .foregroundColor(.primary)

                    if log.isPersonalRecord {
                        Image(systemName: "crown.fill")
                            .font(.caption)
                            .foregroundColor(.yellow)
                    }
                }
            }

            Spacer()

            // Time ago
            Text(timeAgo(from: log.completedDate))
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        let hours = Int(interval / 3600)
        let minutes = Int(interval / 60)

        if hours > 24 {
            let days = hours / 24
            return "\(days)d ago"
        } else if hours > 0 {
            return "\(hours)h ago"
        } else if minutes > 0 {
            return "\(minutes)m ago"
        } else {
            return "Just now"
        }
    }
}

// Navigation destination enum
enum WODDestination: Hashable {
    case timer(WOD)
    case liftEntry(WOD)
    case leaderboard(WOD)
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
            .environmentObject(AppStore.shared)
    }
}
