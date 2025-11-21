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
    @State private var showAddWorkout = false
    @State private var addWorkoutDate = Date()
    @State private var navigationPath = NavigationPath()
    @State private var showEditWorkout = false
    @State private var workoutToEdit: ScheduledWorkout?

    private let daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        NavigationStack(path: $navigationPath) {
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
                                },
                                onDeleteSeries: { workout in
                                    deleteWorkoutSeries(workout)
                                },
                                onEdit: { workout in
                                    editWorkout(workout)
                                },
                                onLogWorkout: { workout in
                                    // Navigate to appropriate logging view based on workout type
                                    print("📱 [WeeklyPlan] Navigating to log workout:")
                                    print("   - Title: '\(workout.wodTitle)'")
                                    print("   - Type: '\(workout.workoutType.rawValue)'")
                                    print("   - Description: '\(workout.wodDescription)'")
                                    print("   - Date: \(workout.date)")

                                    let wod = WOD(
                                        title: workout.wodTitle,
                                        description: workout.wodDescription,
                                        type: workout.workoutType
                                    )

                                    // Route to lift entry or WOD timer based on type
                                    if workout.workoutType == .lift {
                                        print("   - Navigating to LiftEntryView")
                                        navigationPath.append(WODDestination.liftEntry(wod))
                                    } else {
                                        print("   - Navigating to WODTimerView")
                                        navigationPath.append(WODDestination.timer(wod))
                                    }
                                }
                            )
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Weekly Plan")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        addWorkoutDate = Date()
                        showAddWorkout = true
                    }) {
                        Image(systemName: "plus")
                    }
                }
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
            .sheet(isPresented: $showAddWorkout) {
                AddPersonalWorkoutSheet(selectedDate: addWorkoutDate) { workout in
                    savePersonalWorkout(workout)
                }
                .environmentObject(store)
            }
            .sheet(isPresented: $showEditWorkout) {
                if let workout = workoutToEdit {
                    EditPersonalWorkoutSheet(workout: workout) { updatedWorkout in
                        updatePersonalWorkout(updatedWorkout)
                    }
                    .environmentObject(store)
                }
            }
            .navigationDestination(for: WODDestination.self) { destination in
                switch destination {
                case .timer(let wod):
                    WODTimerView(wod: wod)
                        .environmentObject(store)
                case .liftEntry(let wod):
                    LiftEntryView(lift: wod)
                        .environmentObject(store)
                case .leaderboard(let wod):
                    LeaderboardView(wod: wod)
                        .environmentObject(store)
                }
            }
            .onAppear {
                loadScheduledWorkouts()
                loadUserGroups()
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

    private func loadUserGroups() {
        guard let userId = store.currentUser?.uid else {
            print("❌ [WeeklyPlan] No user logged in")
            return
        }

        print("📥 [WeeklyPlan] Loading groups for user \(userId)")
        store.loadGroupsForUser(userId: userId) { groups, error in
            if let error = error {
                print("❌ [WeeklyPlan] Error loading groups: \(error)")
            } else {
                print("✅ [WeeklyPlan] Loaded \(groups.count) groups")
            }
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

    private func deleteWorkoutSeries(_ workout: ScheduledWorkout) {
        guard let seriesId = workout.seriesId else {
            print("❌ Cannot delete series - no seriesId")
            // If no seriesId, just delete the single workout
            deleteWorkout(workout)
            return
        }

        store.deleteWorkoutSeries(seriesId: seriesId) { error in
            if let error = error {
                print("❌ Error deleting workout series: \(error)")
            } else {
                print("✅ Workout series deleted")
                // Remove all workouts with this seriesId from local array
                self.scheduledWorkouts.removeAll { $0.seriesId == seriesId }
            }
        }
    }

    private func editWorkout(_ workout: ScheduledWorkout) {
        workoutToEdit = workout
        showEditWorkout = true
    }

    private func updatePersonalWorkout(_ workout: ScheduledWorkout) {
        store.saveScheduledWorkout(workout) { savedWorkout, error in
            if let error = error {
                print("❌ Error updating workout: \(error)")
            } else if let savedWorkout = savedWorkout {
                print("✅ Workout updated")
                // Update in local array
                if let index = self.scheduledWorkouts.firstIndex(where: { $0.id == savedWorkout.id }) {
                    self.scheduledWorkouts[index] = savedWorkout
                }
            }
        }
    }

    private func savePersonalWorkout(_ workout: ScheduledWorkout) {
        if workout.isRecurring {
            store.saveRecurringWorkout(workout) { workouts, error in
                if let error = error {
                    print("❌ Error saving recurring workouts: \(error)")
                } else {
                    print("✅ Saved \(workouts.count) recurring workout instances")
                    // Add to local array
                    self.scheduledWorkouts.append(contentsOf: workouts)
                }
            }
        } else {
            store.saveScheduledWorkout(workout) { savedWorkout, error in
                if let error = error {
                    print("❌ Error saving workout: \(error)")
                } else if let savedWorkout = savedWorkout {
                    print("✅ Workout saved")
                    // Add to local array
                    self.scheduledWorkouts.append(savedWorkout)
                }
            }
        }
    }

}

struct DayWorkoutCard: View {
    @EnvironmentObject var store: AppStore
    let date: Date
    let workouts: [ScheduledWorkout]
    let onDelete: (ScheduledWorkout) -> Void
    let onDeleteSeries: (ScheduledWorkout) -> Void
    let onEdit: (ScheduledWorkout) -> Void
    let onLogWorkout: (ScheduledWorkout) -> Void

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
                        .environmentObject(store)
                        .contextMenu {
                            Button {
                                onLogWorkout(workout)
                            } label: {
                                Label("Log Result", systemImage: "checkmark.circle")
                            }

                            // Only allow editing/deleting personal workouts that the user created
                            if workout.isPersonalWorkout {
                                Button {
                                    onEdit(workout)
                                } label: {
                                    Label("Edit Workout", systemImage: "pencil")
                                }

                                Divider()

                                if workout.isRecurring {
                                    Button(role: .destructive) {
                                        onDelete(workout)
                                    } label: {
                                        Label("Delete This Occurrence", systemImage: "trash")
                                    }

                                    Button(role: .destructive) {
                                        onDeleteSeries(workout)
                                    } label: {
                                        Label("Delete All in Series", systemImage: "trash.fill")
                                    }
                                } else {
                                    Button(role: .destructive) {
                                        onDelete(workout)
                                    } label: {
                                        Label("Delete Workout", systemImage: "trash")
                                    }
                                }
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
    @EnvironmentObject var store: AppStore
    let workout: ScheduledWorkout

    private var workoutTypeInfo: (label: String, color: Color, icon: String) {
        if workout.isPersonalWorkout {
            return ("Personal", .blue, "person.fill")
        } else {
            // For group workouts, try to find the group name
            if let groupId = workout.groupId,
               let group = store.groups.first(where: { $0.id == groupId }) {
                return (group.name, .green, "person.3.fill")
            } else {
                return ("Group", .green, "person.3.fill")
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(workout.wodTitle)
                    .font(.headline)

                Spacer()

                // Badge showing workout type
                HStack(spacing: 4) {
                    Image(systemName: workoutTypeInfo.icon)
                        .font(.caption2)
                    Text(workoutTypeInfo.label)
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(workoutTypeInfo.color)
                .cornerRadius(8)
            }

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
                    if let user = store.appUser {
                        Text("Name: \(user.fullName.isEmpty ? user.email : user.fullName)")
                            .font(.caption)
                    } else {
                        Text("Email: \(store.currentUser?.email ?? "N/A")")
                            .font(.caption)
                    }
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

struct AddPersonalWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let selectedDate: Date
    let onSave: (ScheduledWorkout) -> Void

    @State private var workoutType: WorkoutType = .wod
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var date: Date
    @State private var recurrenceType: RecurrenceType = .none
    @State private var hasEndDate: Bool = false
    @State private var recurrenceEndDate: Date
    @State private var selectedWeekdays: Set<Int> = []
    @State private var monthlyRecurrenceType: MonthlyRecurrenceType = .sameDay
    @State private var monthlyWeekPosition: Int = 1 // 1=First, 2=Second, 3=Third, 4=Fourth, 5=Last
    @State private var monthlyWeekday: Int = 2 // Default to Monday
    @State private var showSuggestions: Bool = false

    // Filtered workout suggestions based on title and type
    private var workoutSuggestions: [WOD] {
        guard !title.isEmpty else { return [] }

        return SampleData.wods
            .filter { $0.type == workoutType }
            .filter { $0.title.localizedCaseInsensitiveContains(title) }
            .prefix(5)
            .map { $0 }
    }

    init(selectedDate: Date, onSave: @escaping (ScheduledWorkout) -> Void) {
        self.selectedDate = selectedDate
        self.onSave = onSave
        _date = State(initialValue: selectedDate)
        _recurrenceEndDate = State(initialValue: Calendar.current.date(byAdding: .month, value: 3, to: selectedDate) ?? selectedDate)

        // Initialize weekly and monthly settings from selected date
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: selectedDate)
        _selectedWeekdays = State(initialValue: [weekday])
        _monthlyWeekday = State(initialValue: weekday)
        _monthlyWeekPosition = State(initialValue: Self.weekPositionInMonth(for: selectedDate))
    }

    // Helper to calculate which week of the month a date is in
    static func weekPositionInMonth(for date: Date) -> Int {
        let calendar = Calendar.current
        let dayOfMonth = calendar.component(.day, from: date)

        if dayOfMonth <= 7 {
            return 1 // First week
        } else if dayOfMonth <= 14 {
            return 2 // Second week
        } else if dayOfMonth <= 21 {
            return 3 // Third week
        } else {
            // Check if this is the last occurrence of this weekday
            let _ = calendar.component(.weekday, from: date)
            guard let nextWeek = calendar.date(byAdding: .weekOfMonth, value: 1, to: date),
                  calendar.component(.month, from: nextWeek) != calendar.component(.month, from: date) else {
                return 4 // Fourth week
            }
            return 5 // Last week (different from 4th if there are 5 occurrences)
        }
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Picker("Workout Type", selection: $workoutType) {
                        Text("WOD").tag(WorkoutType.wod)
                        Text("Lift").tag(WorkoutType.lift)
                    }
                    .pickerStyle(.segmented)
                }

                Section("Workout Details") {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Title", text: $title)
                            .onChange(of: title) { _ in
                                showSuggestions = !title.isEmpty
                            }

                        // Show suggestions when typing
                        if showSuggestions && !workoutSuggestions.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Suggestions:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                ForEach(workoutSuggestions) { suggestion in
                                    Button(action: {
                                        title = suggestion.title
                                        description = suggestion.description
                                        showSuggestions = false
                                    }) {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(suggestion.title)
                                                    .font(.body)
                                                    .foregroundColor(.primary)
                                                if !suggestion.description.isEmpty {
                                                    Text(suggestion.description)
                                                        .font(.caption)
                                                        .foregroundColor(.secondary)
                                                        .lineLimit(1)
                                                }
                                            }
                                            Spacer()
                                        }
                                        .padding(.vertical, 4)
                                        .padding(.horizontal, 8)
                                        .background(Color(.systemGray6))
                                        .cornerRadius(6)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.top, 4)
                        }
                    }

                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                Section("Recurrence") {
                    Picker("Repeat", selection: $recurrenceType) {
                        Text("Does not repeat").tag(RecurrenceType.none)
                        Text("Daily").tag(RecurrenceType.daily)
                        Text("Weekly").tag(RecurrenceType.weekly)
                        Text("Monthly").tag(RecurrenceType.monthly)
                    }

                    // Weekly recurrence options
                    if recurrenceType == .weekly {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Repeat on")
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            WeekdayPicker(selectedWeekdays: $selectedWeekdays)
                        }
                    }

                    // Monthly recurrence options
                    if recurrenceType == .monthly {
                        VStack(alignment: .leading, spacing: 12) {
                            Picker("Monthly repeat type", selection: $monthlyRecurrenceType) {
                                Text("Same day each month").tag(MonthlyRecurrenceType.sameDay)
                                Text("Week-based").tag(MonthlyRecurrenceType.weekBased)
                            }
                            .pickerStyle(.segmented)

                            if monthlyRecurrenceType == .sameDay {
                                Text("Repeats on day \(Calendar.current.component(.day, from: date)) of every month")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            } else {
                                VStack(alignment: .leading, spacing: 8) {
                                    Picker("Week position", selection: $monthlyWeekPosition) {
                                        Text("First").tag(1)
                                        Text("Second").tag(2)
                                        Text("Third").tag(3)
                                        Text("Fourth").tag(4)
                                        Text("Last").tag(5)
                                    }

                                    Picker("Weekday", selection: $monthlyWeekday) {
                                        Text("Sunday").tag(1)
                                        Text("Monday").tag(2)
                                        Text("Tuesday").tag(3)
                                        Text("Wednesday").tag(4)
                                        Text("Thursday").tag(5)
                                        Text("Friday").tag(6)
                                        Text("Saturday").tag(7)
                                    }

                                    Text(monthlyWeekBasedSummary)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
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
            .navigationTitle("Add Personal Workout")
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

                        let calendar = Calendar.current
                        let normalizedDate = calendar.startOfDay(for: date)

                        let workout = ScheduledWorkout(
                            wodId: UUID().uuidString,
                            wodTitle: title,
                            wodDescription: description,
                            date: normalizedDate,
                            workoutType: workoutType,
                            groupId: nil, // Personal workout
                            timeSlots: [],
                            createdBy: userId,
                            recurrenceType: recurrenceType,
                            recurrenceEndDate: hasEndDate ? recurrenceEndDate : nil,
                            weekdays: recurrenceType == .weekly ? Array(selectedWeekdays) : nil,
                            monthlyWeekPosition: (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? monthlyWeekPosition : nil,
                            monthlyWeekday: (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? monthlyWeekday : nil
                        )

                        onSave(workout)
                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
            }
        }
    }

    private var monthlyWeekBasedSummary: String {
        let weekPositionNames = ["", "First", "Second", "Third", "Fourth", "Last"]
        let weekdayNames = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        let position = weekPositionNames[min(monthlyWeekPosition, 5)]
        let day = weekdayNames[min(monthlyWeekday, 7)]

        return "Repeats on the \(position) \(day) of every month"
    }

    private var recurrenceSummary: String {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateStyle = .medium

        switch recurrenceType {
        case .none:
            return ""
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
            var baseText = ""
            if monthlyRecurrenceType == .sameDay {
                baseText = "Repeats on day \(calendar.component(.day, from: date)) of every month"
            } else {
                baseText = monthlyWeekBasedSummary
            }

            if hasEndDate {
                let months = calendar.dateComponents([.month], from: date, to: recurrenceEndDate).month ?? 0
                return "\(baseText) for \(months) months (until \(formatter.string(from: recurrenceEndDate)))"
            } else {
                return "\(baseText) for 1 year (12 months)"
            }
        }
    }
}

struct EditPersonalWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let workout: ScheduledWorkout
    let onSave: (ScheduledWorkout) -> Void

    @State private var workoutType: WorkoutType
    @State private var title: String
    @State private var description: String
    @State private var date: Date

    init(workout: ScheduledWorkout, onSave: @escaping (ScheduledWorkout) -> Void) {
        self.workout = workout
        self.onSave = onSave
        _workoutType = State(initialValue: workout.workoutType)
        _title = State(initialValue: workout.wodTitle)
        _description = State(initialValue: workout.wodDescription)
        _date = State(initialValue: workout.date)
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Picker("Workout Type", selection: $workoutType) {
                        Text("WOD").tag(WorkoutType.wod)
                        Text("Lift").tag(WorkoutType.lift)
                    }
                    .pickerStyle(.segmented)
                }

                Section("Workout Details") {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                if workout.isRecurring {
                    Section {
                        Text("Note: This will only update this specific occurrence. To edit the entire series, please delete and recreate it.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Edit Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard store.currentUser?.uid != nil else {
                            print("❌ No user logged in")
                            dismiss()
                            return
                        }

                        let calendar = Calendar.current
                        let normalizedDate = calendar.startOfDay(for: date)

                        var updatedWorkout = workout
                        updatedWorkout.workoutType = workoutType
                        updatedWorkout.wodTitle = title
                        updatedWorkout.wodDescription = description
                        updatedWorkout.date = normalizedDate

                        onSave(updatedWorkout)
                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
            }
        }
    }
}

