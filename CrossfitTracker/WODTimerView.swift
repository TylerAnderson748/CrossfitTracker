//
//  WODTimerView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct WODTimerView: View {
    @EnvironmentObject var store: AppStore
    @State private var timer: Timer? = nil
    @State private var elapsed: TimeInterval = 0
    @State private var showCategorySheet = false
    @State private var manualTimeInput: String = ""

    var wod: WOD

    var body: some View {
        VStack(spacing: 20) {
            Text(wod.title)
                .font(.title.bold())

            Text(wod.description)
                .font(.body)
                .multilineTextAlignment(.center)
                .padding()

            Text("Time: \(formatTime(elapsed))")
                .font(.largeTitle.monospacedDigit())

            if store.activeWOD == nil {
                Button("Start WOD") {
                    store.startWOD(wod)
                    startTimer()
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button("Stop WOD") {
                    stopTimer()
                    showCategorySheet = true
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            }

            // Manual time entry
            if store.activeWOD == nil {
                TextField("Enter time in seconds", text: $manualTimeInput)
                    .keyboardType(.numberPad)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding(.horizontal)
                Button("Submit Manual Score") {
                    if let seconds = TimeInterval(manualTimeInput) {
                        store.stopWOD(category: .scaled)
                        manualTimeInput = ""
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            NavigationLink("View Leaderboard", destination: LeaderboardView(wod: wod))
                .padding()
                .buttonStyle(.bordered)

            Spacer()
        }
        .padding()
        .onDisappear {
            timer?.invalidate()
        }
        .sheet(isPresented: $showCategorySheet) {
            VStack(spacing: 20) {
                Text("Select Category")
                    .font(.headline)
                ForEach(WODCategory.allCases.reversed(), id: \.self) { category in
                    Button(category.rawValue) {
                        store.stopWOD(category: category)
                        showCategorySheet = false
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                }
                Button("Cancel") {
                    showCategorySheet = false
                }
                .tint(.gray)
            }
            .padding()
        }
    }

    // MARK: Timer Functions
    func startTimer() {
        elapsed = 0
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed += 1
        }
    }

    func stopTimer() {
        timer?.invalidate()
    }

    func formatTime(_ interval: TimeInterval) -> String {
        let minutes = Int(interval) / 60
        let seconds = Int(interval) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}
