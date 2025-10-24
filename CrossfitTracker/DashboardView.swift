//
//  DashboardView.swift
//  CrossfitTracker
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var store: AppStore
    @State private var selectedWOD: WOD? = nil
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 16) {
                Text("Welcome, \(store.userName)")
                    .font(.title.bold())
                    .padding(.top)

                List(SampleData.wods) { wod in
                    VStack(alignment: .leading, spacing: 12) {
                        // WOD Info
                        VStack(alignment: .leading, spacing: 4) {
                            Text(wod.title)
                                .font(.headline)
                            Text(wod.description)
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            navigationPath.append(WODDestination.timer(wod))
                        }

                        // Buttons
                        HStack(spacing: 12) {
                            Button(action: {
                                navigationPath.append(WODDestination.timer(wod))
                            }) {
                                Label("Start Timer", systemImage: "timer")
                                    .font(.subheadline)
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)

                            Button(action: {
                                navigationPath.append(WODDestination.leaderboard(wod))
                            }) {
                                Label("Leaderboard", systemImage: "list.number")
                                    .font(.subheadline)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Dashboard")
            .navigationDestination(for: WODDestination.self) { destination in
                switch destination {
                case .timer(let wod):
                    WODTimerView(wod: wod)
                case .leaderboard(let wod):
                    LeaderboardView(wod: wod)
                }
            }
        }
    }
}

// Navigation destination enum
enum WODDestination: Hashable {
    case timer(WOD)
    case leaderboard(WOD)
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
            .environmentObject(AppStore.shared)
    }
}
