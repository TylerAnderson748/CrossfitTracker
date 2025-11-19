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
    @State private var searchText: String = ""

    var filteredWorkouts: [WOD] {
        let typeFiltered = workouts.filter { $0.type == selectedType }

        if searchText.isEmpty {
            return typeFiltered
        } else {
            return typeFiltered.filter { workout in
                workout.title.localizedCaseInsensitiveContains(searchText) ||
                workout.description.localizedCaseInsensitiveContains(searchText) ||
                (workout.category?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }
    }

    var groupedWorkouts: [String: [WOD]] {
        Dictionary(grouping: filteredWorkouts) { workout in
            workout.category ?? "Other"
        }
    }

    var sortedCategories: [String] {
        groupedWorkouts.keys.sorted()
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

                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                    TextField("Search workouts...", text: $searchText)
                        .textFieldStyle(PlainTextFieldStyle())
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray)
                        }
                    }
                }
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .padding(.horizontal)
                .padding(.bottom, 8)

                // Grouped list with sections
                List {
                    ForEach(sortedCategories, id: \.self) { category in
                        Section(header: Text(category)) {
                            ForEach(groupedWorkouts[category] ?? []) { wod in
                                NavigationLink(destination: destinationView(for: wod)) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(wod.title)
                                            .font(.headline)
                                        // Only show description for WODs, not lifts
                                        if wod.type != .lift {
                                            Text(wod.description)
                                                .font(.subheadline)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                        }
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
