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
        print("🔥 Firebase initialized successfully!")
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}
