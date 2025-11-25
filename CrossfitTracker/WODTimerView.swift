//
//  WODTimerView.swift
//  CrossfitTracker
//

import SwiftUI
import Foundation
import Charts
import FirebaseFirestore

struct WODTimerView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @FocusState private var focusedField: Field?

    let wod: WOD

    // Timer state
    @State private var timer: Timer? = nil
    @State private var elapsed: TimeInterval = 0
    @State private var isRunning = false

    // Entry state
    @State private var manualMinutes: String = ""
    @State private var manualSeconds: String = ""
    @State private var selectedCategory: WODCategory = .rx
    @State private var entryDate: Date = Date()
    @State private var workoutHistory: [WorkoutLog] = []
    @State private var editingEntryId: String?

    // Edit form state
    @State private var editMinutes: String = ""
    @State private var editSeconds: String = ""
    @State private var editCategory: WODCategory = .rx
    @State private var editDate: Date = Date()

    // Leaderboard
    @State private var leaderboardFilter: LeaderboardFilter = .everyone
    @State private var leaderboardEntries: [LeaderboardEntry] = []
    @State private var isLoadingLeaderboard = false

    enum Field {
        case minutes
        case seconds
        case editMinutes
        case editSeconds
    }

    enum LeaderboardFilter {
        case gym
        case everyone
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 4) {
                    // Entry Form
                    VStack(alignment: .leading, spacing: 6) {
                        Text(wod.title)
                            .font(.headline)
                            .fontWeight(.bold)

                        Text(wod.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)

                        // Timer Display
                        Text(formatTime(elapsed))
                            .font(.system(size: 48, weight: .semibold, design: .monospaced))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)

                        // Timer Controls
                        timerControlsView

                        // Category Picker
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Category")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Picker("Category", selection: $selectedCategory) {
                                Text("RX").tag(WODCategory.rx)
                                Text("Scaled").tag(WODCategory.scaled)
                                Text("Happy").tag(WODCategory.happy)
                            }
                            .pickerStyle(.segmented)
                        }

                        Divider().padding(.vertical, 4)

                        // Manual Entry
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Manual Entry")
                                .font(.caption)
                                .fontWeight(.semibold)

                            HStack(spacing: 0) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Minutes")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    TextField("0", text: $manualMinutes)
                                        .keyboardType(.numberPad)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 60)
                                        .focused($focusedField, equals: .minutes)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Seconds")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    TextField("0", text: $manualSeconds)
                                        .keyboardType(.numberPad)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 60)
                                        .focused($focusedField, equals: .seconds)
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
                                    Button(action: saveManualTime) {
                                        Text("Save")
                                            .frame(width: 60)
                                            .padding(.vertical, 8)
                                            .background(isManualEntryValid ? Color.blue : Color.gray)
                                            .foregroundColor(.white)
                                            .cornerRadius(8)
                                    }
                                    .disabled(!isManualEntryValid)
                                }
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(.systemBackground))

                    // Progress Chart
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Progress")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 10)

                        if workoutHistory.count > 1 {
                            WODLineChartView(entries: workoutHistory)
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
                            Text("Leaderboard")
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

                                        // Time
                                        if let time = entry.timeInSeconds {
                                            Text(formatTime(time))
                                                .font(.caption)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.primary)
                                        }

                                        // Date
                                        Text(entry.completedDate, style: .date)
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
                    if !workoutHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("History")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 10)

                            List {
                                ForEach(workoutHistory) { entry in
                                    if editingEntryId == entry.id {
                                        // EDIT MODE
                                        VStack(alignment: .leading, spacing: 8) {
                                            // Time Entry
                                            HStack(spacing: 8) {
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text("Minutes")
                                                        .font(.caption)
                                                        .foregroundColor(.secondary)
                                                    TextField("0", text: $editMinutes)
                                                        .keyboardType(.numberPad)
                                                        .textFieldStyle(.roundedBorder)
                                                        .frame(width: 80)
                                                        .focused($focusedField, equals: .editMinutes)
                                                }

                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text("Seconds")
                                                        .font(.caption)
                                                        .foregroundColor(.secondary)
                                                    TextField("0", text: $editSeconds)
                                                        .keyboardType(.numberPad)
                                                        .textFieldStyle(.roundedBorder)
                                                        .frame(width: 80)
                                                        .focused($focusedField, equals: .editSeconds)
                                                }
                                            }

                                            // Category
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text("Category")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                Picker("Category", selection: $editCategory) {
                                                    Text("RX").tag(WODCategory.rx)
                                                    Text("Scaled").tag(WODCategory.scaled)
                                                    Text("Happy").tag(WODCategory.happy)
                                                }
                                                .pickerStyle(.segmented)
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
                                                        .background(Color.blue)
                                                        .foregroundColor(.white)
                                                        .cornerRadius(8)
                                                }

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
                                        // DISPLAY MODE
                                        HStack(spacing: 6) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(entry.completedDate, style: .date)
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                Text(entry.formattedTime)
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
                            .frame(height: CGFloat(workoutHistory.count * 70 + (editingEntryId != nil ? 150 : 0)))
                            .scrollDisabled(true)
                        }
                        .padding(.vertical, 6)
                    }
                }
                .padding(.top, 0)
                .padding(.bottom, 4)
            }
            .navigationTitle(wod.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadWorkoutHistory()
                loadLeaderboard()
            }
            .onDisappear {
                timer?.invalidate()
            }
        }
    }

    private var isManualEntryValid: Bool {
        let m = Int(manualMinutes) ?? 0
        let s = Int(manualSeconds) ?? 0
        return m > 0 || s > 0
    }

    private var timerControlsView: some View {
        HStack(spacing: 12) {
            Button(isRunning ? "Pause" : "Start") {
                toggleTimer()
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(8)

            Button("Reset") {
                resetTimer()
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color.gray.opacity(0.2))
            .foregroundColor(.blue)
            .cornerRadius(8)

            Button("Save") {
                saveTimerResult()
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(elapsed > 0 ? Color.green : Color.gray)
            .foregroundColor(.white)
            .cornerRadius(8)
            .disabled(elapsed == 0)
        }
    }

    // MARK: - Timer helpers

    private func toggleTimer() {
        if isRunning {
            timer?.invalidate()
        } else {
            startTimer()
        }
        isRunning.toggle()
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed += 1
        }
    }

    private func resetTimer() {
        timer?.invalidate()
        elapsed = 0
        isRunning = false
    }

    private func saveTimerResult() {
        guard elapsed > 0 else { return }
        focusedField = nil
        store.addManualWODResult(wod: wod, time: elapsed, category: selectedCategory)
        resetTimer()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            loadWorkoutHistory()
            loadLeaderboard()
        }
    }

    private func saveManualTime() {
        let m = Int(manualMinutes) ?? 0
        let s = Int(manualSeconds) ?? 0
        let total = Double(m * 60 + s)
        guard total > 0 else { return }
        focusedField = nil
        store.addManualWODResult(wod: wod, time: total, category: selectedCategory)
        manualMinutes = ""
        manualSeconds = ""
        entryDate = Date()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            loadWorkoutHistory()
            loadLeaderboard()
        }
    }

    // MARK: - Edit/Delete

    private func startEditing(_ entry: WorkoutLog) {
        guard let seconds = entry.timeInSeconds else { return }
        editingEntryId = entry.id
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        editMinutes = String(minutes)
        editSeconds = String(secs)
        editCategory = .rx // Default, WorkoutLog doesn't store category yet
        editDate = entry.completedDate
    }

    private func cancelEdit() {
        editingEntryId = nil
        editMinutes = ""
        editSeconds = ""
        editCategory = .rx
        editDate = Date()
    }

    private func updateEntry(_ entry: WorkoutLog) {
        guard let entryId = entry.id else { return }
        let m = Int(editMinutes) ?? 0
        let s = Int(editSeconds) ?? 0
        let total = Double(m * 60 + s)
        guard total > 0 else { return }

        focusedField = nil

        var updatedLog = entry
        updatedLog.timeInSeconds = total
        updatedLog.completedDate = editDate

        let db = Firestore.firestore()
        do {
            try db.collection("workoutLogs").document(entryId).setData(from: updatedLog)
            print("✅ Workout log updated successfully!")
            cancelEdit()
            loadWorkoutHistory()
            loadLeaderboard()
        } catch {
            print("❌ Error updating workout log: \(error.localizedDescription)")
        }
    }

    private func deleteEntry(_ entry: WorkoutLog) {
        guard let entryId = entry.id else { return }

        let db = Firestore.firestore()
        db.collection("workoutLogs").document(entryId).delete { error in
            if let error = error {
                print("❌ Error deleting workout log: \(error.localizedDescription)")
            } else {
                print("✅ Workout log deleted successfully!")
                loadWorkoutHistory()
                loadLeaderboard()
            }
        }
    }

    // MARK: - Formatting

    private func formatTime(_ t: TimeInterval) -> String {
        let m = Int(t) / 60
        let s = Int(t) % 60
        return String(format: "%d:%02d", m, s)
    }

    // MARK: - History Helper

    private func loadWorkoutHistory() {
        guard let userId = store.currentUser?.uid else {
            print("❌ [WODTimerView] No user logged in for history")
            return
        }

        print("📊 [WODTimerView] Loading workout history for '\(wod.title)'")

        store.loadWorkoutLogs(userId: userId) { logs, error in
            if let error = error {
                print("❌ [WODTimerView] Error loading history: \(error)")
                return
            }

            let filtered = logs.filter { $0.wodTitle == wod.title && $0.resultType == .time }
            print("📊 [WODTimerView] Found \(filtered.count) matching entries")

            workoutHistory = filtered.sorted { $0.completedDate > $1.completedDate }
        }
    }

    // MARK: - Leaderboard

    private func loadLeaderboard() {
        guard let userId = store.currentUser?.uid else { return }

        isLoadingLeaderboard = true
        let db = Firestore.firestore()

        if leaderboardFilter == .gym {
            loadGymMembersLeaderboard(db: db, userId: userId)
        } else {
            loadEveryoneLeaderboard(db: db)
        }
    }

    private func loadGymMembersLeaderboard(db: Firestore, userId: String) {
        db.collection("gyms")
            .whereField("memberIds", arrayContains: userId)
            .getDocuments { snapshot, error in
                if let error = error {
                    print("❌ Error loading gyms: \(error.localizedDescription)")
                    DispatchQueue.main.async {
                        self.isLoadingLeaderboard = false
                        self.leaderboardEntries = []
                    }
                    return
                }

                var allMemberIds = Set<String>()
                snapshot?.documents.forEach { doc in
                    if let gym = try? doc.data(as: Gym.self) {
                        allMemberIds.formUnion(gym.memberIds)
                        allMemberIds.formUnion(gym.coachIds)
                    }
                }

                if allMemberIds.isEmpty {
                    DispatchQueue.main.async {
                        self.isLoadingLeaderboard = false
                        self.leaderboardEntries = []
                    }
                    return
                }

                self.queryWorkoutLogs(db: db, userIds: Array(allMemberIds))
            }
    }

    private func loadEveryoneLeaderboard(db: Firestore) {
        queryWorkoutLogs(db: db, userIds: nil)
    }

    private func queryWorkoutLogs(db: Firestore, userIds: [String]?) {
        db.collection("workoutLogs")
            .whereField("wodTitle", isEqualTo: wod.title)
            .whereField("resultType", isEqualTo: WorkoutResultType.time.rawValue)
            .getDocuments { snapshot, error in
                if let error = error {
                    print("❌ Error loading leaderboard: \(error.localizedDescription)")
                    DispatchQueue.main.async {
                        self.isLoadingLeaderboard = false
                        self.leaderboardEntries = []
                    }
                    return
                }

                var logs = snapshot?.documents.compactMap { doc -> WorkoutLog? in
                    try? doc.data(as: WorkoutLog.self)
                } ?? []

                // Filter by user IDs if provided
                if let userIds = userIds {
                    let userIdSet = Set(userIds)
                    logs = logs.filter { userIdSet.contains($0.userId) }
                }

                // Get best time for each user
                var bestTimes: [String: WorkoutLog] = [:]
                for log in logs {
                    guard let time = log.timeInSeconds else { continue }
                    if let existing = bestTimes[log.userId], let existingTime = existing.timeInSeconds {
                        if time < existingTime {
                            bestTimes[log.userId] = log
                        }
                    } else {
                        bestTimes[log.userId] = log
                    }
                }

                // Get unique user IDs
                let userIdsToCheck = Array(bestTimes.keys)
                print("🏆 [Leaderboard] Found \(userIdsToCheck.count) unique users with best times")
                print("🏆 [Leaderboard] User IDs: \(userIdsToCheck)")

                if userIdsToCheck.isEmpty {
                    DispatchQueue.main.async {
                        self.leaderboardEntries = []
                        self.isLoadingLeaderboard = false
                    }
                    return
                }

                // Query users to check hideFromLeaderboards and get display names
                let batchSize = 10
                var usersToHide = Set<String>()
                var userNames: [String: String] = [:]
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
                                print("❌ Error fetching user data: \(userError.localizedDescription)")
                            } else {
                                print("📊 [Leaderboard] Fetched \(userSnapshot?.documents.count ?? 0) user documents for batch")
                                userSnapshot?.documents.forEach { doc in
                                    print("📊 [Leaderboard] Processing user doc ID: \(doc.documentID)")
                                    if let user = try? doc.data(as: AppUser.self) {
                                        // Check if user should be hidden
                                        if user.hideFromLeaderboards {
                                            usersToHide.insert(doc.documentID)
                                            print("🚫 [Leaderboard] User \(doc.documentID) is hidden from leaderboards")
                                        }

                                        // Extract display name (try multiple fields as fallback)
                                        let displayName: String
                                        if let name = user.displayName, !name.isEmpty {
                                            displayName = name
                                            print("✅ [Leaderboard] User \(doc.documentID) displayName: '\(displayName)'")
                                        } else if let username = user.username, !username.isEmpty {
                                            displayName = username
                                            print("✅ [Leaderboard] User \(doc.documentID) username: '\(displayName)'")
                                        } else {
                                            // Use email prefix as last resort
                                            displayName = user.email.components(separatedBy: "@").first ?? "User"
                                            print("✅ [Leaderboard] User \(doc.documentID) email prefix: '\(displayName)'")
                                        }
                                        userNames[doc.documentID] = displayName
                                    } else {
                                        print("❌ [Leaderboard] Failed to decode user doc \(doc.documentID)")
                                    }
                                }
                            }

                            processedBatches += 1

                            if processedBatches == totalBatches {
                                print("📊 [Leaderboard] Collected user names: \(userNames)")

                                let filteredLogs = bestTimes.values.filter { !usersToHide.contains($0.userId) }
                                let sortedLogs = filteredLogs.sorted { ($0.timeInSeconds ?? Double.infinity) < ($1.timeInSeconds ?? Double.infinity) }

                                // Convert to LeaderboardEntry with actual user names
                                let entries = sortedLogs.compactMap { log -> LeaderboardEntry? in
                                    guard let time = log.timeInSeconds else { return nil }
                                    let userName = userNames[log.userId] ?? "User"
                                    print("📊 [Leaderboard] Creating entry for userId '\(log.userId)' with name '\(userName)' and time \(time)")
                                    return LeaderboardEntry.from(workoutLog: log, userName: userName)
                                }

                                DispatchQueue.main.async {
                                    self.leaderboardEntries = entries
                                    self.isLoadingLeaderboard = false
                                    print("✅ Loaded \(entries.count) leaderboard entries with user names")
                                }
                            }
                        }
                }
            }
    }
}

