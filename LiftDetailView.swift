//
//  LiftDetailView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

import SwiftUI
import Charts

struct LiftDetailView: View {
    @EnvironmentObject var store: AppStore
    var lift: Lift

    @State private var selectedReps: Int = 1
    @State private var inputWeight: String = ""
    @State private var entryDate: Date = Date()
    @State private var editingEntry: LiftEntry? = nil
    @State private var showingEditSheet = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text(lift.name)
                    .font(.largeTitle.bold())
                    .padding(.top)

                Picker("Reps", selection: $selectedReps) {
                    Text("1 rep").tag(1)
                    Text("2 reps").tag(2)
                    Text("3 reps").tag(3)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                if let recent = store.mostRecentWeight(for: lift, reps: selectedReps) {
                    Text("Most recent for \(selectedReps) rep(s): \(formatWeight(recent))")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    Text("No recent entry for \(selectedReps) rep(s)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                VStack(spacing: 8) {
                    HStack {
                        TextField("Enter max weight (lbs)", text: $inputWeight)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        DatePicker("", selection: $entryDate, displayedComponents: .date)
                            .labelsHidden()
                    }

                    Button("Add / Log") {
                        submitManualEntry()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(Double(inputWeight) == nil)
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Percent Calculator")
                        .font(.headline)

                    ForEach(percentages(), id: \.self) { pct in
                        HStack {
                            Text("\(Int(pct))%")
                                .frame(width: 60, alignment: .leading)
                            Spacer()
                            let base = store.mostRecentWeight(for: lift, reps: selectedReps) ?? (Double(inputWeight) ?? 0)
                            let value = base * (pct / 100.0)
                            Text(formatWeight(value))
                                .font(.body.monospacedDigit())
                        }
                    }
                }
                .padding()
                .background(Color(.systemGroupedBackground))
                .cornerRadius(12)
                .padding(.horizontal)

                VStack(alignment: .leading) {
                    Text("Progress Over Time (\(selectedReps) rep(s))")
                        .font(.headline)
                        .padding(.horizontal)

                    if entriesForSelectedReps().isEmpty {
                        Text("No entries yet")
                            .foregroundColor(.gray)
                            .padding()
                    } else {
                        Chart {
                            ForEach(entriesForSelectedReps()) { entry in
                                LineMark(
                                    x: .value("Date", entry.date),
                                    y: .value("Weight", entry.weight)
                                )
                                PointMark(
                                    x: .value("Date", entry.date),
                                    y: .value("Weight", entry.weight)
                                )
                            }
                        }
                        .chartYScale(domain: chartYDomain())
                        .frame(height: 220)
                        .padding()
                    }

                    List {
                        ForEach(entriesForSelectedReps().reversed()) { entry in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(formatWeight(entry.weight))
                                    Text(entry.date, style: .date)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                Button("Edit") {
                                    editingEntry = entry
                                    showingEditSheet = true
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        .onDelete { idxSet in
                            let all = Array(entriesForSelectedReps().reversed())
                            for idx in idxSet {
                                store.deleteLiftEntry(entryID: all[idx].id)
                            }
                        }
                    }
                    .frame(height: 260)
                }
            }
            .padding(.bottom)
        }
        .navigationTitle(lift.name)
        .sheet(isPresented: $showingEditSheet, onDismiss: { editingEntry = nil }) {
            if let edit = editingEntry {
                EditLiftEntrySheet(entry: edit) { newWeight, newReps, newDate in
                    store.editLiftEntry(entryID: edit.id, newWeight: newWeight, newReps: newReps, newDate: newDate)
                    showingEditSheet = false
                } onCancel: {
                    showingEditSheet = false
                }
            }
        }
    }

    // MARK: - Helpers
    func submitManualEntry() {
        guard let w = Double(inputWeight) else { return }
        store.addLiftEntry(lift: lift, weight: w, reps: selectedReps, date: entryDate)
        inputWeight = ""
        entryDate = Date()
    }

    func entriesForSelectedReps() -> [LiftEntry] {
        store.entries(for: lift, reps: selectedReps)
    }

    func percentages() -> [Double] {
        Array(stride(from: 115, through: 60, by: -10))
    }

    func formatWeight(_ w: Double) -> String {
        String(format: "%.1f lb", w)
    }

    func chartYDomain() -> ClosedRange<Double> {
        let vals = entriesForSelectedReps().map { $0.weight }
        if let max = vals.max(), let min = vals.min() {
            let padding = max * 0.1
            return (min - padding)...(max + padding)
        } else {
            return 0...100
        }
    }
}

// MARK: - Edit Sheet
struct EditLiftEntrySheet: View {
    var entry: LiftEntry
    var onSave: (Double, Int, Date) -> Void
    var onCancel: () -> Void

    @State private var weightText: String
    @State private var reps: Int
    @State private var date: Date

    init(entry: LiftEntry, onSave: @escaping (Double, Int, Date) -> Void, onCancel: @escaping () -> Void) {
        self.entry = entry
        self.onSave = onSave
        self.onCancel = onCancel
        _weightText = State(initialValue: String(format: "%.1f", entry.weight))
        _reps = State(initialValue: entry.reps)
        _date = State(initialValue: entry.date)
    }

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Edit Entry")) {
                    TextField("Weight", text: $weightText)
                        .keyboardType(.decimalPad)
                    Picker("Reps", selection: $reps) {
                        ForEach(1...10, id: \.self) { r in Text("\(r)").tag(r) }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
            }
            .navigationTitle("Edit Entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onCancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let w = Double(weightText) {
                            onSave(w, reps, date)
                        }
                    }
                }
            }
        }
    }
}
