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

            // WODs list
            WODListView()
                .tabItem {
                    Label("WODs", systemImage: "list.bullet.rectangle")
                }

            // Lifts
            LiftsView()
                .tabItem {
                    Label("Lifts", systemImage: "figure.strengthtraining.traditional")
                }

            // Coach Programming - only for coaches and admins
            if store.currentUser?.role.canProgramWorkouts == true {
                CoachProgrammingView()
                    .tabItem {
                        Label("Programming", systemImage: "calendar.badge.plus")
                    }
            }

            // Gym Management - only for coaches and admins
            if store.currentUser?.role.canManageGyms == true {
                GymManagementView()
                    .tabItem {
                        Label("Manage", systemImage: "building.2.fill")
                    }
            }

            // Profile
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
        }
    }
}
