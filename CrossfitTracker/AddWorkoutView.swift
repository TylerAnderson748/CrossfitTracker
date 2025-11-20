import SwiftUI

struct AddWorkoutView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    @State private var workoutType: WorkoutType = .wod
    @State private var selectedLift: Lift?
    @State private var selectedWOD: WOD?
    @State private var showCreateLift = false
    @State private var showCreateWOD = false
    @State private var newLiftName = ""
    @State private var newWODTitle = ""
    @State private var newWODDescription = ""

    // For scheduling
    @State private var recurrenceType: RecurrenceType = .once
    @State private var selectedDate = Date()
    @State private var showScheduler = false

    var body: some View {
        NavigationView {
            Form {
                // Workout Type Selection
                Section("Workout Type") {
                    Picker("Type", selection: $workoutType) {
                        ForEach(WorkoutType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                // Workout Selection based on type
                if workoutType == .lift {
                    liftSelectionSection
                } else {
                    wodSelectionSection
                }

                // Schedule section
                Section("When") {
                    Picker("Schedule", selection: $recurrenceType) {
                        ForEach(RecurrenceType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }

                    if recurrenceType == .once {
                        DatePicker("Date", selection: $selectedDate, displayedComponents: .date)
                    }
                }

                // Action Buttons
                Section {
                    if recurrenceType != .once {
                        Button("Set Schedule") {
                            showScheduler = true
                        }
                        .disabled(!canProceed)
                    } else {
                        Button("Add Workout") {
                            addOneTimeWorkout()
                            dismiss()
                        }
                        .disabled(!canProceed)
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
            .sheet(isPresented: $showCreateLift) {
                createLiftSheet
            }
            .sheet(isPresented: $showCreateWOD) {
                createWODSheet
            }
            .sheet(isPresented: $showScheduler) {
                if recurrenceType == .weekly {
                    WeeklySchedulerView(
                        workoutType: workoutType,
                        liftID: selectedLift?.id,
                        wodID: selectedWOD?.id,
                        startDate: selectedDate
                    )
                    .environmentObject(store)
                } else if recurrenceType == .monthly {
                    MonthlySchedulerView(
                        workoutType: workoutType,
                        liftID: selectedLift?.id,
                        wodID: selectedWOD?.id,
                        startDate: selectedDate
                    )
                    .environmentObject(store)
                }
            }
        }
    }

    // MARK: - Lift Selection Section
    private var liftSelectionSection: some View {
        Section("Select Lift") {
            if store.lifts.isEmpty {
                Text("No lifts available")
                    .foregroundColor(.secondary)
            } else {
                Picker("Lift", selection: $selectedLift) {
                    Text("Select a lift...").tag(nil as Lift?)
                    ForEach(store.lifts) { lift in
                        Text(lift.name).tag(lift as Lift?)
                    }
                }
            }

            Button(action: {
                showCreateLift = true
            }) {
                Label("Create New Lift", systemImage: "plus.circle.fill")
            }
        }
    }

    // MARK: - WOD Selection Section
    private var wodSelectionSection: some View {
        Section("Select WOD") {
            if store.wods.isEmpty {
                Text("No WODs available")
                    .foregroundColor(.secondary)
            } else {
                Picker("WOD", selection: $selectedWOD) {
                    Text("Select a WOD...").tag(nil as WOD?)
                    ForEach(store.wods) { wod in
                        VStack(alignment: .leading) {
                            Text(wod.title).tag(wod as WOD?)
                            Text(wod.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            Button(action: {
                showCreateWOD = true
            }) {
                Label("Create New WOD", systemImage: "plus.circle.fill")
            }
        }
    }

    // MARK: - Create Lift Sheet
    private var createLiftSheet: some View {
        NavigationView {
            Form {
                Section("Lift Details") {
                    TextField("Lift Name", text: $newLiftName)
                }

                Section {
                    Button("Create Lift") {
                        createLift()
                    }
                    .disabled(newLiftName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("New Lift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showCreateLift = false
                        newLiftName = ""
                    }
                }
            }
        }
    }

    // MARK: - Create WOD Sheet
    private var createWODSheet: some View {
        NavigationView {
            Form {
                Section("WOD Details") {
                    TextField("WOD Name", text: $newWODTitle)
                    TextField("Description", text: $newWODDescription, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section {
                    Button("Create WOD") {
                        createWOD()
                    }
                    .disabled(newWODTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("New WOD")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showCreateWOD = false
                        newWODTitle = ""
                        newWODDescription = ""
                    }
                }
            }
        }
    }

    // MARK: - Helpers
    private var canProceed: Bool {
        if workoutType == .lift {
            return selectedLift != nil
        } else {
            return selectedWOD != nil
        }
    }

    private func createLift() {
        let trimmed = newLiftName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        store.addLift(name: trimmed)
        // Auto-select the newly created lift
        selectedLift = store.lifts.last

        showCreateLift = false
        newLiftName = ""
    }

    private func createWOD() {
        let trimmedTitle = newWODTitle.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return }

        store.addWOD(title: trimmedTitle, description: newWODDescription)
        // Auto-select the newly created WOD
        selectedWOD = store.wods.last

        showCreateWOD = false
        newWODTitle = ""
        newWODDescription = ""
    }

    private func addOneTimeWorkout() {
        let workout = ScheduledWorkout(
            workoutType: workoutType,
            liftID: selectedLift?.id,
            wodID: selectedWOD?.id,
            recurrenceType: .once,
            weeklyRecurrence: nil,
            monthlyRecurrence: nil,
            startDate: selectedDate,
            endDate: nil
        )

        store.addScheduledWorkout(workout)
    }
}

struct AddWorkoutView_Previews: PreviewProvider {
    static var previews: some View {
        AddWorkoutView()
            .environmentObject(AppStore.shared)
    }
}
