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
    @State private var entryDate: Date = Date()
    @State private var isSaving = false
    @State private var history: [LiftResult] = []
    @State private var editingEntry: LiftResult?
    @State private var isEditing = false

    private var mostRecentResult: LiftResult? {
        history.first
    }

    private var mostRecent1RM: Double? {
        mostRecentResult?.estimatedOneRepMax
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 12) {
                    // Entry Form
                    VStack(alignment: .leading, spacing: 12) {
                        Text(lift.title)
                            .font(.headline)
                            .fontWeight(.bold)

                        // Reps and Weight in one row
                        HStack(spacing: 12) {
                            // Reps Picker (1-5)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Reps")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Picker("Reps", selection: $selectedReps) {
                                    ForEach(1...5, id: \.self) { rep in
                                        Text("\(rep)").tag(rep)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }

                            // Weight Input
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Weight")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                HStack {
                                    TextField("0", text: $weight)
                                        .keyboardType(.decimalPad)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 80)
                                    Text("lbs")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }

                        // Date and Notes
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Date")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                DatePicker("", selection: $entryDate, displayedComponents: .date)
                                    .labelsHidden()
                                    .frame(maxWidth: .infinity)
                            }
                        }

                        // Notes
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Notes")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            TextEditor(text: $notes)
                                .frame(height: 60)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                )
                        }

                        // Save/Update Button
                        Button(action: {
                            if isEditing {
                                updateEntry()
                            } else {
                                saveLift()
                            }
                        }) {
                            Text(isEditing ? "Update" : "Save")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(weight.isEmpty || isSaving ? Color.gray : Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                        .disabled(weight.isEmpty || isSaving)

                        if isEditing {
                            Button(action: {
                                cancelEdit()
                            }) {
                                Text("Cancel")
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(Color.gray.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(.systemBackground))

                    // Percentage Chart (based on most recent history)
                    if let oneRM = mostRecent1RM {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Training %")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Spacer()
                                Text("1RM: \(String(format: "%.0f", oneRM)) lbs")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                            .padding(.horizontal, 12)

                            VStack(spacing: 4) {
                                ForEach(Array(stride(from: 100, through: 50, by: -5)), id: \.self) { percentage in
                                    let weight = oneRM * (Double(percentage) / 100.0)
                                    HStack(spacing: 8) {
                                        Text("\(percentage)%")
                                            .font(.system(.caption, design: .monospaced))
                                            .frame(width: 40, alignment: .leading)
                                            .foregroundColor(colorForPercentage(percentage))

                                        Rectangle()
                                            .fill(colorForPercentage(percentage).opacity(0.3))
                                            .frame(width: CGFloat(percentage) * 1.2, height: 18)

                                        Spacer()

                                        Text(String(format: "%.0f", weight))
                                            .font(.system(.caption, design: .monospaced))
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .padding(.horizontal, 12)
                        }
                        .padding(.vertical, 8)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                        .padding(.horizontal, 12)
                    }

                    // History
                    if !history.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("History")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 12)

                            ForEach(history) { entry in
                                Button(action: {
                                    editEntry(entry)
                                }) {
                                    HStack(spacing: 8) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(entry.date, style: .date)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Text("\(entry.weight, specifier: "%.1f") × \(entry.reps)")
                                                .font(.subheadline)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.primary)
                                            if let notes = entry.notes, !notes.isEmpty {
                                                Text(notes)
                                                    .font(.caption2)
                                                    .foregroundColor(.secondary)
                                                    .lineLimit(1)
                                            }
                                        }

                                        Spacer()

                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text("1RM")
                                                .font(.caption2)
                                                .foregroundColor(.secondary)
                                            Text(String(format: "%.0f", entry.estimatedOneRepMax))
                                                .font(.subheadline)
                                                .fontWeight(.bold)
                                                .foregroundColor(.blue)
                                        }

                                        Image(systemName: "chevron.right")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(10)
                                    .background(Color(.systemBackground))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(PlainButtonStyle())
                                .contextMenu {
                                    Button(role: .destructive) {
                                        deleteEntry(entry)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                            .padding(.horizontal, 12)
                        }
                        .padding(.vertical, 8)
                    }
                }
                .padding(.vertical, 8)
            }
            .navigationTitle(lift.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadHistory()
            }
        }
    }

    private func colorForPercentage(_ percentage: Int) -> Color {
        switch percentage {
        case 50...65:
            return .green
        case 70...80:
            return .orange
        case 85...95:
            return .red
        case 100...:
            return .purple
        default:
            return .primary
        }
    }

    private func loadHistory() {
        guard let userId = store.currentUser?.uid else {
            return
        }

        let db = Firestore.firestore()
        db.collection("liftResults")
            .whereField("userId", isEqualTo: userId)
            .whereField("liftTitle", isEqualTo: lift.title)
            .getDocuments { snapshot, error in
                if let error = error {
                    print("❌ Error loading lift history: \(error.localizedDescription)")
                    return
                }

                var results = snapshot?.documents.compactMap { doc -> LiftResult? in
                    try? doc.data(as: LiftResult.self)
                } ?? []

                // Sort by date, most recent first
                results.sort { $0.date > $1.date }

                DispatchQueue.main.async {
                    self.history = results
                    print("✅ Loaded \(results.count) lift history entries")
                }
            }
    }

    private func saveLift() {
        guard let weightValue = Double(weight), weightValue > 0 else {
            return
        }

        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            isSaving = false
            return
        }

        isSaving = true

        let result = LiftResult(
            userId: userId,
            userName: store.userName,
            liftTitle: lift.title,
            weight: weightValue,
            reps: selectedReps,
            date: entryDate,
            notes: notes.isEmpty ? nil : notes
        )

        let db = Firestore.firestore()
        do {
            _ = try db.collection("liftResults").addDocument(from: result)
            print("✅ Lift result saved successfully!")

            // Clear form and reload history
            weight = ""
            notes = ""
            entryDate = Date()
            selectedReps = 1
            loadHistory()
        } catch {
            print("❌ Error saving lift result: \(error.localizedDescription)")
        }

        isSaving = false
    }

    private func editEntry(_ entry: LiftResult) {
        editingEntry = entry
        isEditing = true
        weight = String(entry.weight)
        selectedReps = entry.reps
        entryDate = entry.date
        notes = entry.notes ?? ""
    }

    private func cancelEdit() {
        editingEntry = nil
        isEditing = false
        weight = ""
        selectedReps = 1
        entryDate = Date()
        notes = ""
    }

    private func updateEntry() {
        guard let entry = editingEntry,
              let entryId = entry.id,
              let weightValue = Double(weight), weightValue > 0 else {
            return
        }

        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            return
        }

        isSaving = true

        let updatedResult = LiftResult(
            id: entryId,
            userId: userId,
            userName: store.userName,
            liftTitle: lift.title,
            weight: weightValue,
            reps: selectedReps,
            date: entryDate,
            notes: notes.isEmpty ? nil : notes
        )

        let db = Firestore.firestore()
        do {
            try db.collection("liftResults").document(entryId).setData(from: updatedResult)
            print("✅ Lift result updated successfully!")

            // Clear form and reload history
            cancelEdit()
            loadHistory()
        } catch {
            print("❌ Error updating lift result: \(error.localizedDescription)")
        }

        isSaving = false
    }

    private func deleteEntry(_ entry: LiftResult) {
        guard let entryId = entry.id else {
            return
        }

        let db = Firestore.firestore()
        db.collection("liftResults").document(entryId).delete { error in
            if let error = error {
                print("❌ Error deleting lift result: \(error.localizedDescription)")
            } else {
                print("✅ Lift result deleted successfully!")
                loadHistory()
            }
        }
    }
}
