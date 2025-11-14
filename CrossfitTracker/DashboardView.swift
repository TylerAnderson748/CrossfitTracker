//
//  DashboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var store: AppStore
    @State private var todaysWorkouts: [ScheduledWorkout] = []
    @State private var workoutLogs: [String: [WorkoutLog]] = [:] // workoutId -> logs
    @State private var gymUsers: [String: AppUser] = [:] // userId -> user
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 8) {
                        Text("Today's Workouts")
                            .font(.title.bold())
                        Text("Your scheduled workouts and group programming")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top)

                    if isLoading {
                        ProgressView()
                            .padding()
                    } else if todaysWorkouts.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text("No workouts scheduled for today")
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
                        // Today's Workouts
                        ForEach(todaysWorkouts) { workout in
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
            .navigationTitle("Dashboard")
            .navigationDestination(for: WODDestination.self) { destination in
                switch destination {
                case .timer(let wod):
                    WODTimerView(wod: wod)
                case .leaderboard(let wod):
                    LeaderboardView(wod: wod)
                }
            }
            .onAppear {
                loadTodaysWorkouts()
            }
            .refreshable {
                loadTodaysWorkouts()
            }
        }
    }

    private func loadTodaysWorkouts() {
        isLoading = true
        store.loadTodaysWorkouts { workouts, error in
            if let error = error {
                errorMessage = error
                isLoading = false
                return
            }

            todaysWorkouts = workouts

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
    let workout: ScheduledWorkout
    let logs: [WorkoutLog]
    let gymUsers: [String: AppUser]
    @Binding var navigationPath: NavigationPath

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Workout Header
            VStack(alignment: .leading, spacing: 8) {
                Text(workout.wodTitle)
                    .font(.title2.bold())
                Text(workout.wodDescription)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            // Action Buttons
            HStack(spacing: 12) {
                Button(action: {
                    // Create WOD from ScheduledWorkout for timer
                    let wod = WOD(
                        title: workout.wodTitle,
                        description: workout.wodDescription
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
                        description: workout.wodDescription
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
    case leaderboard(WOD)
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
            .environmentObject(AppStore.shared)
    }
}
