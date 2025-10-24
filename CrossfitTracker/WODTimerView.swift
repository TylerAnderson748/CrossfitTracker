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

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // GROUP 1: Title and Timer (2 items)
                Group {
                    Text(wod.title)
                        .font(.title)
                        .padding(.top)

                    Text(formatTime(elapsed))
                        .font(.system(size: 64, weight: .semibold, design: .monospaced))
                        .padding(.bottom, 8)
                }

                // GROUP 2: Buttons (2 items)
                Group {
                    HStack(spacing: 16) {
                        Button(isRunning ? "Pause" : "Start") { toggleTimer() }
                            .buttonStyle(.borderedProminent)

                        Button("Reset") { resetTimer() }
                            .buttonStyle(.bordered)
                    }

                    Divider().padding(.vertical, 8)
                }

                // GROUP 3: Category and Save (3 items)
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

                Divider().padding(.vertical, 8)

                // GROUP 4: Manual Entry (1 item)
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
                }

                Divider().padding(.vertical, 8)

                // GROUP 5: Progress Chart
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Progress - All Categories")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    if allWodHistory().isEmpty {
                        Text("No history yet")
                            .foregroundColor(.gray)
                            .padding()
                    } else {
                        Chart {
                            ForEach(allWodHistory()) { entry in
                                LineMark(
                                    x: .value("Date", entry.date),
                                    y: .value("Time (seconds)", entry.time),
                                    series: .value("Category", entry.category.rawValue)
                                )
                                .foregroundStyle(by: .value("Category", entry.category.rawValue))
                                .symbol(by: .value("Category", entry.category.rawValue))
                                
                                PointMark(
                                    x: .value("Date", entry.date),
                                    y: .value("Time (seconds)", entry.time)
                                )
                                .foregroundStyle(by: .value("Category", entry.category.rawValue))
                            }
                        }
                        .chartForegroundStyleScale([
                            "RX+": .orange,
                            "RX": .blue,
                            "Scaled": .gray,
                            "Just Happy To Be Here": .green
                        ])
                        .chartYAxis {
                            AxisMarks { value in
                                AxisValueLabel {
                                    if let seconds = value.as(Double.self) {
                                        Text(formatTime(seconds))
                                    }
                                }
                            }
                        }
                        .frame(height: 200)
                        .padding()
                    }
                }

                // GROUP 6: Leaderboard Link (1 item)
                NavigationLink(destination: LeaderboardView(wod: wod).environmentObject(store)) {
                    Text("View Leaderboard")
                }
                .buttonStyle(.bordered)

                Spacer(minLength: 40)
            }
            .padding()
        }
        .navigationTitle("WOD Timer")
        .onDisappear { timer?.invalidate() }
    }

    // MARK: - Timer helpers

    private func toggleTimer() {
        if isRunning { timer?.invalidate() } else { startTimer() }
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
        store.addManualWODResult(wod: wod, time: elapsed, category: selectedCategory)
        resetTimer()
        flashSaved()
    }

    private func saveManualTime() {
        let m = Int(manualMinutes) ?? 0
        let s = Int(manualSeconds) ?? 0
        let total = Double(m * 60 + s)
        guard total > 0 else { return }
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

    // MARK: - Formatting

    private func formatTime(_ t: TimeInterval) -> String {
        let m = Int(t) / 60
        let s = Int(t) % 60
        let mm = String(format: "%02d", m)
        let ss = String(format: "%02d", s)
        return "\(mm):\(ss)"
    }
    
    // MARK: - History Helper
    
    private func allWodHistory() -> [CompletedWOD] {
        store.completedWODs
            .filter { $0.wod.id == wod.id }
            .sorted { $0.date < $1.date }
    }
}
