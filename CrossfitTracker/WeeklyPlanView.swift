//
//  WeeklyPlanView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

struct WeeklyPlanView: View {
    @EnvironmentObject var store: AppStore
    @State private var selectedDate = Date()
    @State private var scheduledWorkouts: [ScheduledWorkout] = []
    @State private var showDebugInfo = false

    private let daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Week selector
                HStack {
                    Button(action: { changeWeek(by: -1) }) {
                        Image(systemName: "chevron.left")
                            .font(.title2)
                    }

                    Spacer()

                    Text(weekRangeText)
                        .font(.headline)

                    Spacer()

                    Button(action: { changeWeek(by: 1) }) {
                        Image(systemName: "chevron.right")
                            .font(.title2)
                    }
                }
                .padding()
                .background(Color(.systemGray6))

                // Days of week
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(weekDates, id: \.self) { date in
                            DayWorkoutCard(
                                date: date,
                                workouts: workouts(for: date),
                                onDelete: { workout in
                                    deleteWorkout(workout)
                                }
                            )
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Weekly Plan")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showDebugInfo.toggle() }) {
                        Image(systemName: "info.circle")
                    }
                }
            }
            .sheet(isPresented: $showDebugInfo) {
                DebugInfoView()
                    .environmentObject(store)
            }
            .onAppear {
                loadScheduledWorkouts()
            }
        }
    }

    private var weekDates: [Date] {
        let calendar = Calendar.current
        // Normalize selectedDate to start of day first
        let normalizedDate = calendar.startOfDay(for: selectedDate)
        let weekday = calendar.component(.weekday, from: normalizedDate)
        let daysFromMonday = (weekday + 5) % 7

        guard let monday = calendar.date(byAdding: .day, value: -daysFromMonday, to: normalizedDate) else {
            return []
        }

        return (0..<7).compactMap { day in
            calendar.date(byAdding: .day, value: day, to: monday)
        }
    }

    private var weekRangeText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"

        guard let first = weekDates.first, let last = weekDates.last else {
            return ""
        }

        return "\(formatter.string(from: first)) - \(formatter.string(from: last))"
    }

    private func changeWeek(by weeks: Int) {
        let calendar = Calendar.current
        if let newDate = calendar.date(byAdding: .weekOfYear, value: weeks, to: selectedDate) {
            selectedDate = newDate
            loadScheduledWorkouts()
        }
    }

    private func workouts(for date: Date) -> [ScheduledWorkout] {
        let calendar = Calendar.current
        return scheduledWorkouts.filter { workout in
            calendar.isDate(workout.date, inSameDayAs: date)
        }
    }

    private func loadScheduledWorkouts() {
        guard let userId = store.currentUser?.uid else {
            print("❌ [WeeklyPlan] No user logged in")
            return
        }

        let calendar = Calendar.current
        guard let firstDay = weekDates.first,
              let lastDay = weekDates.last else {
            print("❌ [WeeklyPlan] No week dates")
            return
        }

        // Ensure we're querying from start of first day to end of last day
        let start = calendar.startOfDay(for: firstDay)
        guard let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: lastDay)) else { return }

        print("📅 [WeeklyPlan] Loading workouts from \(start) to \(end) for user \(userId)")

        // Load workouts for the current week
        store.loadScheduledWorkoutsForUser(userId: userId, startDate: start, endDate: end) { workouts, error in
            if let error = error {
                print("❌ [WeeklyPlan] Error loading scheduled workouts: \(error)")
                return
            }

            print("📥 [WeeklyPlan] Received \(workouts.count) workouts")
            for workout in workouts {
                print("   - \(workout.wodTitle): groupId=\(workout.groupId ?? "nil"), createdBy=\(workout.createdBy), date=\(workout.date)")
            }
            self.scheduledWorkouts = workouts
        }
    }

    private func deleteWorkout(_ workout: ScheduledWorkout) {
        guard let workoutId = workout.id else {
            print("❌ Cannot delete workout without ID")
            return
        }

        store.deleteScheduledWorkout(workoutId: workoutId) { error in
            if let error = error {
                print("❌ Error deleting workout: \(error)")
            } else {
                print("✅ Workout deleted")
                // Remove from local array
                self.scheduledWorkouts.removeAll { $0.id == workoutId }
            }
        }
    }
}

