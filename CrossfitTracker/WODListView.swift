//
//  WODListView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
//

import SwiftUI

struct WODListView: View {
    let workouts = SampleData.wods
    @State private var selectedType: WorkoutType = .wod

    var filteredWorkouts: [WOD] {
        workouts.filter { $0.type == selectedType }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Segmented control for filtering
                Picker("Workout Type", selection: $selectedType) {
                    ForEach(WorkoutType.allCases) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()

                // Filtered list
                List(filteredWorkouts) { wod in
                    NavigationLink(destination: destinationView(for: wod)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(wod.title)
                                .font(.headline)
                            Text(wod.description)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Workouts")
        }
    }

    @ViewBuilder
    private func destinationView(for wod: WOD) -> some View {
        if wod.type == .lift {
            LiftEntryView(lift: wod)
        } else {
            WODTimerView(wod: wod)
        }
    }
}
