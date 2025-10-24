//
//  WODTimerView.swift
//  CrossfitTracker
//

import SwiftUI

struct WODTimerView: View {
    @EnvironmentObject var store: AppStore
    var wod: WOD

    @State private var timer: Timer? = nil
    @State private var elapsed: TimeInterval = 0
    @State private var isRunning = false

    @State private var minutesInput = ""
    @State private var secondsInput = ""
    @State private var showSavedMessage = false
    @State private var selectedCategory: WODCategory = .scaled

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text(wod.title)
                    .font(.largeTitle.bold())
                    .padding(.top)
                
                // TIMER DISPLAY
                Text(formatTime(elapsed))
                    .font(.system(size: 60, weight: .bold, design: .monospaced))
                
                // TIMER BUTTONS
                HStack {
                    Button(isRunning ? "Pause" : "Start") {
                        toggleTimer()
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button("Reset") {
                        resetTimer()
                    }
                    .buttonStyle(.bordered)
                }
                
                Divider().padding(.vertical, 10)
                
                // MANUAL ENTRY
                VStack(spacing: 8) {
                    Text("Manual Time Entry")
                        .font(.headline)
                    
                    HStack {
                        TextField("Min", text: $minutesInput)
                            .keyboardType(.numberPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .frame(width: 80)
                        Text(":")
                        TextField("Sec", text: $secondsInput)
                            .keyboardType(.numberPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .frame(width: 80)
                    }
                    
                    Picker("Category", selection: $selectedCategory) {
                        ForEach(WODCategory.allCases) { category in
                            Text(category.rawValue).tag(category)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.top, 5)
                    
                    Button("Submit Manual Score") {
                        submitManualScore()
                    }
                    .buttonStyle(.borderedProminent)
                }
                
                Divider().padding(.vertical, 10)
                
                // SAVE CURRENT TIMER
                Button("Save Timer Result") {
                    saveTimerResult()
                }
                .buttonStyle(.borderedProminent)
                
                if showSavedMessage {
                    Text("✅ Saved Successfully")
                        .foregroundColor(.green)
                        .transition(.opacity)
                }
                
                Divider().padding(.vertical, 10)
                
                NavigationLink(
                    "View Leaderboard",
                    destination: LeaderboardView(wod: wod).environmentObject(store)
                )
                .buttonStyle(.bordered)
            
            }
            Spacer()
            .padding()
        }
        .navigationTitle("WOD Timer")
        .onDisappear {
            timer?.invalidate()
        }
    }

    // MARK: - Helpers

    func toggleTimer() {
        if isRunning {
            timer?.invalidate()
        } else {
            startTimer()
        }
        isRunning.toggle()
    }

    func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed += 1
        }
    }

    func resetTimer() {
        timer?.invalidate()
        elapsed = 0
        isRunning = false
    }

    // MARK: - Save Timer Result
    func saveTimerResult() {
        // Ensure we have a valid elapsed time
        guard elapsed > 0 else { return }

        // Save directly — no need for activeWOD
        store.addManualWODResult(
            wod: wod,
            category: selectedCategory,
            time: elapsed
        )

        showSavedMessage = true
        resetTimer()

        // Auto-hide confirmation
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { showSavedMessage = false }
        }
    }


    func submitManualScore() {
        let minutes = Int(minutesInput) ?? 0
        let seconds = Int(secondsInput) ?? 0
        let totalTime = Double(minutes * 60 + seconds)
        guard totalTime > 0 else { return }

        store.addManualWODResult(wod: wod, category: selectedCategory, time: totalTime)
        minutesInput = ""
        secondsInput = ""
        showSavedMessage = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { showSavedMessage = false }
        }
    }

    func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

