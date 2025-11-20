import SwiftUI

struct MonthlySchedulerView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    let workoutType: WorkoutType
    let liftID: UUID?
    let wodID: UUID?
    let startDate: Date

    @State private var monthlyOption: MonthlyRecurrence.MonthlyOption = .specificDay
    @State private var dayOfMonth: Int = 1
    @State private var selectedWeekday: WeeklyRecurrence.Weekday = .monday
    @State private var hasEndDate = false
    @State private var endDate = Date()

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text(workoutName)
                        .font(.headline)
                    Text("Repeats Monthly")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Section("Recurrence Pattern") {
                    Picker("Pattern", selection: $monthlyOption) {
                        Text("Specific Day").tag(MonthlyRecurrence.MonthlyOption.specificDay)
                        Text("First Weekday").tag(MonthlyRecurrence.MonthlyOption.firstWeekday)
                        Text("Second Weekday").tag(MonthlyRecurrence.MonthlyOption.secondWeekday)
                        Text("Third Weekday").tag(MonthlyRecurrence.MonthlyOption.thirdWeekday)
                        Text("Fourth Weekday").tag(MonthlyRecurrence.MonthlyOption.fourthWeekday)
                        Text("Last Weekday").tag(MonthlyRecurrence.MonthlyOption.lastWeekday)
                        Text("Last Day of Month").tag(MonthlyRecurrence.MonthlyOption.lastDayOfMonth)
                    }

                    // Show appropriate input based on selection
                    if monthlyOption == .specificDay {
                        Stepper("Day \(dayOfMonth)", value: $dayOfMonth, in: 1...31)
                            .font(.body)
                    } else if monthlyOption != .lastDayOfMonth {
                        // For weekday-based options
                        Picker("Weekday", selection: $selectedWeekday) {
                            ForEach(WeeklyRecurrence.Weekday.allCases) { day in
                                Text(day.fullName).tag(day)
                            }
                        }
                    }

                    // Show example
                    Text(exampleText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 4)
                }

                Section("Duration") {
                    DatePicker("Start Date", selection: .constant(startDate), displayedComponents: .date)
                        .disabled(true)

                    Toggle("Set End Date", isOn: $hasEndDate)

                    if hasEndDate {
                        DatePicker("End Date", selection: $endDate, in: startDate..., displayedComponents: .date)
                    }
                }

                Section {
                    Button("Schedule Workout") {
                        scheduleWorkout()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Monthly Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            // Initialize with current date's day
            let calendar = Calendar.current
            dayOfMonth = calendar.component(.day, from: startDate)
            selectedWeekday = WeeklyRecurrence.Weekday(rawValue: calendar.component(.weekday, from: startDate)) ?? .monday
        }
    }

    private var workoutName: String {
        if workoutType == .lift, let liftID = liftID {
            return store.lifts.first(where: { $0.id == liftID })?.name ?? "Unknown Lift"
        } else if workoutType == .wod, let wodID = wodID {
            return store.wods.first(where: { $0.id == wodID })?.title ?? "Unknown WOD"
        }
        return "Unknown"
    }

    private var exampleText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d, yyyy"

        switch monthlyOption {
        case .specificDay:
            return "Example: \(dayOfMonth)\(daySuffix(dayOfMonth)) of every month"
        case .firstWeekday:
            return "Example: First \(selectedWeekday.fullName) of every month"
        case .secondWeekday:
            return "Example: Second \(selectedWeekday.fullName) of every month"
        case .thirdWeekday:
            return "Example: Third \(selectedWeekday.fullName) of every month"
        case .fourthWeekday:
            return "Example: Fourth \(selectedWeekday.fullName) of every month"
        case .lastWeekday:
            return "Example: Last \(selectedWeekday.fullName) of every month"
        case .lastDayOfMonth:
            return "Example: Last day of every month"
        }
    }

    private func daySuffix(_ day: Int) -> String {
        switch day {
        case 1, 21, 31: return "st"
        case 2, 22: return "nd"
        case 3, 23: return "rd"
        default: return "th"
        }
    }

    private func scheduleWorkout() {
        // Get workout details
        let wodTitle = workoutName
        let wodDescription: String
        let wodIdString: String

        if workoutType == .lift, let liftID = liftID {
            wodDescription = ""
            wodIdString = liftID.uuidString
        } else if workoutType == .wod, let wodID = wodID {
            wodDescription = store.wods.first(where: { $0.id == wodID })?.description ?? ""
            wodIdString = wodID.uuidString
        } else {
            return
        }

        guard let userId = store.currentUser?.uid else { return }

        let monthlyRecurrence: MonthlyRecurrence

        switch monthlyOption {
        case .specificDay:
            monthlyRecurrence = MonthlyRecurrence.onDay(dayOfMonth)
        case .lastDayOfMonth:
            monthlyRecurrence = MonthlyRecurrence(
                option: .lastDayOfMonth,
                dayOfMonth: nil,
                weekOfMonth: nil,
                dayOfWeek: nil
            )
        case .firstWeekday:
            monthlyRecurrence = MonthlyRecurrence.onWeekday(week: 1, day: selectedWeekday)
        case .secondWeekday:
            monthlyRecurrence = MonthlyRecurrence.onWeekday(week: 2, day: selectedWeekday)
        case .thirdWeekday:
            monthlyRecurrence = MonthlyRecurrence.onWeekday(week: 3, day: selectedWeekday)
        case .fourthWeekday:
            monthlyRecurrence = MonthlyRecurrence.onWeekday(week: 4, day: selectedWeekday)
        case .lastWeekday:
            monthlyRecurrence = MonthlyRecurrence.onWeekday(week: 5, day: selectedWeekday)
        }

        var workout = ScheduledWorkout(
            wodId: wodIdString,
            wodTitle: wodTitle,
            wodDescription: wodDescription,
            date: startDate,
            groupId: nil,
            timeSlots: [],
            createdBy: userId,
            recurrenceType: .monthly,
            recurrenceEndDate: hasEndDate ? endDate : nil,
            weekdays: nil
        )

        // Set legacy property for monthly recurrence
        workout.monthlyRecurrence = monthlyRecurrence
        workout.startDate = startDate
        workout.endDate = hasEndDate ? endDate : nil

        store.addScheduledWorkout(workout)
    }
}

struct MonthlySchedulerView_Previews: PreviewProvider {
    static var previews: some View {
        MonthlySchedulerView(
            workoutType: .wod,
            liftID: nil,
            wodID: SampleData.wods.first?.id,
            startDate: Date()
        )
        .environmentObject(AppStore.shared)
    }
}
