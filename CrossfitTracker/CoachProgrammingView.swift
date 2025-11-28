//
//  CoachProgrammingView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

enum MonthlyRecurrenceType {
    case sameDay // e.g., 15th of every month
    case weekBased // e.g., first Monday, last Friday
}

struct CoachProgrammingView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym

    @State private var showingAddWorkout = false
    @State private var workoutToEdit: ScheduledWorkout?
    @State private var selectedDate = Date()
    @State private var scheduledWorkouts: [ScheduledWorkout] = []
    @State private var groups: [WorkoutGroup] = []

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
                                groups: groups,
                                onAddWorkout: {
                                    selectedDate = date
                                    showingAddWorkout = true
                                },
                                onEdit: { workout in
                                    editWorkout(workout)
                                },
                                onDelete: { workout in
                                    deleteWorkout(workout)
                                },
                                onDeleteSeries: { workout in
                                    deleteWorkoutSeries(workout)
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
            .sheet(item: $workoutToEdit) { workout in
                NavigationStack {
                    EditWorkoutSheet(gym: gym, workout: workout) {
                        // Reload workouts after edit to handle all cases including recurring conversion
                        loadScheduledWorkouts()
                    }
                    .environmentObject(store)
                }
            }
            .onAppear {
                loadScheduledWorkouts()
                loadGroups()
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

    private func loadGroups() {
        guard let gymId = gym.id else { return }

        store.loadGroupsForGym(gymId: gymId) { groups, error in
            if let error = error {
                print("❌ Error loading groups: \(error)")
                return
            }

            self.groups = groups
            print("✅ Loaded \(groups.count) groups for programming view")
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

    private func editWorkout(_ workout: ScheduledWorkout) {
        workoutToEdit = workout
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
}

struct CoachDayCard: View {
    let date: Date
    let workouts: [ScheduledWorkout]
    let groups: [WorkoutGroup]
    let onAddWorkout: () -> Void
    let onEdit: (ScheduledWorkout) -> Void
    let onDelete: (ScheduledWorkout) -> Void
    let onDeleteSeries: (ScheduledWorkout) -> Void

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

    private func groupNames(for workout: ScheduledWorkout) -> [String] {
        return workout.groupIds.compactMap { groupId in
            groups.first(where: { $0.id == groupId })?.name
        }
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
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(workout.wodTitle)
                                    .font(.headline)

                                ForEach(groupNames(for: workout), id: \.self) { groupName in
                                    Text(groupName)
                                        .font(.caption)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.purple)
                                        .cornerRadius(8)
                                }
                            }

                            Text(workout.wodDescription)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .lineLimit(2)

                            // Time slots display for coaches
                            if !workout.timeSlots.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    ForEach(workout.timeSlots) { slot in
                                        CoachTimeSlotRow(slot: slot)
                                    }
                                }
                                .padding(.top, 4)
                            }
                        }

                        Spacer()

                        // Edit button
                        Button(action: {
                            onEdit(workout)
                        }) {
                            Image(systemName: "pencil")
                                .foregroundColor(.blue)
                                .font(.body)
                        }
                        .buttonStyle(.plain)

                        // Delete menu - shows options for single or series delete
                        Menu {
                            Button(role: .destructive) {
                                onDelete(workout)
                            } label: {
                                Label("Delete This", systemImage: "trash")
                            }

                            if workout.isRecurring {
                                Button(role: .destructive) {
                                    onDeleteSeries(workout)
                                } label: {
                                    Label("Delete Series", systemImage: "trash.fill")
                                }
                            }
                        } label: {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                                .font(.body)
                        }
                        .buttonStyle(.plain)
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

struct CoachTimeSlotRow: View {
    let slot: TimeSlot

    private var spotsText: String {
        if slot.capacity == 0 {
            return "\(slot.signedUpUserIds.count) signed up"
        } else {
            return "\(slot.signedUpUserIds.count)/\(slot.capacity) signed up"
        }
    }

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(timeFormatter.string(from: slot.startTime))
                .font(.caption)
                .fontWeight(.medium)
            Text("•")
                .foregroundColor(.secondary)
            Text(spotsText)
                .font(.caption)
                .foregroundColor(slot.isFull ? .orange : .secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray6))
        .cornerRadius(6)
    }
}

