//
//  CoachProgrammingView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

struct CoachProgrammingView: View {
    @EnvironmentObject var store: AppStore
    @State private var showingAddWorkout = false
    @State private var selectedDate = Date()
    @State private var scheduledWorkouts: [ScheduledWorkout] = []

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

                // Days with workouts
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(weekDates, id: \.self) { date in
                            CoachDayCard(
                                date: date,
                                workouts: workouts(for: date),
                                onAddWorkout: {
                                    selectedDate = date
                                    showingAddWorkout = true
                                }
                            )
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Programming")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingAddWorkout = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddWorkout) {
                AddWorkoutSheet(selectedDate: selectedDate) { workout in
                    saveWorkout(workout)
                }
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
        let calendar = Calendar.current
        guard let firstDay = weekDates.first,
              let lastDay = weekDates.last else { return }

        // Ensure we're querying from start of first day to end of last day
        let start = calendar.startOfDay(for: firstDay)
        guard let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: lastDay)) else { return }

        print("📅 Loading workouts from \(start) to \(end)")

        // Load all workouts for the current week (coaches see all workouts they created)
        store.loadScheduledWorkouts(startDate: start, endDate: end) { workouts, error in
            if let error = error {
                print("❌ Error loading scheduled workouts: \(error)")
                return
            }

            print("📥 Received \(workouts.count) workouts from Firestore")

            // Filter to only show workouts created by current user
            if let userId = store.currentUser?.uid {
                let filtered = workouts.filter { $0.createdBy == userId }
                print("🔍 Filtered to \(filtered.count) workouts for user \(userId)")
                self.scheduledWorkouts = filtered
            } else {
                self.scheduledWorkouts = workouts
            }

            print("📊 Final scheduledWorkouts count: \(self.scheduledWorkouts.count)")
        }
    }

    private func saveWorkout(_ workout: ScheduledWorkout) {
        print("💾 saveWorkout called for: \(workout.wodTitle)")
        store.saveScheduledWorkout(workout) { savedWorkout, error in
            if let error = error {
                print("❌ Error saving workout: \(error)")
                return
            }

            if let savedWorkout = savedWorkout {
                print("✅ Workout saved with ID: \(savedWorkout.id ?? "nil")")
                // Add to local array if new, or update if existing
                if let index = self.scheduledWorkouts.firstIndex(where: { $0.id == savedWorkout.id }) {
                    print("📝 Updating existing workout at index \(index)")
                    self.scheduledWorkouts[index] = savedWorkout
                } else {
                    print("➕ Adding new workout to array. Current count: \(self.scheduledWorkouts.count)")
                    self.scheduledWorkouts.append(savedWorkout)
                    print("📊 New count: \(self.scheduledWorkouts.count)")
                }
            }
        }
    }
}

struct CoachDayCard: View {
    let date: Date
    let workouts: [ScheduledWorkout]
    let onAddWorkout: () -> Void

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

                Spacer()

                Button(action: onAddWorkout) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.blue)
                        .font(.title2)
                }
            }

            Divider()

            if workouts.isEmpty {
                Text("No workout assigned")
                    .foregroundColor(.secondary)
                    .italic()
                    .padding(.vertical, 8)
            } else {
                ForEach(workouts) { workout in
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
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
        )
    }
}

struct AddWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let selectedDate: Date
    let onSave: (ScheduledWorkout) -> Void

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var date: Date
    @State private var assignToSelf: Bool = false

    init(selectedDate: Date, onSave: @escaping (ScheduledWorkout) -> Void) {
        self.selectedDate = selectedDate
        self.onSave = onSave
        _date = State(initialValue: selectedDate)
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Workout Details") {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                Section("Assignment") {
                    Toggle("Assign to myself", isOn: $assignToSelf)
                    Text("Toggle this on to see the workout in your Weekly Plan")
                        .font(.caption)
                        .foregroundColor(.secondary)
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
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let userId = store.currentUser?.uid else {
                            print("❌ No user logged in")
                            dismiss()
                            return
                        }

                        // Normalize date to start of day for consistent filtering
                        let calendar = Calendar.current
                        let normalizedDate = calendar.startOfDay(for: date)

                        // Build assigned users array
                        let assignedUsers = assignToSelf ? [userId] : []

                        let workout = ScheduledWorkout(
                            wodId: UUID().uuidString,
                            wodTitle: title,
                            wodDescription: description,
                            date: normalizedDate,
                            assignedToUserIds: assignedUsers,
                            createdBy: userId
                        )

                        print("💾 Saving workout: \(workout.wodTitle) for \(normalizedDate), assigned to \(assignedUsers.count) users")
                        onSave(workout)
                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
            }
        }
    }
}