struct DayWorkoutCard: View {
    let date: Date
    let workouts: [ScheduledWorkout]
    let onDelete: (ScheduledWorkout) -> Void

    private var dayName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    private var dayNumber: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(dayName.uppercased())
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(dayNumber)
                        .font(.title2)
                        .bold()
                }

                if isToday {
                    Spacer()
                    Text("TODAY")
                        .font(.caption)
                        .bold()
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.blue)
                        .cornerRadius(4)
                }
            }

            Divider()

            if workouts.isEmpty {
                Text("Rest Day")
                    .foregroundColor(.secondary)
                    .italic()
                    .padding(.vertical, 8)
            } else {
                ForEach(workouts) { workout in
                    WorkoutSummaryRow(workout: workout)
                        .contextMenu {
                            Button(role: .destructive) {
                                onDelete(workout)
                            } label: {
                                Label("Delete Workout", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
        )
    }
}

struct WorkoutSummaryRow: View {
    let workout: ScheduledWorkout

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workout.wodTitle)
                .font(.headline)
            Text(workout.wodDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

struct DebugInfoView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    @State private var groups: [WorkoutGroup] = []
    @State private var allWorkouts: [ScheduledWorkout] = []

    var body: some View {
        NavigationView {
            List {
                Section("User Info") {
                    Text("User ID: \(store.currentUser?.uid ?? "Not logged in")")
                        .font(.caption)
                    Text("Email: \(store.currentUser?.email ?? "N/A")")
                        .font(.caption)
                }

                Section("Groups I'm In") {
                    if groups.isEmpty {
                        Text("Loading groups...")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(groups) { group in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(group.name)
                                    .font(.headline)
                                Text("ID: \(group.id ?? "nil")")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("Type: \(group.type.rawValue)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("Members: \(group.memberIds.count)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section("All Scheduled Workouts (This Week)") {
                    if allWorkouts.isEmpty {
                        Text("No workouts found")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(allWorkouts) { workout in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(workout.wodTitle)
                                    .font(.headline)
                                Text("Group ID: \(workout.groupId ?? "nil (personal)")")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("Created By: \(workout.createdBy)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("Date: \(workout.date, style: .date)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Debug Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadDebugInfo()
            }
        }
    }

    private func loadDebugInfo() {
        guard let userId = store.currentUser?.uid else { return }

        // Load groups
        store.loadGroupsForUser(userId: userId) { loadedGroups, error in
            if let error = error {
                print("❌ Debug: Error loading groups: \(error)")
            } else {
                self.groups = loadedGroups
                print("✅ Debug: Loaded \(loadedGroups.count) groups")
                for group in loadedGroups {
                    print("   - \(group.name) (id: \(group.id ?? "nil"))")
                }
            }
        }

        // Load all workouts for this week
        let calendar = Calendar.current
        let now = Date()
        let weekday = calendar.component(.weekday, from: now)
        let daysFromMonday = (weekday + 5) % 7
        guard let monday = calendar.date(byAdding: .day, value: -daysFromMonday, to: calendar.startOfDay(for: now)),
              let sunday = calendar.date(byAdding: .day, value: 6, to: monday),
              let endDate = calendar.date(byAdding: .day, value: 1, to: sunday) else {
            return
        }

        store.loadScheduledWorkoutsForUser(userId: userId, startDate: monday, endDate: endDate) { workouts, error in
            if let error = error {
                print("❌ Debug: Error loading workouts: \(error)")
            } else {
                self.allWorkouts = workouts
                print("✅ Debug: Loaded \(workouts.count) workouts")
                for workout in workouts {
                    print("   - \(workout.wodTitle): groupId=\(workout.groupId ?? "nil"), date=\(workout.date)")
                }
            }
        }
    }
}
