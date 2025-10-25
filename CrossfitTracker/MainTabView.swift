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
            // Weekly Plan - main tab for all users
            WeeklyPlanView()
                .tabItem {
                    Label("Weekly Plan", systemImage: "calendar")
                }
                .tag(0)

            // WODs list
            WODListView()
                .tabItem {
                    Label("WODs", systemImage: "list.bullet.rectangle")
                }
                .tag(1)

            // Lifts
            LiftsView()
                .tabItem {
                    Label("Lifts", systemImage: "figure.strengthtraining.traditional")
                }
                .tag(2)

            // Coach Programming - only for coaches and admins
            if let user = store.currentUser, user.role.canProgramWorkouts {
                CoachProgrammingView()
                    .tabItem {
                        Label("Programming", systemImage: "calendar.badge.plus")
                    }
                    .tag(3)
            }

            // Gym Management - only for coaches and admins
            if let user = store.currentUser, user.role.canManageGyms {
                GymManagementView()
                    .tabItem {
                        Label("Manage", systemImage: "building.2.fill")
                    }
                    .tag(4)
            }

            // Profile
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
                .tag(5)
        }
    }
}
