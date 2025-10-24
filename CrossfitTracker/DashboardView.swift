//
//  DashboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                Text("Welcome, \(store.userName)")
                    .font(.title.bold())
                    .padding(.top)

                List {
                    ForEach(SampleData.wods) { wod in
                        VStack(alignment: .leading, spacing: 8) {
                            // ✅ Tap the WOD title to open the timer
                            NavigationLink(destination: WODTimerView(wod: wod)
                                .environmentObject(store)) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(wod.title)
                                        .font(.headline)
                                    Text(wod.description)
                                        .font(.subheadline)
                                        .foregroundColor(.gray)
                                }
                            }

                            // ✅ Separate buttons below
                            HStack {
                                NavigationLink(destination: WODTimerView(wod: wod)
                                    .environmentObject(store)) {
                                    Text("Start Timer")
                                }
                                .buttonStyle(.borderedProminent)

                                NavigationLink(destination: LeaderboardView(wod: wod)
                                    .environmentObject(store)) {
                                    Text("Leaderboard")
                                }
                                .buttonStyle(.bordered)
                            }
                            .padding(.top, 6)
                        }
                        .padding(.vertical, 8)
                    }
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Dashboard")
        }
    }
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
            .environmentObject(AppStore.shared)
    }
}
