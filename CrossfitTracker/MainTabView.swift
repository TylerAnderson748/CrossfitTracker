//
//  MainTabView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        TabView {
            // All users see Dashboard
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }

            // All users see Weekly Plan
            WeeklyPlanView()
                .tabItem {
                    Label("Weekly Plan", systemImage: "calendar")
                }

            // Coaches and above see Programming
            if store.userRole.hasPermission(minimumRole: .coach) {
                CoachProgrammingView()
                    .tabItem {
                        Label("Programming", systemImage: "calendar.badge.plus")
                    }
            }

            // Owners and above see Gym Management
            if store.userRole.hasPermission(minimumRole: .owner) {
                GymManagementView()
                    .tabItem {
                        Label("Gym", systemImage: "building.2")
                    }
            }

            // All users see WODs
            WODListView()
                .tabItem {
                    Label("WODs", systemImage: "list.bullet.rectangle")
                }

            // All users see Profile
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
        }
    }
}
