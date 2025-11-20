//
//  CoachProgrammingView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

struct CoachProgrammingView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym

    @State private var showingAddWorkout = false
    @State private var selectedDate = Date()
    @State private var scheduledWorkouts: [ScheduledWorkout] = []

    var body: some View {
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
                                },
                                onDelete: { workout in
                                    deleteWorkout(workout)
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
                AddWorkoutSheet(gym: gym, selectedDate: selectedDate) { workout in
                    saveWorkout(workout)
                }
                .environmentObject(store)
            }
            .onAppear {
                loadScheduledWorkouts()
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
        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            return
        }

        store.loadScheduledWorkoutsForUser(userId: userId, startDate: start, endDate: end) { workouts, error in
            if let error = error {
                print("❌ Error loading scheduled workouts: \(error)")
                return
            }

            print("📥 Received \(workouts.count) workouts from Firestore")

            // Filter to only show workouts created by current user
            let filtered = workouts.filter { $0.createdBy == userId }
            print("🔍 Filtered to \(filtered.count) workouts for user \(userId)")
            self.scheduledWorkouts = filtered

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
                print("✅ Workout saved with ID: \(savedWorkout.id)")
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

    private func deleteWorkout(_ workout: ScheduledWorkout) {
        let workoutId = workout.id
        print("🗑️ Deleting workout: \(workoutId)")

        // TODO: Add Firebase deletion when implemented
        // For now, just remove from local array
        store.deleteScheduledWorkout(id: workoutId)
        self.scheduledWorkouts.removeAll { $0.id == workoutId }
        print("✅ Workout deleted")
    }
}

struct CoachDayCard: View {
    let date: Date
    let workouts: [ScheduledWorkout]
    let onAddWorkout: () -> Void
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

struct AddWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let gym: Gym
    let selectedDate: Date
    let onSave: (ScheduledWorkout) -> Void

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var date: Date
    @State private var groups: [WorkoutGroup] = []
    @State private var selectedGroupId: String?
    @State private var recurrenceType: RecurrenceType = .none
    @State private var hasEndDate: Bool = false
    @State private var recurrenceEndDate: Date
    @State private var selectedWeekdays: Set<Int> = []

