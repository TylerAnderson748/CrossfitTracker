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

    var userRole: UserRole {
        return store.appUser?.role ?? .athlete
    }

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }

            // Weekly Schedule for Athletes
            if userRole == .athlete {
                WeeklyPlanView()
                    .tabItem {
                        Label("Weekly Schedule", systemImage: "calendar.badge.clock")
                    }
            }

            WODListView()
                .tabItem {
                    Label("Workouts", systemImage: "list.bullet.rectangle")
                }

            // Coaching/Admin tabs for elevated roles
            if userRole.hasPermission(minimumRole: .coach) {
                CoachProgrammingView()
                    .tabItem {
                        Label("Programming", systemImage: "calendar.badge.plus")
                    }
            }

            if userRole.hasPermission(minimumRole: .owner) {
                GymManagementView()
                    .tabItem {
                        Label("Gyms", systemImage: "building.2.fill")
                    }
            }

            if userRole.hasPermission(minimumRole: .owner) {
                GroupManagementView()
                    .tabItem {
                        Label("Groups", systemImage: "person.3.fill")
                    }
            }

            if userRole == .superAdmin {
                AdminView()
                    .tabItem {
                        Label("Admin", systemImage: "gear")
                    }
            }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
        }
    }
}
