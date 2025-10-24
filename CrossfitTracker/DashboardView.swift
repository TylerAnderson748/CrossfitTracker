//
//  DashboardView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Welcome, \(store.userName)")
                    .font(.title.bold())
                    .padding(.top)

                List(SampleData.wods) { wod in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(wod.title)
                            .font(.headline)
                        Text(wod.description)
                            .font(.subheadline)
                            .foregroundColor(.gray)
                        
                        HStack {
                            NavigationLink("Start Timer") {
                                WODTimerView(wod: wod)
                                    .environmentObject(store)
                            }
                            .buttonStyle(.borderedProminent)

                            NavigationLink("Leaderboard") {
                                LeaderboardView(wod: wod)
                                    .environmentObject(store)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(.vertical, 8)
                }

                Spacer()
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
