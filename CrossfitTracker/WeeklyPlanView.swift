//
//  WeeklyPlanView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import SwiftUI

struct WeeklyPlanView: View {
    @EnvironmentObject var store: AppStore
    @State private var selectedDate = Date()
    @State private var weekDates: [Date] = []

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Week selector
                weekSelectorView

                Divider()

                // Days list
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(weekDates, id: \.self) { date in
                            DayRow(date: date)
                                .environmentObject(store)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Weekly Plan")
            .onAppear {
                updateWeekDates()
            }
        }
    }

    private var weekSelectorView: some View {
        HStack {
            Button {
                selectedDate = Calendar.current.date(byAdding: .weekOfYear, value: -1, to: selectedDate) ?? selectedDate
                updateWeekDates()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.title2)
            }

            Spacer()

            Text(weekRangeText)
                .font(.headline)

            Spacer()

            Button {
                selectedDate = Calendar.current.date(byAdding: .weekOfYear, value: 1, to: selectedDate) ?? selectedDate
                updateWeekDates()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.title2)
            }
        }
        .padding()
    }

    private var weekRangeText: String {
        guard let firstDay = weekDates.first, let lastDay = weekDates.last else {
            return ""
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return "\(formatter.string(from: firstDay)) - \(formatter.string(from: lastDay))"
    }

    private func updateWeekDates() {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: selectedDate)
        // Calendar weekday: 1=Sunday, 2=Monday, 3=Tuesday, etc.
        // For Monday-based week, calculate days back to Monday
        let daysFromMonday = (weekday + 5) % 7 // 0 for Monday, 1 for Tuesday, ..., 6 for Sunday

        guard let monday = calendar.date(byAdding: .day, value: -daysFromMonday, to: selectedDate) else {
            return
        }

        weekDates = (0..<7).compactMap { dayOffset in
            calendar.date(byAdding: .day, value: dayOffset, to: monday)
        }
    }
}

struct DayRow: View {
    @EnvironmentObject var store: AppStore
    let date: Date
    @State private var showingDayDetail = false

    var body: some View {
        Button {
            showingDayDetail = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dayOfWeekText)
                            .font(.headline)
                            .foregroundColor(isToday ? .blue : .primary)

                        Text(dayNumberText)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }

                    Spacer()

                    if completedCount > 0 {
                        Text("\(completedCount) completed")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }

                if !scheduledWorkouts.isEmpty || !completedWorkouts.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(scheduledWorkouts.prefix(3)) { workout in
                            WorkoutPreviewRow(workout: workout, isScheduled: true)
                        }

                        ForEach(completedWorkouts.prefix(3)) { workout in
                            CompletedWorkoutPreviewRow(workout: workout)
                        }

                        if scheduledWorkouts.count + completedWorkouts.count > 6 {
                            Text("+\(scheduledWorkouts.count + completedWorkouts.count - 6) more")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                } else {
                    Text("No workouts scheduled")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .italic()
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingDayDetail) {
            DayDetailView(date: date)
                .environmentObject(store)
        }
    }

    private var dayOfWeekText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private var dayNumberText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }

    private var scheduledWorkouts: [ScheduledWorkout] {
        store.getScheduledWorkouts(for: date)
    }

    private var completedWorkouts: [CompletedWOD] {
        store.getCompletedWorkouts(for: date)
    }

    private var completedCount: Int {
        completedWorkouts.count
    }
}

struct WorkoutPreviewRow: View {
    let workout: ScheduledWorkout
    let isScheduled: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: workout.source == .coachPosted ? "person.2.fill" : "person.fill")
                .font(.caption)
                .foregroundColor(workout.source == .coachPosted ? .blue : .green)

            Text(workoutTitle)
                .font(.caption)
                .lineLimit(1)

            Spacer()
        }
    }

    private var workoutTitle: String {
        if let custom = workout.customTitle {
            return custom
        }
        // We'll need to look up the actual WOD/Lift name in a real implementation
        return workout.type == .wod ? "WOD" : "Lift"
    }
}

struct CompletedWorkoutPreviewRow: View {
    let workout: CompletedWOD

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .font(.caption)
                .foregroundColor(.green)

            Text(workout.wod.title)
                .font(.caption)
                .lineLimit(1)

            Spacer()

            Text(workout.time.formatTime())
                .font(.caption)
                .foregroundColor(.gray)
        }
    }
}
