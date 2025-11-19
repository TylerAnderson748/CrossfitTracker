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
    @AppStorage("workoutAccessCounts") private var accessCountsData: Data = Data()

    private var accessCounts: [String: Int] {
        (try? JSONDecoder().decode([String: Int].self, from: accessCountsData)) ?? [:]
    }

    private func saveAccessCounts(_ counts: [String: Int]) {
        if let data = try? JSONEncoder().encode(counts) {
            accessCountsData = data
        }
    }

    private func recordAccess(for workout: WOD) {
        var counts = accessCounts
        counts[workout.title, default: 0] += 1
        saveAccessCounts(counts)
    }

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

    var frequentWorkouts: [WOD] {
        let typeFiltered = workouts.filter { $0.type == selectedType }
        let counts = accessCounts

        return typeFiltered
            .filter { counts[$0.title] ?? 0 > 0 }
            .sorted { (counts[$0.title] ?? 0) > (counts[$1.title] ?? 0) }
            .prefix(5)
            .map { $0 }
    }

    var groupedWorkouts: [String: [WOD]] {
        let workoutsToGroup = searchText.isEmpty ? filteredWorkouts : filteredWorkouts

        return Dictionary(grouping: workoutsToGroup) { workout in
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
                    // Frequent section (only when not searching)
                    if searchText.isEmpty && !frequentWorkouts.isEmpty {
                        Section(header: Text("⚡ Frequent")) {
                            ForEach(frequentWorkouts) { wod in
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
                                .simultaneousGesture(TapGesture().onEnded {
                                    recordAccess(for: wod)
                                })
                            }
                        }
                    }

                    // Regular categories
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
                                .simultaneousGesture(TapGesture().onEnded {
                                    recordAccess(for: wod)
                                })
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
