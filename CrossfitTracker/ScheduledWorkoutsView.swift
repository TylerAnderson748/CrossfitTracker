import SwiftUI

struct ScheduledWorkoutsView: View {
    @EnvironmentObject var store: AppStore
    @State private var showAddWorkout = false
    @State private var selectedDate = Date()

    var body: some View {
        NavigationView {
            List {
                // Today's Workouts Section
                Section("Today's Workouts") {
                    let todaysWorkouts = store.scheduledWorkouts(for: Date())
                    if todaysWorkouts.isEmpty {
                        Text("No workouts scheduled for today")
                            .foregroundColor(.secondary)
                            .italic()
                    } else {
                        ForEach(todaysWorkouts) { workout in
                            WorkoutRow(workout: workout)
                        }
                    }
                }

                // All Scheduled Workouts
                Section("All Scheduled Workouts") {
                    if store.scheduledWorkouts.isEmpty {
                        Text("No scheduled workouts")
                            .foregroundColor(.secondary)
                            .italic()
                    } else {
                        ForEach(store.scheduledWorkouts) { workout in
                            WorkoutRow(workout: workout)
                        }
                        .onDelete(perform: deleteWorkout)
                    }
                }
            }
            .navigationTitle("Scheduled Workouts")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        showAddWorkout = true
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddWorkout) {
                AddWorkoutView()
                    .environmentObject(store)
            }
        }
    }

    private func deleteWorkout(at offsets: IndexSet) {
        for index in offsets {
            let workout = store.scheduledWorkouts[index]
            store.deleteScheduledWorkout(id: workout.id)
        }
    }
}

struct WorkoutRow: View {
    @EnvironmentObject var store: AppStore
    let workout: ScheduledWorkout

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: workout.workoutType == .lift ? "figure.strengthtraining.traditional" : "flame.fill")
                        .foregroundColor(workout.workoutType == .lift ? .blue : .orange)

                    Text(store.workoutName(for: workout))
                        .font(.headline)

                    if !workout.isActive {
                        Text("(Paused)")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }

                Text(recurrenceDescription)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                if let endDate = workout.endDate {
                    Text("Until \(dateFormatter.string(from: endDate))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { workout.isActive },
                set: { _ in store.toggleScheduledWorkout(id: workout.id) }
            ))
            .labelsHidden()
        }
        .opacity(workout.isActive ? 1.0 : 0.6)
    }

    private var recurrenceDescription: String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .none

        switch workout.recurrenceType {
        case .once:
            return "Once on \(dateFormatter.string(from: workout.startDate))"

        case .weekly:
            if let weekly = workout.weeklyRecurrence {
                let days = weekly.selectedDays
                    .sorted(by: { $0.rawValue < $1.rawValue })
                    .map { $0.shortName }
                    .joined(separator: ", ")
                return "Weekly: \(days)"
            }
            return "Weekly"

        case .monthly:
            if let monthly = workout.monthlyRecurrence {
                switch monthly.option {
                case .specificDay:
                    if let day = monthly.dayOfMonth {
                        return "Monthly on day \(day)"
                    }
                case .lastDayOfMonth:
                    return "Monthly on last day"
                case .firstWeekday:
                    if let day = monthly.dayOfWeek {
                        return "First \(day.fullName) of month"
                    }
                case .secondWeekday:
                    if let day = monthly.dayOfWeek {
                        return "Second \(day.fullName) of month"
                    }
                case .thirdWeekday:
                    if let day = monthly.dayOfWeek {
                        return "Third \(day.fullName) of month"
                    }
                case .fourthWeekday:
                    if let day = monthly.dayOfWeek {
                        return "Fourth \(day.fullName) of month"
                    }
                case .lastWeekday:
                    if let day = monthly.dayOfWeek {
                        return "Last \(day.fullName) of month"
                    }
                }
            }
            return "Monthly"
        }
    }
}

struct ScheduledWorkoutsView_Previews: PreviewProvider {
    static var previews: some View {
        ScheduledWorkoutsView()
            .environmentObject(AppStore.shared)
    }
}
