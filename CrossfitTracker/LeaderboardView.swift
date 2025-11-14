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
                    entries: leaderboards[wod.title] ?? []
                )
            } else {
                // Show all leaderboards
                leaderboardList
            }
        }
        .onAppear {
            if leaderboards.isEmpty {
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
}

struct WorkoutLeaderboardDetailView: View {
    @EnvironmentObject var store: AppStore
    let workoutName: String
    let entries: [LeaderboardEntry]

    var sortedEntries: [LeaderboardEntry] {
        entries.sorted { entry1, entry2 in
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
                        Text(entry.userName)
                            .font(.headline)

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