    init(gym: Gym, selectedDate: Date, onSave: @escaping (ScheduledWorkout) -> Void) {
        self.gym = gym
        self.selectedDate = selectedDate
        self.onSave = onSave
        _date = State(initialValue: selectedDate)
        // Set default end date to 3 months from selected date
        _recurrenceEndDate = State(initialValue: Calendar.current.date(byAdding: .month, value: 3, to: selectedDate) ?? selectedDate)
        // Initialize with current day of week
        let weekday = Calendar.current.component(.weekday, from: selectedDate)
        _selectedWeekdays = State(initialValue: [weekday])
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
                    if groups.isEmpty {
                        Text("Loading groups...")
                            .foregroundColor(.secondary)
                    } else {
                        Picker("Assign to Group", selection: $selectedGroupId) {
                            Text("Personal (only you)").tag(nil as String?)
                            ForEach(groups) { group in
                                if let groupId = group.id {
                                    Text(group.name).tag(groupId as String?)
                                }
                            }
                        }
                    }

                    Text("Select a group to assign this workout to")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section("Recurrence") {
                    Picker("Repeat", selection: $recurrenceType) {
                        Text("Does not repeat").tag(RecurrenceType.none)
                        Text("Daily").tag(RecurrenceType.daily)
                        Text("Weekly").tag(RecurrenceType.weekly)
                        Text("Monthly").tag(RecurrenceType.monthly)
                    }

                    if recurrenceType == .weekly {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Repeat on")
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            WeekdayPicker(selectedWeekdays: $selectedWeekdays)
                        }
                    }

                    if recurrenceType != .none {
                        Toggle("Set end date", isOn: $hasEndDate)

                        if hasEndDate {
                            DatePicker("Ends on", selection: $recurrenceEndDate, in: date..., displayedComponents: .date)
                        }

                        Text(recurrenceSummary)
                            .font(.caption)
                            .foregroundColor(.secondary)
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

                        let workout = ScheduledWorkout(
                            wodId: UUID().uuidString,
                            wodTitle: title,
                            wodDescription: description,
                            date: normalizedDate,
                            groupId: selectedGroupId,
                            timeSlots: [],
                            createdBy: userId,
                            recurrenceType: recurrenceType,
                            recurrenceEndDate: hasEndDate ? recurrenceEndDate : nil,
                            weekdays: recurrenceType == .weekly ? Array(selectedWeekdays) : nil
                        )

                        if workout.isRecurring {
                            print("💾 Saving recurring workout: \(workout.wodTitle), recurrence: \(recurrenceType.rawValue)")
                            store.saveRecurringWorkout(workout) { workouts, error in
                                if let error = error {
                                    print("❌ Error saving recurring workouts: \(error)")
                                } else if let workouts = workouts {
                                    print("✅ Saved \(workouts.count) recurring workout instances")
                                    // Add all workouts to the view
                                    for savedWorkout in workouts {
                                        onSave(savedWorkout)
                                    }
                                }
                            }
                        } else {
                            print("💾 Saving workout: \(workout.wodTitle) for \(normalizedDate), groupId: \(selectedGroupId ?? "nil (personal)")")
                            onSave(workout)
                        }
                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
            }
            .onAppear {
                loadGroups()
            }
        }
    }

    private var recurrenceSummary: String {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateStyle = .medium

        switch recurrenceType {
        case .none:
            return ""
        case .once:
            return "One time on \(formatter.string(from: date))"
        case .daily:
            if hasEndDate {
                return "Repeats daily until \(formatter.string(from: recurrenceEndDate))"
            } else {
                return "Repeats daily for 1 year"
            }
        case .weekly:
            let weekdayNames = selectedWeekdays.sorted().map { weekday in
                let dayFormatter = DateFormatter()
                dayFormatter.weekdaySymbols = dayFormatter.shortWeekdaySymbols
                return dayFormatter.weekdaySymbols[weekday - 1]
            }.joined(separator: ", ")

            if hasEndDate {
                return "Repeats on \(weekdayNames) until \(formatter.string(from: recurrenceEndDate))"
            } else {
                return "Repeats on \(weekdayNames) for 1 year"
            }
        case .monthly:
            if hasEndDate {
                let months = calendar.dateComponents([.month], from: date, to: recurrenceEndDate).month ?? 0
                return "Repeats monthly for \(months) months (until \(formatter.string(from: recurrenceEndDate)))"
            } else {
                return "Repeats monthly for 1 year (12 months)"
            }
        }
    }

    private func loadGroups() {
        guard let gymId = gym.id else {
            print("❌ No gym ID")
            return
        }

        // Load groups from this specific gym
        store.loadGroupsForGym(gymId: gymId) { loadedGroups, error in
            if let error = error {
                print("❌ Error loading groups for gym: \(error)")
                return
            }

            // Filter out personal groups (they're not for programming)
            self.groups = loadedGroups.filter { $0.type != .personal }
            print("✅ Loaded \(self.groups.count) groups for programming in gym: \(self.gym.name)")
        }
    }
}

struct WeekdayPicker: View {
    @Binding var selectedWeekdays: Set<Int>

    private let weekdays: [(name: String, value: Int)] = [
        ("Sun", 1),
        ("Mon", 2),
        ("Tue", 3),
        ("Wed", 4),
        ("Thu", 5),
        ("Fri", 6),
        ("Sat", 7)
    ]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(weekdays, id: \.value) { day in
                Button(action: {
                    if selectedWeekdays.contains(day.value) {
                        selectedWeekdays.remove(day.value)
                    } else {
                        selectedWeekdays.insert(day.value)
                    }
                }) {
                    Text(day.name)
                        .font(.caption)
                        .fontWeight(selectedWeekdays.contains(day.value) ? .bold : .regular)
                        .frame(width: 40, height: 40)
                        .background(selectedWeekdays.contains(day.value) ? Color.blue : Color(.systemGray5))
                        .foregroundColor(selectedWeekdays.contains(day.value) ? .white : .primary)
                        .clipShape(Circle())
                }
            }
        }
    }
}
