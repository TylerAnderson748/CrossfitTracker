//
//  LeaderboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct LeaderboardView: View {
    @EnvironmentObject var store: AppStore
    var wod: WOD

    @State private var results: [CompletedWOD] = []

    var body: some View {
        VStack(spacing: 16) {
            Text("\(wod.title) Leaderboard")
                .font(.title.bold())
                .padding(.top)

            if results.isEmpty {
                Text("No results yet.")
                    .foregroundColor(.gray)
                    .padding()
            } else {
                List {
                    // Grouped by category
                    ForEach(groupedByCategory(), id: \.0) { (category, entries) in
                        Section(header: Text(category.rawValue)
                            .font(.headline)
                            .foregroundColor(category.color)) {

                            ForEach(entries.indices, id: \.self) { idx in
                                let entry = entries[idx]
                                HStack {
                                    Text("#\(idx + 1)")
                                        .frame(width: 35)
                                        .font(.headline)
                                    VStack(alignment: .leading) {
                                        Text(entry.userName)
                                            .font(.headline)
                                        Text(entry.date, style: .date)
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                    Spacer()
                                    Text(entry.time.formatTime())
                                        .font(.headline.monospacedDigit())
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .onAppear(perform: loadResults)
        .onReceive(store.$completedWODs) { _ in
            loadResults()
        }
        .navigationTitle("Leaderboard")
    }

    // MARK: - Helpers

    private func loadResults() {
        results = store.results(for: wod)
    }

    private func groupedByCategory() -> [(WODCategory, [CompletedWOD])] {
        let grouped = Dictionary(grouping: results) { $0.category }
        return WODCategory.allCases.map { cat in
            (cat, grouped[cat]?.sorted { $0.time < $1.time } ?? [])
        }
    }
}
