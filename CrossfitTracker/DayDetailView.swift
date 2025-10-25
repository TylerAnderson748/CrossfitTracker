//
//  DayDetailView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import SwiftUI

struct DayDetailView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    let date: Date

    @State private var showingAddWorkout = false

    var body: some View {
        NavigationStack {
            List {
                if !scheduledWorkouts.isEmpty {
                    Section("Scheduled Workouts") {
                        ForEach(scheduledWorkouts) { workout in
                            ScheduledWorkoutRow(workout: workout)
                                .environmentObject(store)
                        }
                    }
                }

                if !completedWorkouts.isEmpty {
                    Section("Completed Workouts") {
                        ForEach(completedWorkouts) { workout in
                            CompletedWorkoutRow(workout: workout)
                                .environmentObject(store)
                        }
                    }
                }

                if scheduledWorkouts.isEmpty && completedWorkouts.isEmpty {
                    Section {
                        Text("No workouts for this day")
                            .foregroundColor(.gray)
                            .italic()
                    }
                }
            }
            .navigationTitle(dateText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddWorkout = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddWorkout) {
                AddWorkoutToDayView(date: date)
                    .environmentObject(store)
            }
        }
    }

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    private var scheduledWorkouts: [ScheduledWorkout] {
        store.getScheduledWorkouts(for: date)
    }

    private var completedWorkouts: [CompletedWOD] {
        store.getCompletedWorkouts(for: date)
    }
}

struct ScheduledWorkoutRow: View {
    @EnvironmentObject var store: AppStore
    let workout: ScheduledWorkout
    @State private var showingTimer = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(workoutTitle)
                        .font(.headline)

                    Text(workout.source == .coachPosted ? "Coach Posted" : "Personal")
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                Spacer()

                if workout.type == .wod {
                    Button("Start") {
                        if let wodId = workout.wodId,
                           let wod = SampleData.wods.first(where: { $0.id == wodId }) {
                            showingTimer = true
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 4)
        .sheet(isPresented: $showingTimer) {
            if let wodId = workout.wodId,
               let wod = SampleData.wods.first(where: { $0.id == wodId }) {
                WODTimerView(wod: wod)
                    .environmentObject(store)
            }
        }
    }

    private var workoutTitle: String {
        if let custom = workout.customTitle {
            return custom
        }

        if workout.type == .wod, let wodId = workout.wodId {
            if let wod = SampleData.wods.first(where: { $0.id == wodId }) {
                return wod.title
            }
        } else if workout.type == .lift, let liftId = workout.liftId {
            if let lift = store.lifts.first(where: { $0.id == liftId }) {
                return lift.name
            }
        }

        return workout.type == .wod ? "WOD" : "Lift"
    }
}

struct CompletedWorkoutRow: View {
    @EnvironmentObject var store: AppStore
    let workout: CompletedWOD
    @State private var showingEdit = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)

                VStack(alignment: .leading, spacing: 2) {
                    Text(workout.wod.title)
                        .font(.headline)

                    HStack(spacing: 8) {
                        Text(workout.time.formatTime())
                            .font(.subheadline)

                        Text("•")
                            .foregroundColor(.gray)

                        Text(workout.category.rawValue)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }

                Spacer()
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            showingEdit = true
        }
        .sheet(isPresented: $showingEdit) {
            EditWODResultView(wodResult: workout)
                .environmentObject(store)
        }
    }
}

struct AddWorkoutToDayView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    let date: Date

    @State private var selectedWOD: WOD?

    var body: some View {
        NavigationStack {
            List {
                Section("Select Workout") {
                    ForEach(SampleData.wods) { wod in
                        Button {
                            selectedWOD = wod
                            addWorkout()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(wod.title)
                                    .font(.headline)
                                    .foregroundColor(.primary)

                                Text(wod.description)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add Workout")
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

    private func addWorkout() {
        guard let wod = selectedWOD else { return }

        // Schedule the workout for this day
        store.scheduleWOD(wod, for: date, gymId: nil, groupId: nil)

        dismiss()
    }
}
