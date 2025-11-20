import SwiftUI

struct WeeklySchedulerView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    let workoutType: WorkoutType
    let liftID: UUID?
    let wodID: UUID?
    let startDate: Date

    @State private var selectedDays: Set<WeeklyRecurrence.Weekday> = []
    @State private var hasEndDate = false
    @State private var endDate = Date()

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text(workoutName)
                        .font(.headline)
                    Text("Repeats Weekly")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Section("Select Days") {
                    ForEach(WeeklyRecurrence.Weekday.allCases) { day in
                        Button(action: {
                            toggleDay(day)
                        }) {
                            HStack {
                                Text(day.fullName)
                                    .foregroundColor(.primary)
                                Spacer()
                                if selectedDays.contains(day) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                } else {
                                    Image(systemName: "circle")
                                        .foregroundColor(.gray)
                                }
                            }
                        }
                    }

                    if selectedDays.isEmpty {
                        Text("Select at least one day")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
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
                    .disabled(selectedDays.isEmpty)
                }
            }
            .navigationTitle("Weekly Schedule")
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

    private var workoutName: String {
        if workoutType == .lift, let liftID = liftID {
            return store.lifts.first(where: { $0.id == liftID })?.name ?? "Unknown Lift"
        } else if workoutType == .wod, let wodID = wodID {
            return store.wods.first(where: { $0.id == wodID })?.title ?? "Unknown WOD"
        }
        return "Unknown"
    }

    private func toggleDay(_ day: WeeklyRecurrence.Weekday) {
        if selectedDays.contains(day) {
            selectedDays.remove(day)
        } else {
            selectedDays.insert(day)
        }
    }

    private func scheduleWorkout() {
        let weeklyRecurrence = WeeklyRecurrence(selectedDays: selectedDays)

        let workout = ScheduledWorkout(
            workoutType: workoutType,
            liftID: liftID,
            wodID: wodID,
            recurrenceType: .weekly,
            weeklyRecurrence: weeklyRecurrence,
            monthlyRecurrence: nil,
            startDate: startDate,
            endDate: hasEndDate ? endDate : nil
        )

        store.addScheduledWorkout(workout)
    }
}

#Preview {
    WeeklySchedulerView(
        workoutType: .wod,
        liftID: nil,
        wodID: SampleData.wods.first?.id,
        startDate: Date()
    )
    .environmentObject(AppStore.shared)
}
