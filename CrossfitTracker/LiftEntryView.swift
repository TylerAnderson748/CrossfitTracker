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
                VStack(spacing: 20) {
                    // Entry Form
                    VStack(alignment: .leading, spacing: 16) {
                        Text(lift.title)
                            .font(.title2)
                            .fontWeight(.bold)

                        // Reps Picker (1-5)
                        VStack(alignment: .leading) {
                            Text("Reps")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Picker("Reps", selection: $selectedReps) {
                                ForEach(1...5, id: \.self) { rep in
                                    Text("\(rep)").tag(rep)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        // Weight Input
                        VStack(alignment: .leading) {
                            Text("Weight (lbs)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            HStack {
                                TextField("0", text: $weight)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 100)
                                Text("lbs")
                                    .foregroundColor(.secondary)
                            }
                        }

                        // Date Picker
                        VStack(alignment: .leading) {
                            Text("Date")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            DatePicker("", selection: $entryDate, displayedComponents: .date)
                                .labelsHidden()
                        }

                        // Notes
                        VStack(alignment: .leading) {
                            Text("Notes (Optional)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            TextEditor(text: $notes)
                                .frame(height: 80)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                )
                        }

                        Button(action: {
                            if isEditing {
                                updateEntry()
                            } else {
                                saveLift()
                            }
                        }) {
                            Text(isEditing ? "Update Entry" : "Save Entry")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(weight.isEmpty || isSaving ? Color.gray : Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                        .disabled(weight.isEmpty || isSaving)

                        if isEditing {
                            Button(action: {
                                cancelEdit()
                            }) {
                                Text("Cancel Edit")
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.gray.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(10)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))

                    // Percentage Chart (based on most recent history)
                    if let oneRM = mostRecent1RM {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Training Percentages")
                                    .font(.headline)
                                Spacer()
                                Text("1RM: \(String(format: "%.1f", oneRM)) lbs")
                                    .font(.subheadline)
                                    .foregroundColor(.blue)
                            }
                            .padding(.horizontal)

                            VStack(spacing: 8) {
                                ForEach(Array(stride(from: 100, through: 50, by: -5)), id: \.self) { percentage in
                                    let weight = oneRM * (Double(percentage) / 100.0)
                                    HStack {
                                        Text("\(percentage)%")
                                            .font(.system(.body, design: .monospaced))
                                            .frame(width: 50, alignment: .leading)
                                            .foregroundColor(colorForPercentage(percentage))

                                        Rectangle()
                                            .fill(colorForPercentage(percentage).opacity(0.3))
                                            .frame(width: CGFloat(percentage) * 1.5, height: 24)

                                        Spacer()

                                        Text(String(format: "%.1f lbs", weight))
                                            .font(.system(.body, design: .monospaced))
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.vertical)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

                    // History
                    if !history.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("History")
                                .font(.headline)
                                .padding(.horizontal)

                            ForEach(history) { entry in
                                Button(action: {
                                    editEntry(entry)
                                }) {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(entry.date, style: .date)
                                                .font(.subheadline)
                                                .foregroundColor(.primary)
                                            Text("\(entry.weight, specifier: "%.1f") lbs × \(entry.reps) rep\(entry.reps == 1 ? "" : "s")")
                                                .font(.body)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.primary)
                                            if let notes = entry.notes, !notes.isEmpty {
                                                Text(notes)
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                            }
                                        }

                                        Spacer()

                                        VStack(alignment: .trailing) {
                                            Text("1RM")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Text(String(format: "%.1f", entry.estimatedOneRepMax))
                                                .font(.headline)
                                                .foregroundColor(.blue)
                                        }

                                        Image(systemName: "chevron.right")
                                            .foregroundColor(.secondary)
                                    }
                                    .padding()
                                    .background(Color(.systemBackground))
                                    .cornerRadius(10)
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
                            .padding(.horizontal)
                        }
                        .padding(.vertical)
                    }
                }
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
