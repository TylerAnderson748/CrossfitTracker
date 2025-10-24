//
//  ContentView.swift
//  CrossfitTrackerWatch Watch App
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct ContentView: View {
    @State private var activeWOD: WOD? = SampleData.wods.first
    @State private var timer: Timer? = nil
    @State private var elapsed: TimeInterval = 0
    @State private var showCategorySheet = false

    var body: some View {
        VStack(spacing: 8) {
            Text(activeWOD?.title ?? "No WOD")
                .font(.headline)
            Text(activeWOD?.description ?? "")
                .font(.footnote)
                .multilineTextAlignment(.center)

            Text("Time: \(elapsed.formatTime())")
                .font(.title2.monospacedDigit())

            if timer == nil {
                Button("Start WOD") {
                    startTimer()
                    if let id = activeWOD?.id.uuidString {
                        WatchSessionManager.shared.sendWODStart(id)
                    }
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button("Stop WOD") {
                    timer?.invalidate()
                    showCategorySheet = true
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            }
        }
        .padding()
        .onDisappear {
            timer?.invalidate()
            timer = nil
        }
        .sheet(isPresented: $showCategorySheet) {
            VStack(spacing: 12) {
                Text("Select Category")
                    .font(.headline)
                ForEach(WODCategory.allCases, id: \.self) { category in
                    Button(category.rawValue) {
                        if let wod = activeWOD {
                            WatchSessionManager.shared.sendWODStop(wod.id.uuidString, elapsed: elapsed, category: category.rawValue)
                        }
                        showCategorySheet = false
                        timer = nil
                        elapsed = 0
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
    }

    func startTimer() {
        elapsed = 0
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed += 1
        }
    }
}