struct AddWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let gym: Gym
    let selectedDate: Date
    let onSave: (ScheduledWorkout) -> Void

    @State private var workoutType: WorkoutType = .wod
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var date: Date
    @State private var groups: [WorkoutGroup] = []
    @State private var selectedGroupIds: Set<String> = []
    @State private var recurrenceType: RecurrenceType = .none
    @State private var hasEndDate: Bool = false
    @State private var recurrenceEndDate: Date
    @State private var selectedWeekdays: Set<Int> = []

    // Monthly recurrence options
    @State private var monthlyRecurrenceType: MonthlyRecurrenceType = .sameDay
    @State private var selectedMonthlyWeekPosition: Int = 1
    @State private var selectedMonthlyWeekday: Int = 2
    @State private var showSuggestions: Bool = false
    @State private var saveToLibrary: Bool = false
    @State private var userTemplates: [WorkoutTemplate] = []

    // Time slots for group workouts
    @State private var timeSlots: [TimeSlot] = []
    @State private var newSlotTime: Date = Date()
    @State private var newSlotCapacity: Int = 20
    @State private var useCustomTimeSlots: Bool = false

    // Get default time slots from selected groups
    private var defaultTimeSlotsFromGroups: [DefaultTimeSlot] {
        var slots: [DefaultTimeSlot] = []
        for groupId in selectedGroupIds {
            if let group = groups.first(where: { $0.id == groupId }) {
                slots.append(contentsOf: group.defaultTimeSlots)
            }
        }
        // Remove duplicates based on time
        var seen: Set<String> = []
        return slots.filter { slot in
            let key = "\(slot.hour):\(slot.minute)"
            if seen.contains(key) { return false }
            seen.insert(key)
            return true
        }.sorted { ($0.hour * 60 + $0.minute) < ($1.hour * 60 + $1.minute) }
    }

    // Convert default slots to TimeSlots for the selected date
    private func timeSlotsFromDefaults() -> [TimeSlot] {
        return defaultTimeSlotsFromGroups.map { $0.toTimeSlot(for: date) }
    }

    // Filtered workout suggestions based on title and type
    private var workoutSuggestions: [WOD] {
        guard !title.isEmpty else { return [] }

        // Combine preset workouts and user templates
        var suggestions: [WOD] = []

        // Add presets from SampleData
        let presetMatches = SampleData.wods
            .filter { $0.type == workoutType }
            .filter { $0.title.localizedCaseInsensitiveContains(title) }
        suggestions.append(contentsOf: presetMatches)

        // Add user's saved templates
        let templateMatches = userTemplates
            .filter { $0.workoutType == workoutType }
            .filter { $0.title.localizedCaseInsensitiveContains(title) }
            .map { WOD(title: $0.title, description: $0.description, type: $0.workoutType) }
        suggestions.append(contentsOf: templateMatches)

        return Array(suggestions.prefix(5))
    }

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
        _selectedMonthlyWeekday = State(initialValue: weekday)

        // Calculate week position in month (1st, 2nd, 3rd, 4th, or Last)
        let calendar = Calendar.current
        let dayOfMonth = calendar.component(.day, from: selectedDate)
        let weekPosition = (dayOfMonth - 1) / 7 + 1
        _selectedMonthlyWeekPosition = State(initialValue: min(weekPosition, 4))
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

                    Toggle("Save to my workout library", isOn: $saveToLibrary)

                    NavigationLink(destination: WorkoutTemplateLibraryView(gym: nil).environmentObject(store)) {
                        HStack {
                            Image(systemName: "book.fill")
                                .foregroundColor(.blue)
                            Text("View My Workout Library")
                                .foregroundColor(.blue)
                        }
                    }
                }

                Section("Assignment") {
                    if groups.isEmpty {
                        Text("Loading groups...")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(groups) { group in
                            if let groupId = group.id {
                                Toggle(group.name, isOn: Binding(
                                    get: { selectedGroupIds.contains(groupId) },
                                    set: { isOn in
                                        if isOn {
                                            selectedGroupIds.insert(groupId)
                                        } else {
                                            selectedGroupIds.remove(groupId)
                                        }
                                    }
                                ))
                            }
                        }
                    }

                    if selectedGroupIds.isEmpty {
                        Text("No groups selected - workout will be personal (only you)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("Selected \(selectedGroupIds.count) group(s)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Only show class times for group workouts
                if !selectedGroupIds.isEmpty {
                    Section("Class Times") {
                        // Show default times from group settings
                        if !defaultTimeSlotsFromGroups.isEmpty && !useCustomTimeSlots {
                            ForEach(defaultTimeSlotsFromGroups) { slot in
                                HStack {
                                    Image(systemName: "clock")
                                        .foregroundColor(.blue)
                                    Text(slot.timeString)
                                        .font(.headline)
                                    Spacer()
                                    Text(slot.capacity == 0 ? "Unlimited" : "Cap: \(slot.capacity)")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }
                            }

                            Text("Using default class times from group settings")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else if defaultTimeSlotsFromGroups.isEmpty && !useCustomTimeSlots {
                            Text("No default class times set for selected group(s)")
                                .foregroundColor(.secondary)
                                .italic()

                            Text("Set default times in Group Management, or use custom times below")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        // Toggle for custom times
                        Toggle("Use custom class times", isOn: $useCustomTimeSlots)

                        // Custom time slots editor
                        if useCustomTimeSlots {
                            if timeSlots.isEmpty {
                                Text("No custom class times added")
                                    .foregroundColor(.secondary)
                                    .italic()
                            } else {
                                ForEach(timeSlots) { slot in
                                    HStack {
                                        Text(slot.startTime, style: .time)
                                            .font(.headline)
                                        Spacer()
                                        Text("Capacity: \(slot.capacity == 0 ? "Unlimited" : "\(slot.capacity)")")
                                            .font(.subheadline)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .onDelete { indexSet in
                                    timeSlots.remove(atOffsets: indexSet)
                                }
                            }

                            // Add new time slot
                            VStack(alignment: .leading, spacing: 12) {
                                DatePicker("Time", selection: $newSlotTime, displayedComponents: .hourAndMinute)

                                Stepper("Capacity: \(newSlotCapacity == 0 ? "Unlimited" : "\(newSlotCapacity)")", value: $newSlotCapacity, in: 0...100)

                                Button(action: {
                                    // Combine the selected date with the time
                                    let calendar = Calendar.current
                                    let timeComponents = calendar.dateComponents([.hour, .minute], from: newSlotTime)
                                    var slotDateTime = calendar.startOfDay(for: date)
                                    slotDateTime = calendar.date(bySettingHour: timeComponents.hour ?? 0, minute: timeComponents.minute ?? 0, second: 0, of: slotDateTime) ?? slotDateTime

                                    let newSlot = TimeSlot(startTime: slotDateTime, capacity: newSlotCapacity)
                                    timeSlots.append(newSlot)
                                    // Sort by time
                                    timeSlots.sort { $0.startTime < $1.startTime }
                                }) {
                                    HStack {
                                        Image(systemName: "plus.circle.fill")
                                        Text("Add Class Time")
                                    }
                                }
                            }
                        }
                    }
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
                                    Picker("Week position", selection: $selectedMonthlyWeekPosition) {
                                        Text("First").tag(1)
                                        Text("Second").tag(2)
                                        Text("Third").tag(3)
                                        Text("Fourth").tag(4)
                                        Text("Last").tag(5)
                                    }

                                    Picker("Weekday", selection: $selectedMonthlyWeekday) {
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

                        // Determine which time slots to use
                        let finalTimeSlots: [TimeSlot]
                        if selectedGroupIds.isEmpty {
                            finalTimeSlots = []
                        } else if useCustomTimeSlots {
                            finalTimeSlots = timeSlots
                        } else {
                            finalTimeSlots = timeSlotsFromDefaults()
                        }

                        let workout = ScheduledWorkout(
                            wodId: UUID().uuidString,
                            wodTitle: title,
                            wodDescription: description,
                            date: normalizedDate,
                            workoutType: workoutType,
                            groupIds: Array(selectedGroupIds),
                            timeSlots: finalTimeSlots,
                            createdBy: userId,
                            recurrenceType: recurrenceType,
                            recurrenceEndDate: hasEndDate ? recurrenceEndDate : nil,
                            weekdays: recurrenceType == .weekly ? Array(selectedWeekdays) : nil,
                            monthlyWeekPosition: (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? selectedMonthlyWeekPosition : nil,
                            monthlyWeekday: (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? selectedMonthlyWeekday : nil
                        )

                        if workout.isRecurring {
                            print("💾 Saving recurring workout: \(workout.wodTitle), recurrence: \(recurrenceType.rawValue)")
                            store.saveRecurringWorkout(workout) { workouts, error in
                                if let error = error {
                                    print("❌ Error saving recurring workouts: \(error)")
                                } else {
                                    print("✅ Saved \(workouts.count) recurring workout instances")
                                    // Add all workouts to the view
                                    for savedWorkout in workouts {
                                        onSave(savedWorkout)
                                    }
                                }
                            }
                        } else {
                            let groupsText = selectedGroupIds.isEmpty ? "personal" : "\(selectedGroupIds.count) group(s)"
                            print("💾 Saving workout: \(workout.wodTitle) for \(normalizedDate), groups: \(groupsText)")
                            onSave(workout)
                        }

                        // Save workout template to library if toggle is on
                        if saveToLibrary {
                            let template = WorkoutTemplate(
                                title: title,
                                description: description,
                                workoutType: workoutType,
                                createdBy: userId,
                                isPersonal: true
                            )
                            store.saveWorkoutTemplate(template) { savedTemplate, error in
                                if let error = error {
                                    print("❌ Error saving workout template: \(error)")
                                } else {
                                    print("✅ Workout template saved to library")
                                }
                            }
                        }

                        dismiss()
                    }
                    .disabled(title.isEmpty || description.isEmpty)
                }
            }
            .onAppear {
                loadGroups()
                loadUserTemplates()
            }
            .onChange(of: workoutType) { _ in
                loadUserTemplates()
            }
        }
    }

    private func loadUserTemplates() {
        guard let userId = store.currentUser?.uid else { return }
        store.loadUserWorkoutTemplates(userId: userId, workoutType: workoutType) { templates, error in
            if let error = error {
                print("❌ Error loading user templates: \(error)")
            } else {
                self.userTemplates = templates
                print("✅ Loaded \(templates.count) user workout templates")
            }
        }
    }

    private var monthlyWeekBasedSummary: String {
        let weekPositionNames = ["", "First", "Second", "Third", "Fourth", "Last"]
        let weekdayNames = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        let position = weekPositionNames[selectedMonthlyWeekPosition]
        let day = weekdayNames[selectedMonthlyWeekday]

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
                .buttonStyle(.plain)
            }
        }
    }
}

struct EditWorkoutSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let gym: Gym
    let workout: ScheduledWorkout
    let onSave: () -> Void

    @State private var workoutType: WorkoutType
    @State private var title: String
    @State private var description: String
    @State private var date: Date
    @State private var groups: [WorkoutGroup] = []
    @State private var selectedGroupIds: Set<String>
    @State private var recurrenceType: RecurrenceType
    @State private var hasEndDate: Bool
    @State private var recurrenceEndDate: Date
    @State private var selectedWeekdays: Set<Int>
    @State private var monthlyRecurrenceType: MonthlyRecurrenceType
    @State private var selectedMonthlyWeekPosition: Int
    @State private var selectedMonthlyWeekday: Int

    // Time slots for group workouts
    @State private var timeSlots: [TimeSlot]
    @State private var newSlotTime: Date = Date()
    @State private var newSlotCapacity: Int = 20
    @State private var useCustomTimeSlots: Bool

    // Get default time slots from selected groups
    private var defaultTimeSlotsFromGroups: [DefaultTimeSlot] {
        var slots: [DefaultTimeSlot] = []
        for groupId in selectedGroupIds {
            if let group = groups.first(where: { $0.id == groupId }) {
                slots.append(contentsOf: group.defaultTimeSlots)
            }
        }
        // Remove duplicates based on time
        var seen: Set<String> = []
        return slots.filter { slot in
            let key = "\(slot.hour):\(slot.minute)"
            if seen.contains(key) { return false }
            seen.insert(key)
            return true
        }.sorted { ($0.hour * 60 + $0.minute) < ($1.hour * 60 + $1.minute) }
    }

    // Convert default slots to TimeSlots for the selected date
    private func timeSlotsFromDefaults() -> [TimeSlot] {
        return defaultTimeSlotsFromGroups.map { $0.toTimeSlot(for: date) }
    }

    init(gym: Gym, workout: ScheduledWorkout, onSave: @escaping () -> Void) {
        self.gym = gym
        self.workout = workout
        self.onSave = onSave
        _workoutType = State(initialValue: workout.workoutType)
        _title = State(initialValue: workout.wodTitle)
        _description = State(initialValue: workout.wodDescription)
        _date = State(initialValue: workout.date)
        _selectedGroupIds = State(initialValue: Set(workout.groupIds))
        _recurrenceType = State(initialValue: workout.recurrenceType)
        _hasEndDate = State(initialValue: workout.recurrenceEndDate != nil)
        _recurrenceEndDate = State(initialValue: workout.recurrenceEndDate ?? Calendar.current.date(byAdding: .month, value: 3, to: workout.date) ?? workout.date)

        // Initialize weekdays
        if let weekdays = workout.weekdays, !weekdays.isEmpty {
            _selectedWeekdays = State(initialValue: Set(weekdays))
        } else {
            let weekday = Calendar.current.component(.weekday, from: workout.date)
            _selectedWeekdays = State(initialValue: [weekday])
        }

        // Initialize monthly recurrence
        if workout.monthlyWeekPosition != nil && workout.monthlyWeekday != nil {
            _monthlyRecurrenceType = State(initialValue: .weekBased)
            _selectedMonthlyWeekPosition = State(initialValue: workout.monthlyWeekPosition ?? 1)
            _selectedMonthlyWeekday = State(initialValue: workout.monthlyWeekday ?? 2)
        } else {
            _monthlyRecurrenceType = State(initialValue: .sameDay)
            let calendar = Calendar.current
            let dayOfMonth = calendar.component(.day, from: workout.date)
            let weekPosition = (dayOfMonth - 1) / 7 + 1
            let weekday = calendar.component(.weekday, from: workout.date)
            _selectedMonthlyWeekPosition = State(initialValue: min(weekPosition, 4))
            _selectedMonthlyWeekday = State(initialValue: weekday)
        }

        // Initialize time slots from existing workout
        _timeSlots = State(initialValue: workout.timeSlots)

        // If workout has custom time slots, enable custom mode
        _useCustomTimeSlots = State(initialValue: !workout.timeSlots.isEmpty)
    }

    var body: some View {
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
                                Picker("Week position", selection: $selectedMonthlyWeekPosition) {
                                    Text("First").tag(1)
                                    Text("Second").tag(2)
                                    Text("Third").tag(3)
                                    Text("Fourth").tag(4)
                                    Text("Last").tag(5)
                                }

                                Picker("Weekday", selection: $selectedMonthlyWeekday) {
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

            Section("Assignment") {
                if groups.isEmpty {
                    Text("Loading groups...")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(groups) { group in
                        if let groupId = group.id {
                            Toggle(group.name, isOn: Binding(
                                get: { selectedGroupIds.contains(groupId) },
                                set: { isOn in
                                    if isOn {
                                        selectedGroupIds.insert(groupId)
                                    } else {
                                        selectedGroupIds.remove(groupId)
                                    }
                                }
                            ))
                        }
                    }
                }

                if selectedGroupIds.isEmpty {
                    Text("No groups selected - workout will be personal (only you)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Selected \(selectedGroupIds.count) group(s)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Only show class times for group workouts
            if !selectedGroupIds.isEmpty {
                Section("Class Times") {
                    // Show default times from group settings
                    if !defaultTimeSlotsFromGroups.isEmpty && !useCustomTimeSlots {
                        ForEach(defaultTimeSlotsFromGroups) { slot in
                            HStack {
                                Image(systemName: "clock")
                                    .foregroundColor(.blue)
                                Text(slot.timeString)
                                    .font(.headline)
                                Spacer()
                                Text(slot.capacity == 0 ? "Unlimited" : "Cap: \(slot.capacity)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Text("Using default class times from group settings")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else if defaultTimeSlotsFromGroups.isEmpty && !useCustomTimeSlots {
                        Text("No default class times set for selected group(s)")
                            .foregroundColor(.secondary)
                            .italic()

                        Text("Set default times in Group Management, or use custom times below")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Toggle for custom times
                    Toggle("Use custom class times", isOn: $useCustomTimeSlots)

                    // Custom time slots editor
                    if useCustomTimeSlots {
                        if timeSlots.isEmpty {
                            Text("No custom class times added")
                                .foregroundColor(.secondary)
                                .italic()
                        } else {
                            ForEach(timeSlots) { slot in
                                HStack {
                                    Text(slot.startTime, style: .time)
                                        .font(.headline)
                                    Spacer()
                                    Text("Capacity: \(slot.capacity == 0 ? "Unlimited" : "\(slot.capacity)")")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .onDelete { indexSet in
                                timeSlots.remove(atOffsets: indexSet)
                            }
                        }

                        // Add new time slot
                        VStack(alignment: .leading, spacing: 12) {
                            DatePicker("Time", selection: $newSlotTime, displayedComponents: .hourAndMinute)

                            Stepper("Capacity: \(newSlotCapacity == 0 ? "Unlimited" : "\(newSlotCapacity)")", value: $newSlotCapacity, in: 0...100)

                            Button(action: {
                                // Combine the selected date with the time
                                let calendar = Calendar.current
                                let timeComponents = calendar.dateComponents([.hour, .minute], from: newSlotTime)
                                var slotDateTime = calendar.startOfDay(for: date)
                                slotDateTime = calendar.date(bySettingHour: timeComponents.hour ?? 0, minute: timeComponents.minute ?? 0, second: 0, of: slotDateTime) ?? slotDateTime

                                let newSlot = TimeSlot(startTime: slotDateTime, capacity: newSlotCapacity)
                                timeSlots.append(newSlot)
                                // Sort by time
                                timeSlots.sort { $0.startTime < $1.startTime }
                            }) {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                    Text("Add Class Time")
                                }
                            }
                        }
                    }
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

                    // Determine which time slots to use
                    let finalTimeSlots: [TimeSlot]
                    if selectedGroupIds.isEmpty {
                        finalTimeSlots = []
                    } else if useCustomTimeSlots {
                        finalTimeSlots = timeSlots
                    } else {
                        finalTimeSlots = timeSlotsFromDefaults()
                    }

                    var updatedWorkout = workout
                    updatedWorkout.workoutType = workoutType
                    updatedWorkout.wodTitle = title
                    updatedWorkout.wodDescription = description
                    updatedWorkout.date = normalizedDate
                    updatedWorkout.groupIds = Array(selectedGroupIds)
                    updatedWorkout.timeSlots = finalTimeSlots
                    updatedWorkout.recurrenceType = recurrenceType
                    updatedWorkout.recurrenceEndDate = hasEndDate ? recurrenceEndDate : nil
                    updatedWorkout.weekdays = recurrenceType == .weekly ? Array(selectedWeekdays) : nil
                    updatedWorkout.monthlyWeekPosition = (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? selectedMonthlyWeekPosition : nil
                    updatedWorkout.monthlyWeekday = (recurrenceType == .monthly && monthlyRecurrenceType == .weekBased) ? selectedMonthlyWeekday : nil

                    // If changing to recurring or if it's a new recurring workout
                    if updatedWorkout.isRecurring && workout.recurrenceType == .none {
                        // Converting from non-recurring to recurring - create a series
                        print("💾 Converting to recurring workout: \(updatedWorkout.wodTitle)")

                        // Delete the original single workout first if it has an ID
                        if let originalId = workout.id {
                            store.deleteScheduledWorkout(workoutId: originalId) { error in
                                if let error = error {
                                    print("❌ Error deleting original workout: \(error)")
                                }
                            }
                        }

                        // Create the recurring series
                        store.saveRecurringWorkout(updatedWorkout) { workouts, error in
                            if let error = error {
                                print("❌ Error saving recurring workouts: \(error)")
                            } else {
                                print("✅ Saved \(workouts.count) recurring workout instances")
                            }
                            // Reload workouts in parent view
                            onSave()
                        }
                    } else {
                        // Regular single workout update
                        store.saveScheduledWorkout(updatedWorkout) { savedWorkout, error in
                            if let error = error {
                                print("❌ Error updating workout: \(error)")
                            } else {
                                print("✅ Workout updated")
                            }
                            // Reload workouts in parent view
                            onSave()
                        }
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

    private var monthlyWeekBasedSummary: String {
        let weekPositionNames = ["", "First", "Second", "Third", "Fourth", "Last"]
        let weekdayNames = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        let position = weekPositionNames[selectedMonthlyWeekPosition]
        let day = weekdayNames[selectedMonthlyWeekday]

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
