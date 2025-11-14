//
//  LiftHistoryView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

import SwiftUI
import Charts

struct LiftHistoryView: View {
    @EnvironmentObject var store: AppStore
    var lift: Lift

    // Computed property for history
    var liftHistory: [LiftEntry] {
        store.liftEntries
            .filter { $0.liftID == lift.id }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        VStack {
            Text("\(lift.name) History")
                .font(.title2.bold())
                .padding(.top)

            if liftHistory.isEmpty {
                Text("No history yet")
                    .foregroundColor(.gray)
            } else {
                Chart {
                    ForEach(liftHistory) { entry in
                        BarMark(
                            x: .value("Date", entry.date, unit: .day),
                            y: .value("Weight", entry.weight)
                        )
                    }
                    .foregroundStyle(.blue)
                }
                .frame(height: 200)
                .padding()

                List(liftHistory) { entry in
                    HStack {
                        Text(entry.date, style: .date)
                        Spacer()
                        Text(String(format: "%.1f lb", entry.weight))
                            .font(.body.monospacedDigit())
                    }
                }
            }
        }
        .padding()
        .navigationTitle("\(lift.name) History")
    }
}
