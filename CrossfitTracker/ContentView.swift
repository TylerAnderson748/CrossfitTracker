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
            // WODs Tab
            DashboardView()
                .tabItem {
                    Image(systemName: "flame.fill")
                    Text("WODs")
                }

            // Lifts Tab
            LiftsView()
                .tabItem {
                    Image(systemName: "dumbbell.fill")
                    Text("Lifts")
                }

            // Profile Tab
            ProfileView()
                .tabItem {
                    Image(systemName: "person.fill")
                    Text("Profile")
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
