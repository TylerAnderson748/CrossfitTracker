//
//  WODHistoryView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/19/25.
//

import SwiftUI

struct WODHistoryView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        NavigationView {
            List {
                ForEach(store.completedWODs.sorted(by: { $0.date > $1.date })) { entry in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.wod.title)
                            .font(.headline)
                        Text("\(entry.category.rawValue) - \(formatTime(entry.time))")
                            .font(.subheadline)
                        Text(entry.date, style: .date)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Workout History")
        }
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let min = Int(time) / 60
        let sec = Int(time) % 60
        return String(format: "%02d:%02d", min, sec)
    }
}
