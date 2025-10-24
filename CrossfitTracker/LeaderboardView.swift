//
//  LeaderboardView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI
import Charts

struct LeaderboardView: View {
    @EnvironmentObject var store: AppStore
    var wod: WOD

    var filteredScores: [CompletedWOD] {
        store.completedWODs
            .filter { $0.wod.id == wod.id }
            .sorted {
                // Sort by category first (Elite > RX > Scaled), then by time ascending
                if $0.category != $1.category {
                    return categoryPriority($0.category) < categoryPriority($1.category)
                } else {
                    return $0.time < $1.time
                }
            }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text("Leaderboard: \(wod.title)")
                .font(.title2.bold())
                .padding(.top)

            List(filteredScores) { completed in
                HStack {
                    Text(completed.userName)
                    Spacer()
                    Text("\(Int(completed.time))s")
                    Text(completed.category.rawValue)
                        .foregroundColor(.gray)
                        .italic()
                }
            }

            // Graph of past scores
            if !filteredScores.isEmpty {
                Chart {
                    ForEach(filteredScores) { score in
                        BarMark(
                            x: .value("User", score.userName),
                            y: .value("Time", score.time)
                        )
                        .foregroundStyle(by: .value("Category", score.category.rawValue))
                    }
                }
                .chartForegroundStyleScale([
                    "Elite": .red,
                    "RX": .blue,
                    "Scaled": .green
                ])
                .frame(height: 200)
                .padding()
            }

            Spacer()
        }
        .padding()
    }

    func categoryPriority(_ category: WODCategory) -> Int {
        switch category {
        case .elite: return 0
        case .rx: return 1
        case .scaled: return 2
        }
    }
}
