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
        NavigationStack {
            List {
                ForEach(store.completedWODs.sorted(by: { $0.date > $1.date })) { entry in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.wod.title)
                            .font(.headline)
                        Text("\(entry.category.rawValue) - \(entry.time.formatTime())")
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
}
