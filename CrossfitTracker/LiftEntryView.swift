//
//  LiftEntryView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/19/25.
//

import SwiftUI
import FirebaseFirestore

struct LiftEntryView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    let lift: WOD

    @State private var selectedReps: Int = 1
    @State private var weight: String = ""
    @State private var notes: String = ""
    @State private var isSaving = false
    @State private var showPercentages = false
    @State private var savedResult: LiftResult?

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Lift Details")) {
                    Text(lift.title)
                        .font(.headline)
                    Text(lift.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Section(header: Text("Your Result")) {
                    // Reps Picker (1-5)
                    Picker("Reps", selection: $selectedReps) {
                        ForEach(1...5, id: \.self) { rep in
                            Text("\(rep) rep\(rep == 1 ? "" : "s")").tag(rep)
                        }
                    }
                    .pickerStyle(.segmented)

                    // Weight Input
                    HStack {
                        Text("Weight")
                        Spacer()
                        TextField("0", text: $weight)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                        Text("lbs")
                            .foregroundColor(.secondary)
                    }
                }

                Section(header: Text("Notes (Optional)")) {
                    TextEditor(text: $notes)
                        .frame(height: 80)
                }

                if let result = savedResult {
                    Section(header: Text("Estimated 1RM")) {
                        HStack {
                            Text("Your 1 Rep Max")
                            Spacer()
                            Text(String(format: "%.1f lbs", result.estimatedOneRepMax))
                                .font(.headline)
                                .foregroundColor(.blue)
                        }

                        Button(action: {
                            showPercentages = true
                        }) {
                            HStack {
                                Text("View Percentage Chart")
                                Spacer()
                                Image(systemName: "chart.bar.fill")
                            }
                        }
                    }
                }
            }
            .navigationTitle("Record Lift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveLift()
                    }
                    .disabled(weight.isEmpty || isSaving)
                }
            }
            .sheet(isPresented: $showPercentages) {
                if let result = savedResult {
                    LiftPercentageView(result: result)
                }
            }
        }
    }

    private func saveLift() {
        guard let weightValue = Double(weight), weightValue > 0 else {
            return
        }

        isSaving = true

        let result = LiftResult(
            userId: store.userId,
            userName: store.userName,
            liftTitle: lift.title,
            weight: weightValue,
            reps: selectedReps,
            date: Date(),
            notes: notes.isEmpty ? nil : notes
        )

        let db = Firestore.firestore()
        do {
            _ = try db.collection("liftResults").addDocument(from: result)
            savedResult = result
            print("✅ Lift result saved successfully!")
        } catch {
            print("❌ Error saving lift result: \(error.localizedDescription)")
        }

        isSaving = false
    }
}
