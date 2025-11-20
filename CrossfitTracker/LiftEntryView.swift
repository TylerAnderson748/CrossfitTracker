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
    @FocusState private var focusedField: Field?

    let lift: WOD

    @State private var selectedReps: Int = 1
    @State private var weight: String = ""
    @State private var entryDate: Date = Date()
    @State private var isSaving = false
    @State private var history: [LiftResult] = []
    @State private var editingEntryId: String?

    // Edit form state
    @State private var editWeight: String = ""
    @State private var editReps: Int = 1
    @State private var editDate: Date = Date()

    // Leaderboard
    @State private var leaderboardFilter: LeaderboardFilter = .everyone
    @State private var leaderboardEntries: [LiftResult] = []
    @State private var isLoadingLeaderboard = false

    enum Field {
        case weight
        case editWeight
    }

    enum LeaderboardFilter {
        case gym
        case everyone
    }

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
                VStack(spacing: 4) {
                    // Entry Form (for new entries only)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(lift.title)
                            .font(.headline)
                            .fontWeight(.bold)

                            // Reps Picker
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
                                    loadLeaderboard()
                                }
                            }

                            // Weight, Date, and Save Button in one row
                            HStack(spacing: 0) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Weight")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    HStack {
                                        TextField("0", text: $weight)
                                            .keyboardType(.decimalPad)
                                            .textFieldStyle(.roundedBorder)
                                            .frame(width: 70)
                                            .focused($focusedField, equals: .weight)
                                        Text("lbs")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Date")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    DatePicker("", selection: $entryDate, displayedComponents: .date)
                                        .labelsHidden()
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(" ")
                                        .font(.caption)
                                    Button(action: saveLift) {
                                        Text("Save")
                                            .frame(width: 80)
                                            .padding(.vertical, 8)
                                            .background(weight.isEmpty || isSaving ? Color.gray : Color.blue)
                                            .foregroundColor(.white)
                                            .cornerRadius(8)
                                    }
                                    .disabled(weight.isEmpty || isSaving)
                                }
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                        }
                        .padding(8)
                        .background(Color(.systemBackground))

                    // Percentage Chart (based on most recent weight for selected reps)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Training %")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                            if let recent = mostRecentForReps {
                                Text("Latest: \(String(format: "%.0f", recent.weight)) × \(recent.reps)")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.horizontal, 10)

                        if let baseWeight = currentWeight {
                            HStack(spacing: 0) {
                                // Column 1: 100%, 95%, 90%, 85% - Red (heaviest)
                                VStack(spacing: 1) {
                                    ForEach([100, 95, 90, 85], id: \.self) { percentage in
                                        let weight = baseWeight * (Double(percentage) / 100.0)
                                        HStack(spacing: 4) {
                                            Text("\(percentage)%")
                                                .font(.system(.caption2, design: .monospaced))
                                                .frame(width: 32, alignment: .leading)
                                                .foregroundColor(.red)

                                            Text(String(format: "%.0f", weight))
                                                .font(.system(.caption2, design: .monospaced))
                                                .foregroundColor(.secondary)
                                                .frame(width: 35, alignment: .trailing)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity)

                                // Column 2: 80%, 75%, 70%, 65% - Yellow (medium)
                                VStack(spacing: 1) {
                                    ForEach([80, 75, 70, 65], id: \.self) { percentage in
                                        let weight = baseWeight * (Double(percentage) / 100.0)
                                        HStack(spacing: 4) {
                                            Text("\(percentage)%")
                                                .font(.system(.caption2, design: .monospaced))
                                                .frame(width: 32, alignment: .leading)
                                                .foregroundColor(.yellow)

                                            Text(String(format: "%.0f", weight))
                                                .font(.system(.caption2, design: .monospaced))
                                                .foregroundColor(.secondary)
                                                .frame(width: 35, alignment: .trailing)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity)

                                // Column 3: 60%, 55%, 50%, 45% - Green (lighter)
                                VStack(spacing: 1) {
                                    ForEach([60, 55, 50, 45], id: \.self) { percentage in
                                        let weight = baseWeight * (Double(percentage) / 100.0)
                                        HStack(spacing: 4) {
                                            Text("\(percentage)%")
                                                .font(.system(.caption2, design: .monospaced))
                                                .frame(width: 32, alignment: .leading)
                                                .foregroundColor(.green)

                                            Text(String(format: "%.0f", weight))
                                                .font(.system(.caption2, design: .monospaced))
                                                .foregroundColor(.secondary)
                                                .frame(width: 35, alignment: .trailing)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .padding(.horizontal, 10)
                        } else {
                            Text("Add an entry to see training percentages")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 20)
                        }
                    }
                    .padding(.vertical, 4)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .padding(.horizontal, 10)

                    // Progress Chart (filtered by selected reps)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Progress (\(selectedReps) rep\(selectedReps == 1 ? "" : "s"))")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 10)

                        if filteredHistory.count > 1 {
                            LineChartView(entries: filteredHistory)
                                .frame(height: 100)
                                .padding(.horizontal, 10)
                        } else {
                            Text("Add more entries to see progress chart")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .frame(height: 100)
                        }
                    }
                    .padding(.vertical, 6)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .padding(.horizontal, 10)

                    // Leaderboard
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Leaderboard (\(selectedReps) rep\(selectedReps == 1 ? "" : "s"))")
                                .font(.caption)
                                .fontWeight(.semibold)

                            Spacer()

                            // Filter toggle
                            Picker("Filter", selection: $leaderboardFilter) {
                                Text("Gym").tag(LeaderboardFilter.gym)
                                Text("Everyone").tag(LeaderboardFilter.everyone)
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 180)
                            .onChange(of: leaderboardFilter) { _ in
                                loadLeaderboard()
                            }
                        }
                        .padding(.horizontal, 10)

                        if isLoadingLeaderboard {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        } else if leaderboardEntries.isEmpty {
                            Text("No entries yet")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 20)
                        } else {
                            VStack(spacing: 4) {
                                ForEach(Array(leaderboardEntries.prefix(10).enumerated()), id: \.element.id) { index, entry in
                                    HStack(spacing: 8) {
                                        // Rank
                                        Text("\(index + 1)")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(index < 3 ? .blue : .secondary)
                                            .frame(width: 25, alignment: .leading)

                                        // Name
                                        Text(entry.userName)
                                            .font(.caption)
                                            .foregroundColor(.primary)
                                            .lineLimit(1)

                                        Spacer()

                                        // Weight
                                        Text("\(String(format: "%.0f", entry.weight)) lbs")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.primary)

                                        // Date
                                        Text(entry.date, style: .date)
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                            .frame(width: 70, alignment: .trailing)
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(index % 2 == 0 ? Color(.systemGray6) : Color.clear)
                                    .cornerRadius(4)
                                }
                            }
                            .padding(.horizontal, 6)
                        }
                    }
                    .padding(.vertical, 6)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .padding(.horizontal, 10)

                    // History
                    if !filteredHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("History (\(selectedReps) rep\(selectedReps == 1 ? "" : "s"))")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 10)

                            List {
                                ForEach(filteredHistory) { entry in
                                    if editingEntryId == entry.id {
                                        // EDIT MODE - Show inline edit form
                                        VStack(alignment: .leading, spacing: 8) {
                                            // Reps and Weight
                                            HStack(spacing: 8) {
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text("Reps")
                                                        .font(.caption)
                                                        .foregroundColor(.secondary)
                                                    Picker("Reps", selection: $editReps) {
                                                        ForEach(1...5, id: \.self) { rep in
                                                            Text("\(rep)").tag(rep)
                                                        }
                                                    }
                                                    .pickerStyle(.segmented)
                                                }

                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text("Weight")
                                                        .font(.caption)
                                                        .foregroundColor(.secondary)
                                                    HStack {
                                                        TextField("0", text: $editWeight)
                                                            .keyboardType(.decimalPad)
                                                            .textFieldStyle(.roundedBorder)
                                                            .frame(width: 80)
                                                            .focused($focusedField, equals: .editWeight)
                                                        Text("lbs")
                                                            .font(.caption)
                                                            .foregroundColor(.secondary)
                                                    }
                                                }
                                            }

                                            // Date
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text("Date")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                DatePicker("", selection: $editDate, displayedComponents: .date)
                                                    .labelsHidden()
                                            }

                                            // Update and Cancel buttons
                                            HStack(spacing: 8) {
                                                Button(action: { updateEntry(entry) }) {
                                                    Text("Update")
                                                        .frame(maxWidth: .infinity)
                                                        .padding(.vertical, 8)
                                                        .background(editWeight.isEmpty ? Color.gray : Color.blue)
                                                        .foregroundColor(.white)
                                                        .cornerRadius(8)
                                                }
                                                .disabled(editWeight.isEmpty)

                                                Button(action: cancelEdit) {
                                                    Text("Cancel")
                                                        .frame(maxWidth: .infinity)
                                                        .padding(.vertical, 8)
                                                        .background(Color.gray.opacity(0.2))
                                                        .foregroundColor(.blue)
                                                        .cornerRadius(8)
                                                }
                                            }
                                        }
                                        .padding(.vertical, 6)
                                        .listRowInsets(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
                                        .listRowBackground(Color(.systemBackground))
                                    } else {
                                        // DISPLAY MODE - Normal view
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

                                            Button(action: {
                                                startEditing(entry)
                                            }) {
                                                Image(systemName: "pencil.circle.fill")
                                                    .font(.title3)
                                                    .foregroundColor(.blue)
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        }
                                        .listRowInsets(EdgeInsets(top: 4, leading: 10, bottom: 4, trailing: 10))
                                        .listRowBackground(Color(.systemGray6))
                                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                            Button(role: .destructive) {
                                                deleteEntry(entry)
                                            } label: {
                                                Label("Delete", systemImage: "trash")
                                            }
                                        }
                                        .swipeActions(edge: .leading) {
                                            Button {
                                                startEditing(entry)
                                            } label: {
                                                Label("Edit", systemImage: "pencil")
                                            }
                                            .tint(.blue)
                                        }
                                    }
                                }
                            }
                            .listStyle(.plain)
                            .frame(height: CGFloat(filteredHistory.count * 80 + (editingEntryId != nil ? 120 : 0)))
                            .scrollDisabled(true)
                        }
                        .padding(.vertical, 6)
                    }
                    }
                    .padding(.top, 0)
                    .padding(.bottom, 4)
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
                loadLeaderboard()
            }
        }
    }

    private func colorForPercentage(_ percentage: Int) -> Color {
        switch percentage {
        case 45...65:
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
                    self.updateWeightForReps()
                }
            }
    }

    private func updateWeightForReps() {
        // Don't update if we're editing an existing entry
        if editingEntryId != nil { return }

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

        // Dismiss keyboard before making changes
        focusedField = nil

        isSaving = true

        let result = LiftResult(
            userId: userId,
            userName: store.userName,
            liftTitle: lift.title,
            weight: weightValue,
            reps: selectedReps,
            date: entryDate,
            notes: nil
        )

        let db = Firestore.firestore()
        do {
            _ = try db.collection("liftResults").addDocument(from: result)
            print("✅ Lift result saved successfully!")

            // Clear form and reload history
            weight = ""
            entryDate = Date()
            selectedReps = 1
            loadHistory()
            loadLeaderboard()
        } catch {
            print("❌ Error saving lift result: \(error.localizedDescription)")
        }

        isSaving = false
    }

    private func startEditing(_ entry: LiftResult) {
        print("📝 Editing entry: \(entry.weight) × \(entry.reps)")
        editingEntryId = entry.id
        editWeight = String(entry.weight)
        editReps = entry.reps
        editDate = entry.date
    }

    private func cancelEdit() {
        editingEntryId = nil
        editWeight = ""
        editReps = 1
        editDate = Date()
    }

    private func updateEntry(_ entry: LiftResult) {
        guard let entryId = entry.id,
              let weightValue = Double(editWeight), weightValue > 0 else {
            return
        }

        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            return
        }

        // Dismiss keyboard before making changes
        focusedField = nil

        isSaving = true

        let updatedResult = LiftResult(
            id: entryId,
            userId: userId,
            userName: store.userName,
            liftTitle: lift.title,
            weight: weightValue,
            reps: editReps,
            date: editDate,
            notes: nil
        )

        let db = Firestore.firestore()
        do {
            try db.collection("liftResults").document(entryId).setData(from: updatedResult)
            print("✅ Lift result updated successfully!")

            // Clear form and reload history
            cancelEdit()
            loadHistory()
            loadLeaderboard()
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
                loadLeaderboard()
            }
        }
    }

    private func loadLeaderboard() {
        guard let userId = store.currentUser?.uid else {
            return
        }

        isLoadingLeaderboard = true
        let db = Firestore.firestore()

        if leaderboardFilter == .gym {
            // Load gym leaderboard - need to find gym members first
            loadGymMembersLeaderboard(db: db, userId: userId)
        } else {
            // Load everyone leaderboard
            loadEveryoneLeaderboard(db: db)
        }
    }

    private func loadGymMembersLeaderboard(db: Firestore, userId: String) {
        // First, find gyms where user is a member
        db.collection("gyms")
            .whereField("memberIds", arrayContains: userId)
            .getDocuments { snapshot, error in

                if let error = error {
                    print("❌ Error loading gyms: \(error.localizedDescription)")
                    DispatchQueue.main.async { [self] in
                        self.isLoadingLeaderboard = false
                        self.leaderboardEntries = []
                    }
                    return
                }

                // Get all member IDs from all gyms the user is in
                var allMemberIds = Set<String>()
                snapshot?.documents.forEach { doc in
                    if let gym = try? doc.data(as: Gym.self) {
                        allMemberIds.formUnion(gym.memberIds)
                        allMemberIds.formUnion(gym.coachIds)
                    }
                }

                // If user is not in any gym, show empty leaderboard
                if allMemberIds.isEmpty {
                    DispatchQueue.main.async { [self] in
                        self.isLoadingLeaderboard = false
                        self.leaderboardEntries = []
                    }
                    return
                }

                // Now query lift results for these members
                self.queryLiftResults(db: db, userIds: Array(allMemberIds))
            }
    }

    private func loadEveryoneLeaderboard(db: Firestore) {
        queryLiftResults(db: db, userIds: nil)
    }

    private func queryLiftResults(db: Firestore, userIds: [String]?) {
        let query: Query = db.collection("liftResults")
            .whereField("liftTitle", isEqualTo: lift.title)
            .whereField("reps", isEqualTo: selectedReps)

        query.getDocuments { snapshot, error in

            if let error = error {
                print("❌ Error loading leaderboard: \(error.localizedDescription)")
                DispatchQueue.main.async { [self] in
                    self.isLoadingLeaderboard = false
                    self.leaderboardEntries = []
                }
                return
            }

            var results = snapshot?.documents.compactMap { doc -> LiftResult? in
                try? doc.data(as: LiftResult.self)
            } ?? []

            // Filter by user IDs if provided (for gym leaderboard)
            if let userIds = userIds {
                let userIdSet = Set(userIds)
                results = results.filter { userIdSet.contains($0.userId) }
            }

            // Get the best lift for each user
            var bestLifts: [String: LiftResult] = [:]
            for result in results {
                if let existing = bestLifts[result.userId] {
                    if result.weight > existing.weight {
                        bestLifts[result.userId] = result
                    }
                } else {
                    bestLifts[result.userId] = result
                }
            }

            // Get all unique user IDs
            let userIdsToCheck = Array(bestLifts.keys)

            // Check if users have opted out of leaderboards
            if userIdsToCheck.isEmpty {
                DispatchQueue.main.async { [self] in
                    self.leaderboardEntries = []
                    self.isLoadingLeaderboard = false
                    print("✅ Loaded 0 leaderboard entries")
                }
                return
            }

            // Query users in batches (Firestore 'in' query supports max 10 items)
            let batchSize = 10
            var usersToHide = Set<String>()
            let totalBatches = (userIdsToCheck.count + batchSize - 1) / batchSize
            var processedBatches = 0

            for batchIndex in 0..<totalBatches {
                let start = batchIndex * batchSize
                let end = min(start + batchSize, userIdsToCheck.count)
                let batchUserIds = Array(userIdsToCheck[start..<end])

                db.collection("users")
                    .whereField(FieldPath.documentID(), in: batchUserIds)
                    .getDocuments { userSnapshot, userError in
                        if let userError = userError {
                            print("❌ Error fetching user visibility settings: \(userError.localizedDescription)")
                        } else {
                            let hiddenUsers = userSnapshot?.documents.compactMap { doc -> String? in
                                if let user = try? doc.data(as: AppUser.self) {
                                    print("📋 User \(user.displayName ?? user.email) (ID: \(doc.documentID)) - hideFromLeaderboards: \(user.hideFromLeaderboards)")
                                    if user.hideFromLeaderboards {
                                        print("🚫 Hiding user \(user.displayName ?? user.email) from leaderboard")
                                        return doc.documentID  // Use document ID instead of user.id
                                    }
                                } else {
                                    print("⚠️ Failed to decode user document: \(doc.documentID)")
                                }
                                return nil
                            } ?? []
                            usersToHide.formUnion(hiddenUsers)
                            print("📊 Total users to hide in this batch: \(hiddenUsers.count)")
                        }

                        processedBatches += 1

                        if processedBatches == totalBatches {
                            // Filter out users who have opted out
                            let filteredResults = bestLifts.values.filter { !usersToHide.contains($0.userId) }

                            // Sort by weight descending
                            let sortedResults = filteredResults.sorted { $0.weight > $1.weight }

                            DispatchQueue.main.async { [self] in
                                self.leaderboardEntries = sortedResults
                                self.isLoadingLeaderboard = false
                                print("✅ Loaded \(sortedResults.count) leaderboard entries (filtered \(usersToHide.count) hidden users)")
                            }
                        }
                    }
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

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return formatter
    }()

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // Chart area
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

                    // Smooth curve line
                    Path { path in
                        guard sortedEntries.count > 1 else { return }

                        let width = geometry.size.width - 35
                        let height = geometry.size.height - 20 // Leave room for x-axis labels
                        let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))

                        var points: [CGPoint] = []
                        for (index, entry) in sortedEntries.enumerated() {
                            let x = 35 + CGFloat(index) * xStep
                            let normalizedValue = (entry.estimatedOneRepMax - minWeight) / (maxWeight - minWeight)
                            let y = height - (CGFloat(normalizedValue) * height)
                            points.append(CGPoint(x: x, y: y))
                        }

                        // Create smooth curve using cubic Bezier
                        path.move(to: points[0])

                        if points.count == 2 {
                            path.addLine(to: points[1])
                        } else {
                            for i in 0..<points.count - 1 {
                                let current = points[i]
                                let next = points[i + 1]

                                // Calculate control points for smooth curve
                                let controlPointX = (current.x + next.x) / 2
                                let control1 = CGPoint(x: controlPointX, y: current.y)
                                let control2 = CGPoint(x: controlPointX, y: next.y)

                                path.addCurve(to: next, control1: control1, control2: control2)
                            }
                        }
                    }
                    .stroke(Color.blue, lineWidth: 2)

                    // Data points
                    ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                        let width = geometry.size.width - 35
                        let height = geometry.size.height - 20
                        let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))
                        let x = 35 + CGFloat(index) * xStep
                        let normalizedValue = (entry.estimatedOneRepMax - minWeight) / (maxWeight - minWeight)
                        let y = height - (CGFloat(normalizedValue) * height)

                        Circle()
                            .fill(Color.blue)
                            .frame(width: 7, height: 7)
                            .position(x: x, y: y)
                    }
                }
                .frame(height: geometry.size.height - 15)

                // X-axis date labels
                HStack(spacing: 0) {
                    Spacer()
                        .frame(width: 35)

                    ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                        Text(dateFormatter.string(from: entry.date))
                            .font(.system(size: 7))
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 15)
            }
        }
        .padding(.vertical, 8)
    }
}

