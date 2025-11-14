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
    @State private var showLogWorkout = false
    @State private var workoutToLog: ScheduledWorkout?

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
                                },
                                onLogWorkout: { workout in
                                    workoutToLog = workout
                                    showLogWorkout = true
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
            .sheet(isPresented: $showLogWorkout) {
                if let workout = workoutToLog {
                    LogWorkoutSheet(workout: workout) { log in
                        saveWorkoutLog(log)
                    }
                    .environmentObject(store)
                }
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

    private func saveWorkoutLog(_ log: WorkoutLog) {
        store.saveWorkoutLog(log) { savedLog, error in
            if let error = error {
                print("❌ Error saving workout log: \(error)")
            } else if let savedLog = savedLog {
                print("✅ Workout logged: \(savedLog.wodTitle)")
                if savedLog.isPersonalRecord {
                    print("🎉 NEW PR!")
                }
            }
        }
    }
}

struct DayWorkoutCard: View {
    let date: Date
    let workouts: [ScheduledWorkout]
    let onDelete: (ScheduledWorkout) -> Void
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
                        .contextMenu {
                            Button {
                                onLogWorkout(workout)
                            } label: {
                                Label("Log Result", systemImage: "checkmark.circle")
                            }

                            // Only allow deleting personal workouts that the user created
                            if workout.isPersonalWorkout {
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

    @State private var title: String = ""
    @State private var description: String = ""
    @State private var date: Date
    @State private var recurrenceType: RecurrenceType = .none
    @State private var hasEndDate: Bool = false
    @State private var recurrenceEndDate: Date
    @State private var monthlyWeekPosition: Int = 1 // 1=First, 2=Second, 3=Third, 4=Fourth, 5=Last
    @State private var monthlyWeekday: Int = 2 // Default to Monday

    init(selectedDate: Date, onSave: @escaping (ScheduledWorkout) -> Void) {
        self.selectedDate = selectedDate
        self.onSave = onSave
        _date = State(initialValue: selectedDate)
        _recurrenceEndDate = State(initialValue: Calendar.current.date(byAdding: .month, value: 3, to: selectedDate) ?? selectedDate)

        // Initialize monthly settings from selected date
        let calendar = Calendar.current
        _monthlyWeekday = State(initialValue: calendar.component(.weekday, from: selectedDate))
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
            let weekday = calendar.component(.weekday, from: date)
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
                Section("Workout Details") {
                    TextField("Title", text: $title)
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

                    // Monthly recurrence options
                    if recurrenceType == .monthly {
                        Picker("Week", selection: $monthlyWeekPosition) {
                            Text("First").tag(1)
                            Text("Second").tag(2)
                            Text("Third").tag(3)
                            Text("Fourth").tag(4)
                            Text("Last").tag(5)
                        }

                        Picker("Day", selection: $monthlyWeekday) {
                            Text("Sunday").tag(1)
                            Text("Monday").tag(2)
                            Text("Tuesday").tag(3)
                            Text("Wednesday").tag(4)
                            Text("Thursday").tag(5)
                            Text("Friday").tag(6)
                            Text("Saturday").tag(7)
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
                            groupId: nil, // Personal workout
                            timeSlots: [],
                            createdBy: userId,
                            recurrenceType: recurrenceType,
                            recurrenceEndDate: hasEndDate ? recurrenceEndDate : nil,
                            weekdays: nil,
                            monthlyWeekPosition: recurrenceType == .monthly ? monthlyWeekPosition : nil,
                            monthlyWeekday: recurrenceType == .monthly ? monthlyWeekday : nil
                        )

                        onSave(workout)
                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
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
        case .daily:
            if hasEndDate {
                return "Repeats daily until \(formatter.string(from: recurrenceEndDate))"
            } else {
                return "Repeats daily for 1 year"
            }
        case .weekly:
            if hasEndDate {
                let weeks = calendar.dateComponents([.weekOfYear], from: date, to: recurrenceEndDate).weekOfYear ?? 0
                return "Repeats weekly for \(weeks) weeks (until \(formatter.string(from: recurrenceEndDate)))"
            } else {
                return "Repeats weekly for 1 year (52 weeks)"
            }
        case .monthly:
            let weekPositionText = ["", "first", "second", "third", "fourth", "last"][min(monthlyWeekPosition, 5)]
            let weekdayText = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][min(monthlyWeekday, 7)]

            if hasEndDate {
                let months = calendar.dateComponents([.month], from: date, to: recurrenceEndDate).month ?? 0
                return "Repeats on the \(weekPositionText) \(weekdayText) of each month for \(months) months (until \(formatter.string(from: recurrenceEndDate)))"
            } else {
                return "Repeats on the \(weekPositionText) \(weekdayText) of each month for 1 year"
            }
        }
    }
}

struct LogWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let workout: ScheduledWorkout
    let onSave: (WorkoutLog) -> Void

    @State private var resultType: WorkoutResultType = .time
    @State private var minutes: Int = 0
    @State private var seconds: Int = 0
    @State private var rounds: Int = 0
    @State private var reps: Int = 0
    @State private var weight: String = ""
    @State private var notes: String = ""
    @State private var showPRCelebration = false
    @State private var isPR = false

    var body: some View {
        NavigationView {
            Form {
                Section("Workout") {
                    Text(workout.wodTitle)
                        .font(.headline)
                    Text(workout.wodDescription)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Section("Result Type") {
                    Picker("Type", selection: $resultType) {
                        Text("Time").tag(WorkoutResultType.time)
                        Text("Rounds (AMRAP)").tag(WorkoutResultType.rounds)
                        Text("Weight").tag(WorkoutResultType.weight)
                        Text("Reps").tag(WorkoutResultType.reps)
                        Text("Other").tag(WorkoutResultType.other)
                    }
                    .pickerStyle(.menu)
                }

                Section("Your Result") {
                    switch resultType {
                    case .time:
                        HStack {
                            Picker("Minutes", selection: $minutes) {
                                ForEach(0..<100) { min in
                                    Text("\(min) min").tag(min)
                                }
                            }
                            .pickerStyle(.wheel)
                            .frame(maxWidth: .infinity)

                            Picker("Seconds", selection: $seconds) {
                                ForEach(0..<60) { sec in
                                    Text("\(sec) sec").tag(sec)
                                }
                            }
                            .pickerStyle(.wheel)
                            .frame(maxWidth: .infinity)
                        }
                        .frame(height: 120)

                    case .rounds:
                        Stepper("Rounds: \(rounds)", value: $rounds, in: 0...1000)
                        Stepper("Additional Reps: \(reps)", value: $reps, in: 0...1000)

                    case .weight:
                        HStack {
                            TextField("Weight", text: $weight)
                                .keyboardType(.decimalPad)
                            Text("lbs")
                                .foregroundColor(.secondary)
                        }

                    case .reps:
                        Stepper("Reps: \(reps)", value: $reps, in: 0...1000)

                    case .other:
                        Text("Enter details in notes below")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Section("Notes (Optional)") {
                    TextField("How did it feel? Any scaling?", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                if showPRCelebration {
                    Section {
                        HStack {
                            Spacer()
                            VStack(spacing: 8) {
                                Text("🎉")
                                    .font(.system(size: 50))
                                Text("NEW PERSONAL RECORD!")
                                    .font(.headline)
                                    .foregroundColor(.green)
                            }
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Log Result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveLog()
                    }
                    .disabled(!isValidResult)
                }
            }
        }
    }

    private var isValidResult: Bool {
        switch resultType {
        case .time:
            return minutes > 0 || seconds > 0
        case .rounds:
            return rounds > 0
        case .weight:
            return !weight.isEmpty && Double(weight) != nil
        case .reps:
            return reps > 0
        case .other:
            return !notes.isEmpty
        }
    }

    private func saveLog() {
        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            dismiss()
            return
        }

        // Calculate values based on result type
        let timeInSeconds: Double? = resultType == .time ? Double(minutes * 60 + seconds) : nil
        let weightValue: Double? = resultType == .weight ? Double(weight) : nil

        // Check if this is a PR
        let comparisonValue: Double? = {
            switch resultType {
            case .time:
                return timeInSeconds
            case .rounds:
                return Double(rounds) + (Double(reps) / 100.0) // Combine rounds and reps for comparison
            case .weight:
                return weightValue
            case .reps:
                return Double(reps)
            case .other:
                return nil
            }
        }()

        if let value = comparisonValue {
            store.checkIfPR(userId: userId, wodTitle: workout.wodTitle, resultType: resultType, value: value) { prStatus in
                self.isPR = prStatus

                if prStatus {
                    // Show celebration
                    showPRCelebration = true

                    // Wait 1.5 seconds then save and dismiss
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        createAndSaveLog(isPR: true)
                    }
                } else {
                    createAndSaveLog(isPR: false)
                }
            }
        } else {
            createAndSaveLog(isPR: false)
        }
    }

    private func createAndSaveLog(isPR: Bool) {
        guard let userId = store.currentUser?.uid else { return }

        let log = WorkoutLog(
            userId: userId,
            scheduledWorkoutId: workout.id,
            wodTitle: workout.wodTitle,
            wodDescription: workout.wodDescription,
            workoutDate: workout.date,
            completedDate: Date(),
            resultType: resultType,
            timeInSeconds: resultType == .time ? Double(minutes * 60 + seconds) : nil,
            rounds: resultType == .rounds ? rounds : nil,
            reps: (resultType == .rounds || resultType == .reps) ? reps : nil,
            weight: resultType == .weight ? Double(weight) : nil,
            notes: notes.isEmpty ? nil : notes,
            isPersonalRecord: isPR
        )

        onSave(log)
        dismiss()
    }
}
