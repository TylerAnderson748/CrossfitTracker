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

    // Get the most recent entry for the currently selected rep count
    private var mostRecentForReps: LiftResult? {
        history.first { $0.reps == selectedReps }
    }

    // Get the actual weight from most recent entry for selected reps
    private var currentWeight: Double? {
        mostRecentForReps?.weight
    }

    // Get entries filtered by selected rep count
    private var filteredHistory: [LiftResult] {
        history.filter { $0.reps == selectedReps }
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 8) {
                    // Entry Form
                    VStack(alignment: .leading, spacing: 8) {
                        Text(lift.title)
                            .font(.headline)
                            .fontWeight(.bold)

                        // Reps and Weight in one row
                        HStack(spacing: 8) {
                            // Reps Picker (1-5)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Reps")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Picker("Reps", selection: $selectedReps) {
                                    ForEach(1...5, id: \.self) { rep in
                                        Text("\(rep)").tag(rep)
                                    }
                                }
                                .pickerStyle(.segmented)
                                .onChange(of: selectedReps) { _ in
                                    updateWeightForReps()
                                }
                            }

                            // Weight Input
                            VStack(alignment: .leading, spacing: 2) {
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
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Date")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                DatePicker("", selection: $entryDate, displayedComponents: .date)
                                    .labelsHidden()
                                    .frame(maxWidth: .infinity)
                            }
                        }

                        // Notes
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Notes")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            TextEditor(text: $notes)
                                .frame(height: 50)
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
                                .padding(.vertical, 8)
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
                                    .padding(.vertical, 6)
                                    .background(Color.gray.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(10)
                    .background(Color(.systemBackground))

                    // Percentage Chart (based on most recent weight for selected reps)
                    if let baseWeight = currentWeight, let recent = mostRecentForReps {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Training %")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Spacer()
                                Text("Latest: \(String(format: "%.0f", recent.weight)) × \(recent.reps)")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                            .padding(.horizontal, 10)

                            VStack(spacing: 1) {
                                ForEach(Array(stride(from: 100, through: 50, by: -5)), id: \.self) { percentage in
                                    let weight = baseWeight * (Double(percentage) / 100.0)
                                    HStack(spacing: 6) {
                                        Text("\(percentage)%")
                                            .font(.system(.caption2, design: .monospaced))
                                            .frame(width: 35, alignment: .leading)
                                            .foregroundColor(colorForPercentage(percentage))

                                        Spacer()

                                        Text(String(format: "%.0f", weight))
                                            .font(.system(.caption2, design: .monospaced))
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .padding(.horizontal, 10)
                        }
                        .padding(.vertical, 6)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                        .padding(.horizontal, 10)
                    }

                    // Progress Chart (filtered by selected reps)
                    if filteredHistory.count > 1 {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Progress (\(selectedReps) rep\(selectedReps == 1 ? "" : "s"))")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 10)

                            LineChartView(entries: filteredHistory)
                                .frame(height: 100)
                                .padding(.horizontal, 10)
                        }
                        .padding(.vertical, 6)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                        .padding(.horizontal, 10)
                    }

                    // History
                    if !history.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("History")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 10)

                            ForEach(history) { entry in
                                Button(action: {
                                    editEntry(entry)
                                }) {
                                    HStack(spacing: 6) {
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
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(8)
                                    .background(Color(.systemBackground))
                                    .cornerRadius(6)
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
                            .padding(.horizontal, 10)
                        }
                        .padding(.vertical, 6)
                    }
                }
                .padding(.vertical, 6)
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

                    // Pre-fill weight with last known for selected reps
                    if !self.isEditing {
                        self.updateWeightForReps()
                    }
                }
            }
    }

    private func updateWeightForReps() {
        // Don't update if we're editing an existing entry
        if isEditing { return }

        // Find most recent entry for selected rep count
        if let recentEntry = history.first(where: { $0.reps == selectedReps }) {
            weight = String(format: "%.1f", recentEntry.weight)
        } else {
            weight = ""
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

// MARK: - Line Chart View
struct LineChartView: View {
    let entries: [LiftResult]

    private var sortedEntries: [LiftResult] {
        entries.sorted { $0.date < $1.date }
    }

    private var maxWeight: Double {
        sortedEntries.map { $0.estimatedOneRepMax }.max() ?? 100
    }

    private var minWeight: Double {
        let min = sortedEntries.map { $0.estimatedOneRepMax }.min() ?? 0
        return max(0, min - 20) // Add some padding below
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                // Grid lines
                VStack(spacing: 0) {
                    ForEach(0..<5) { i in
                        HStack {
                            let value = maxWeight - (Double(i) * (maxWeight - minWeight) / 4)
                            Text(String(format: "%.0f", value))
                                .font(.system(size: 8))
                                .foregroundColor(.secondary)
                                .frame(width: 30, alignment: .trailing)

                            Rectangle()
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 0.5)
                        }
                        if i < 4 {
                            Spacer()
                        }
                    }
                }

                // Line chart
                Path { path in
                    guard !sortedEntries.isEmpty else { return }

                    let width = geometry.size.width - 35
                    let height = geometry.size.height
                    let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))

                    for (index, entry) in sortedEntries.enumerated() {
                        let x = 35 + CGFloat(index) * xStep
                        let normalizedValue = (entry.estimatedOneRepMax - minWeight) / (maxWeight - minWeight)
                        let y = height - (CGFloat(normalizedValue) * height)

                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(Color.blue, lineWidth: 2)

                // Data points
                ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                    let width = geometry.size.width - 35
                    let height = geometry.size.height
                    let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))
                    let x = 35 + CGFloat(index) * xStep
                    let normalizedValue = (entry.estimatedOneRepMax - minWeight) / (maxWeight - minWeight)
                    let y = height - (CGFloat(normalizedValue) * height)

                    Circle()
                        .fill(Color.blue)
                        .frame(width: 6, height: 6)
                        .position(x: x, y: y)
                }
            }
        }
        .padding(.vertical, 8)
    }
}

