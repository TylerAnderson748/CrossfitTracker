//
//  LeaderboardView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/14/25.
//

import SwiftUI

struct LeaderboardView: View {
    @EnvironmentObject var store: AppStore
    let wod: WOD?
    @State private var selectedWorkout: String?
    @State private var leaderboards: [String: [LeaderboardEntry]] = [:]
    @State private var specificWorkoutEntries: [LeaderboardEntry] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    init(wod: WOD? = nil) {
        self.wod = wod
    }

    var body: some View {
        Group {
            if let wod = wod {
                // Show leaderboard for specific workout
                WorkoutLeaderboardDetailView(
                    workoutName: wod.title,
                    entries: specificWorkoutEntries,
                    isLoading: isLoading
                )
            } else {
                // Show all leaderboards
                leaderboardList
            }
        }
        .onAppear {
            if let wod = wod {
                // Load leaderboard for specific workout
                loadSpecificWorkoutLeaderboard(wod: wod)
            } else if leaderboards.isEmpty {
                // Load all leaderboards
                loadLeaderboards()
            }
        }
    }

    private var leaderboardList: some View {
        NavigationView {
            VStack {
                if isLoading {
                    ProgressView("Loading leaderboards...")
                        .padding()
                } else if let errorMessage = errorMessage {
                    VStack {
                        Text("Error")
                            .font(.headline)
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Retry") {
                            loadLeaderboards()
                        }
                    }
                } else if leaderboards.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "chart.bar.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text("No Leaderboards Yet")
                            .font(.title2)
                            .foregroundColor(.gray)
                        Text("Complete workouts to see leaderboards")
                            .font(.body)
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                } else {
                    List {
                        ForEach(Array(leaderboards.keys.sorted()), id: \.self) { workoutName in
                            if let entries = leaderboards[workoutName], let firstEntry = entries.first {
                                NavigationLink(destination: WorkoutLeaderboardDetailView(
                                    workoutName: firstEntry.originalWorkoutName,
                                    entries: entries
                                )) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(firstEntry.originalWorkoutName)
                                            .font(.headline)
                                        Text("\(entries.count) \(entries.count == 1 ? "entry" : "entries")")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Leaderboards")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadLeaderboards) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }

    private func loadLeaderboards() {
        isLoading = true
        errorMessage = nil

        store.fetchAllLeaderboards { loadedLeaderboards, error in
            isLoading = false
            if let error = error {
                errorMessage = error
            } else {
                leaderboards = loadedLeaderboards
            }
        }
    }

    private func loadSpecificWorkoutLeaderboard(wod: WOD) {
        isLoading = true
        errorMessage = nil

        store.fetchLeaderboardForWorkout(workoutName: wod.title) { entries, error in
            isLoading = false
            if let error = error {
                errorMessage = error
                specificWorkoutEntries = []
            } else {
                specificWorkoutEntries = entries
            }
        }
    }
}

struct WorkoutLeaderboardDetailView: View {
    @EnvironmentObject var store: AppStore
    let workoutName: String
    let entries: [LeaderboardEntry]
    var isLoading: Bool = false
    @State private var genderFilter: GenderFilter = .all
    @State private var gymFilter: GymFilter = .everyone

    enum GenderFilter {
        case all
        case male
        case female
    }

    enum GymFilter {
        case gym
        case everyone
    }

    var filteredEntries: [LeaderboardEntry] {
        var filtered = entries

        // Filter by gender
        switch genderFilter {
        case .all:
            break // no filter
        case .male:
            filtered = filtered.filter { $0.userGender == "Male" }
        case .female:
            filtered = filtered.filter { $0.userGender == "Female" }
        }

        // Filter by gym membership
        switch gymFilter {
        case .everyone:
            break // no filter
        case .gym:
            // Only show users who have a gym
            filtered = filtered.filter { $0.gymName != nil }
        }

        return filtered
    }

    var sortedEntries: [LeaderboardEntry] {
        filteredEntries.sorted { entry1, entry2 in
            // Sort by result type
            switch entry1.resultType {
            case .time:
                // For time-based workouts, lower is better
                if let time1 = entry1.timeInSeconds, let time2 = entry2.timeInSeconds {
                    return time1 < time2
                }
                return false
            case .rounds:
                // For rounds, higher is better
                if let rounds1 = entry1.rounds, let rounds2 = entry2.rounds {
                    if rounds1 != rounds2 {
                        return rounds1 > rounds2
                    }
                    // If rounds are equal, compare reps
                    return (entry1.reps ?? 0) > (entry2.reps ?? 0)
                }
                return false
            case .weight:
                // For weight, higher is better
                if let weight1 = entry1.weight, let weight2 = entry2.weight {
                    return weight1 > weight2
                }
                return false
            case .reps:
                // For reps, higher is better
                if let reps1 = entry1.reps, let reps2 = entry2.reps {
                    return reps1 > reps2
                }
                return false
            case .other:
                // For other types, sort by date
                return entry1.completedDate > entry2.completedDate
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Gym/Everyone filter
            Picker("Scope", selection: $gymFilter) {
                Text("Gym").tag(GymFilter.gym)
                Text("Everyone").tag(GymFilter.everyone)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top)

            // Gender filter
            Picker("Gender", selection: $genderFilter) {
                Text("All").tag(GenderFilter.all)
                Text("Male").tag(GenderFilter.male)
                Text("Female").tag(GenderFilter.female)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.bottom)

            if isLoading {
                Spacer()
                ProgressView("Loading leaderboard...")
                Spacer()
            } else if sortedEntries.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.gray)
                    Text("No Entries Yet")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Be the first to complete this workout!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
            } else {
                List {
                    ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                        HStack(spacing: 12) {
                            // Rank badge
                            ZStack {
                                if index < 3 {
                                    Circle()
                                        .fill(rankColor(for: index))
                                        .frame(width: 40, height: 40)
                                } else {
                                    Circle()
                                        .stroke(Color.gray, lineWidth: 2)
                                        .frame(width: 40, height: 40)
                                }

                                Text("\(index + 1)")
                                    .font(.headline)
                                    .foregroundColor(index < 3 ? .white : .primary)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 4) {
                                    Text(entry.userName)
                                        .font(.headline)

                                    if let gymName = entry.gymName {
                                        Text("(\(gymName))")
                                            .font(.caption)
                                            .foregroundColor(.blue)
                                    }
                                }

                                HStack {
                                    Text(entry.resultSummary)
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)

                                    if entry.userId == store.currentUser?.uid {
                                        Text("(You)")
                                            .font(.caption)
                                            .foregroundColor(.blue)
                                    }
                                }

                                Text(formatDate(entry.completedDate))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle(workoutName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func rankColor(for index: Int) -> Color {
        switch index {
        case 0: return Color(red: 1.0, green: 0.84, blue: 0.0) // Gold
        case 1: return Color(red: 0.75, green: 0.75, blue: 0.75) // Silver
        case 2: return Color(red: 0.8, green: 0.5, blue: 0.2) // Bronze
        default: return Color.gray
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct LeaderboardView_Previews: PreviewProvider {
    static var previews: some View {
        LeaderboardView()
            .environmentObject(AppStore.shared)
    }
}
