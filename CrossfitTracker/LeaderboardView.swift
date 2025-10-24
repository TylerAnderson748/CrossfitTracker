//
//  LeaderboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct LeaderboardView: View {
    @EnvironmentObject var store: AppStore
    var wod: WOD

    var body: some View {
        VStack(spacing: 20) {
            Text("\(wod.title) Leaderboard")
                .font(.title.bold())

            let results = store.results(for: wod)
            if results.isEmpty {
                Text("No scores recorded yet.")
                    .foregroundColor(.gray)
            } else {
                List {
                    ForEach(results.indices, id: \.self) { idx in
                        let entry = results[idx]
                        HStack {
                            Text("#\(idx + 1)")
                                .font(.headline)
                                .frame(width: 40)
                            VStack(alignment: .leading) {
                                Text(entry.userName)
                                    .font(.headline)
                                Text(entry.category.rawValue)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(formatTime(entry.time))
                                .font(.headline.monospacedDigit())
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Leaderboard")
    }

    func formatTime(_ t: TimeInterval) -> String {
        let m = Int(t) / 60
        let s = Int(t) % 60
        return String(format: "%02d:%02d", m, s)
    }
}