// MARK: - WOD Line Chart View
struct WODLineChartView: View {
    let entries: [WorkoutLog]

    private var sortedEntries: [WorkoutLog] {
        entries.sorted { $0.completedDate < $1.completedDate }
    }

    private var maxTime: Double {
        sortedEntries.compactMap { $0.timeInSeconds }.max() ?? 600
    }

    private var minTime: Double {
        let min = sortedEntries.compactMap { $0.timeInSeconds }.min() ?? 0
        return max(0, min - 60)
    }

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return formatter
    }()

    private func formatTime(_ seconds: Double) -> String {
        let m = Int(seconds) / 60
        let s = Int(seconds) % 60
        return String(format: "%d:%02d", m, s)
    }

    private func dataPoint(for time: Double, at index: Int, in geometry: GeometryProxy) -> some View {
        let width = geometry.size.width - 40
        let height = geometry.size.height - 20
        let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))
        let x = 40 + CGFloat(index) * xStep
        let normalizedValue = (time - minTime) / (maxTime - minTime)
        let y = height - (CGFloat(normalizedValue) * height)

        return Circle()
            .fill(Color.blue)
            .frame(width: 7, height: 7)
            .position(x: x, y: y)
    }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // Chart area
                ZStack(alignment: .bottomLeading) {
                    // Grid lines
                    VStack(spacing: 0) {
                        ForEach(0..<5) { i in
                            HStack {
                                let value = maxTime - (Double(i) * (maxTime - minTime) / 4)
                                Text(formatTime(value))
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                    .frame(width: 35, alignment: .trailing)

                                Rectangle()
                                    .fill(Color.gray.opacity(0.2))
                                    .frame(height: 0.5)
                            }
                            if i < 4 {
                                Spacer()
                            }
                        }
                    }

                    // Line
                    Path { path in
                        guard sortedEntries.count > 1 else { return }

                        let width = geometry.size.width - 40
                        let height = geometry.size.height - 20
                        let xStep = width / CGFloat(max(sortedEntries.count - 1, 1))

                        var points: [CGPoint] = []
                        for (index, entry) in sortedEntries.enumerated() {
                            guard let time = entry.timeInSeconds else { continue }
                            let x = 40 + CGFloat(index) * xStep
                            let normalizedValue = (time - minTime) / (maxTime - minTime)
                            let y = height - (CGFloat(normalizedValue) * height)
                            points.append(CGPoint(x: x, y: y))
                        }

                        guard !points.isEmpty else { return }
                        path.move(to: points[0])

                        for i in 0..<points.count - 1 {
                            let current = points[i]
                            let next = points[i + 1]
                            let controlPointX = (current.x + next.x) / 2
                            let control1 = CGPoint(x: controlPointX, y: current.y)
                            let control2 = CGPoint(x: controlPointX, y: next.y)
                            path.addCurve(to: next, control1: control1, control2: control2)
                        }
                    }
                    .stroke(Color.blue, lineWidth: 2)

                    // Data points
                    ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                        if let time = entry.timeInSeconds {
                            dataPoint(
                                for: time,
                                at: index,
                                in: geometry
                            )
                        }
                    }
                }
                .frame(height: geometry.size.height - 15)

                // X-axis labels
                HStack(spacing: 0) {
                    Spacer()
                        .frame(width: 40)

                    ForEach(Array(sortedEntries.enumerated()), id: \.element.id) { index, entry in
                        Text(dateFormatter.string(from: entry.completedDate))
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
