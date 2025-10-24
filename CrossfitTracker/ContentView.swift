//
//  ContentView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "flame.fill")
                }

            LiftsView()
                .tabItem {
                    Label("Lifts", systemImage: "dumbbell.fill")
                }

            WODHistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }

    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(AppStore.shared)
    }
}
