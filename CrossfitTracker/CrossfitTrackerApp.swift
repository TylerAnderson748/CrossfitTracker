//
//  CrossfitTrackerApp.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI
import FirebaseCore

@main
struct CrossfitTrackerApp: App {
    @StateObject private var store = AppStore.shared

    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            if store.isLoggedIn {
                ContentView() // TabView with WODs, Lifts, Profile
                    .environmentObject(store)
            } else {
                LoginView()
                    .environmentObject(store)
            }
        }
    }
}
