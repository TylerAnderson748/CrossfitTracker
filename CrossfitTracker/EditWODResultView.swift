//
//  EditWODResultView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import SwiftUI

struct EditWODResultView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    let wodResult: CompletedWOD

    @State private var minutes: String = ""
    @State private var seconds: String = ""
    @State private var selectedDate: Date = Date()
    @State private var selectedCategory: WODCategory = .rx
    @State private var errorMessage: String?

    init(wodResult: CompletedWOD) {
        self.wodResult = wodResult
        // Initialize state in onAppear instead to avoid issues with State initialization
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Workout") {
                    Text(wodResult.wod.title)
                        .font(.headline)
                }

                Section("Time") {
                    HStack(spacing: 8) {
                        TextField("Min", text: $minutes)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)

                        Text(":").font(.title2)

                        TextField("Sec", text: $seconds)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)
                    }

                    if let errorMessage = errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }

                Section("Date") {
                    DatePicker("Completion Date", selection: $selectedDate, displayedComponents: [.date, .hourAndMinute])
                }

                Section("Category") {
                    Picker("Category", selection: $selectedCategory) {
                        Text("RX+").tag(WODCategory.rxPlus)
                        Text("RX").tag(WODCategory.rx)
                        Text("Scaled").tag(WODCategory.scaled)
                        Text("Just Happy To Be Here").tag(WODCategory.happy)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Edit Result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveChanges()
                    }
                }
            }
            .onAppear {
                // Initialize values from the existing WOD result
                let totalSeconds = Int(wodResult.time)
                minutes = String(totalSeconds / 60)
                seconds = String(totalSeconds % 60)
                selectedDate = wodResult.date
                selectedCategory = wodResult.category
            }
        }
    }

    private func saveChanges() {
        // Clear any previous error
        errorMessage = nil

        // Validate minutes
        let minutesStr = minutes.trimmingCharacters(in: .whitespaces)
        let secondsStr = seconds.trimmingCharacters(in: .whitespaces)

        guard let m = Int(minutesStr), m >= 0 else {
            errorMessage = "Please enter valid minutes (0 or greater)"
            return
        }

        guard let s = Int(secondsStr), s >= 0, s < 60 else {
            errorMessage = "Please enter valid seconds (0-59)"
            return
        }

        let totalTime = TimeInterval(m * 60 + s)

        guard totalTime > 0 else {
            errorMessage = "Total time must be greater than 0"
            return
        }

        // Save the changes
        store.editCompletedWOD(
            entryID: wodResult.id,
            newTime: totalTime,
            newDate: selectedDate,
            newCategory: selectedCategory
        )

        dismiss()
    }
}
