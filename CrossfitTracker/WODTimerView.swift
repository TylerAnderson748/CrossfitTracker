//
//  WODTimerView.swift
//  CrossfitTracker
//

import SwiftUI
import Foundation
import Charts

struct WODTimerView: View {
    @EnvironmentObject var store: AppStore
    let wod: WOD

    // Timer state
    @State private var timer: Timer? = nil
    @State private var elapsed: TimeInterval = 0
    @State private var isRunning = false

    // Manual entry + category
    @State private var manualMinutes: String = ""
    @State private var manualSeconds: String = ""
    @State private var selectedCategory: WODCategory = .rx
    @State private var showSavedMessage = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                titleSection
                timerControlsSection
                categorySection
                Divider().padding(.vertical, 8)
                manualEntrySection
                Divider().padding(.vertical, 8)
                progressChartSection
                leaderboardSection
                Spacer(minLength: 40)
            }
            .padding()
        }
        .navigationTitle("WOD Timer")
        .onDisappear {
            timer?.invalidate()
            timer = nil
        }
    }

    // MARK: - View Components

    private var titleSection: some View {
        Group {
            Text(wod.title)
                .font(.title)
                .padding(.top)

            Text(elapsed.formatTime())
                .font(.system(size: 64, weight: .semibold, design: .monospaced))
                .padding(.bottom, 8)
        }
    }

    private var timerControlsSection: some View {
        Group {
            HStack(spacing: 16) {
                Button(isRunning ? "Pause" : "Start") { toggleTimer() }
                    .buttonStyle(.borderedProminent)

                Button("Reset") { resetTimer() }
                    .buttonStyle(.bordered)
            }

            Divider().padding(.vertical, 8)
        }
    }

    private var categorySection: some View {
        Group {
            Picker("Category", selection: $selectedCategory) {
                Text("RX+").tag(WODCategory.rxPlus)
                Text("RX").tag(WODCategory.rx)
                Text("Scaled").tag(WODCategory.scaled)
                Text("Just Happy To Be Here").tag(WODCategory.happy)
            }
            .pickerStyle(.segmented)

            Button("Save Timer Result") { saveTimerResult() }
                .buttonStyle(.borderedProminent)

            if showSavedMessage {
                Text("✅ Saved Successfully")
                    .foregroundColor(.green)
            }
        }
    }

    private var manualEntrySection: some View {
        VStack(spacing: 10) {
            Text("Manual Time Entry").font(.headline)

            HStack(spacing: 8) {
                TextField("Min", text: $manualMinutes)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                Text(":").font(.title2)

                TextField("Sec", text: $manualSeconds)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                Button("Save") { saveManualTime() }
                    .buttonStyle(.borderedProminent)
            }

            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
    }

    private var progressChartSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your Progress - All Categories")
                .font(.headline)
                .padding(.horizontal)

            if allWodHistory().isEmpty {
                Text("No history yet")
                    .foregroundColor(.gray)
                    .padding()
            } else {
                progressChart
            }
        }
    }

    private var progressChart: some View {
        let history = allWodHistory()

        return Chart {
            ForEach(history) { entry in
                createLineMark(for: entry)
                createPointMark(for: entry)
            }
        }
        .chartForegroundStyleScale(categoryColorScale)
        .chartYAxis { chartYAxisContent }
        .frame(height: 200)
        .padding()
    }

    private func createLineMark(for entry: HistoryEntry) -> some ChartContent {
        LineMark(
            x: .value("Date", entry.date),
            y: .value("Time (seconds)", entry.time),
            series: .value("Category", entry.category.rawValue)
        )
        .foregroundStyle(by: .value("Category", entry.category.rawValue))
        .symbol(by: .value("Category", entry.category.rawValue))
    }

    private func createPointMark(for entry: HistoryEntry) -> some ChartContent {
        PointMark(
            x: .value("Date", entry.date),
            y: .value("Time (seconds)", entry.time)
        )
        .foregroundStyle(by: .value("Category", entry.category.rawValue))
    }

    private var categoryColorScale: [String: Color] {
        [
            "RX+": .orange,
            "RX": .blue,
            "Scaled": .gray,
            "Just Happy To Be Here": .green
        ]
    }

    @AxisContentBuilder
    private var chartYAxisContent: some AxisContent {
        AxisMarks { value in
            AxisValueLabel {
                if let seconds = value.as(Double.self) {
                    Text(seconds.formatTime())
                }
            }
        }
    }

    private var leaderboardSection: some View {
        NavigationLink(destination: LeaderboardView(wod: wod).environmentObject(store)) {
            Text("View Leaderboard")
        }
        .buttonStyle(.bordered)
    }

    // MARK: - Timer helpers

    private func toggleTimer() {
        if isRunning {
            stopTimer()
        } else {
            startTimer()
        }
        isRunning.toggle()
    }

    private func startTimer() {
        // Ensure any existing timer is cleaned up first
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed += 1
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func resetTimer() {
        timer?.invalidate()
        timer = nil
        elapsed = 0
        isRunning = false
    }

    private func saveTimerResult() {
        guard elapsed > 0 else { return }
        store.addManualWODResult(wod: wod, time: elapsed, category: selectedCategory)
        resetTimer()
        flashSaved()
    }

    private func saveManualTime() {
        // Clear any previous error
        errorMessage = nil

        // Validate minutes
        let minutesStr = manualMinutes.trimmingCharacters(in: .whitespaces)
        let secondsStr = manualSeconds.trimmingCharacters(in: .whitespaces)

        guard let m = Int(minutesStr), m >= 0 else {
            errorMessage = "Please enter valid minutes (0 or greater)"
            return
        }

        guard let s = Int(secondsStr), s >= 0, s < 60 else {
            errorMessage = "Please enter valid seconds (0-59)"
            return
        }

        let total = Double(m * 60 + s)
        guard total > 0 else {
            errorMessage = "Total time must be greater than 0"
            return
        }

        store.addManualWODResult(wod: wod, time: total, category: selectedCategory)
        manualMinutes = ""
        manualSeconds = ""
        flashSaved()
    }

    private func flashSaved() {
        showSavedMessage = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { showSavedMessage = false }
        }
    }

    // MARK: - History Helper
    
    private func allWodHistory() -> [CompletedWOD] {
        store.completedWODs
            .filter { $0.wod.id == wod.id }
            .sorted { $0.date < $1.date }
    }
}
