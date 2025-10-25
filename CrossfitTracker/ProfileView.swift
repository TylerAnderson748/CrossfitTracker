//
//  ProfileView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var store: AppStore
    @State private var showingJoinGym = false
    @State private var showingResetConfirmation = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100)
                    .foregroundColor(.blue)

                if let user = store.currentUser {
                    VStack(spacing: 8) {
                        Text(user.name)
                            .font(.title2.bold())

                        Text(user.role.rawValue)
                            .font(.subheadline)
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 6)
                            .background(roleColor(for: user.role))
                            .cornerRadius(12)

                        if !user.email.isEmpty {
                            Text(user.email)
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                    }

                    // User stats
                    VStack(spacing: 16) {
                        Divider()
                            .padding(.horizontal, 40)

                        HStack(spacing: 40) {
                            VStack {
                                Text("\(store.completedWODs.count)")
                                    .font(.title2.bold())
                                Text("WODs")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }

                            VStack {
                                Text("\(store.liftEntries.count)")
                                    .font(.title2.bold())
                                Text("Lifts")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }

                            if user.role.canManageGyms {
                                VStack {
                                    Text("\(myGymsCount)")
                                        .font(.title2.bold())
                                    Text("Gyms")
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                            }
                        }

                        Divider()
                            .padding(.horizontal, 40)
                    }
                    .padding(.top, 16)
                } else {
                    Text("Guest")
                        .font(.title2.bold())
                }

                // Join Gym button for all users
                Button {
                    showingJoinGym = true
                } label: {
                    Label("Join a Gym", systemImage: "building.2")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }

                Button {
                    store.logOut()
                } label: {
                    Text("Sign Out")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }

                // Developer reset option
                Button {
                    showingResetConfirmation = true
                } label: {
                    Label("Reset All Data", systemImage: "trash.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.top, 20)
                }

                Spacer()
            }
            .padding(.top, 80)
            .navigationTitle("Profile")
            .sheet(isPresented: $showingJoinGym) {
                JoinGymView()
                    .environmentObject(store)
            }
            .alert("Reset All Data?", isPresented: $showingResetConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Reset Everything", role: .destructive) {
                    store.clearAllData()
                }
            } message: {
                Text("This will permanently delete all users, gyms, workouts, and data. This cannot be undone!")
            }
        }
    }

    private var myGymsCount: Int {
        guard let user = store.currentUser else { return 0 }
        return store.gyms.filter { $0.ownerUserId == user.id }.count
    }

    private func roleColor(for role: UserRole) -> Color {
        switch role {
        case .member:
            return .green
        case .coach:
            return .blue
        case .admin:
            return .purple
        }
    }
}
