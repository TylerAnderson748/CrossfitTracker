//
//  JoinGymView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

struct JoinGymView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var showingRequestSent = false

    var body: some View {
        NavigationStack {
            List {
                if !availableGyms.isEmpty {
                    Section("Available Gyms") {
                        ForEach(availableGyms) { gym in
                            GymBrowserRow(gym: gym, showingRequestSent: $showingRequestSent)
                                .environmentObject(store)
                        }
                    }
                } else {
                    Section {
                        VStack(spacing: 12) {
                            Image(systemName: "building.2")
                                .font(.largeTitle)
                                .foregroundColor(.gray)

                            Text("No gyms available")
                                .font(.headline)

                            Text("All available gyms have been joined or requested")
                                .font(.caption)
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                    }
                }
            }
            .navigationTitle("Join a Gym")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Request Sent", isPresented: $showingRequestSent) {
                Button("OK") { }
            } message: {
                Text("Your request to join the gym has been sent to the owner for approval.")
            }
        }
    }

    private var availableGyms: [Gym] {
        store.getAvailableGyms()
    }
}

struct GymBrowserRow: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym
    @Binding var showingRequestSent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(gym.name)
                        .font(.headline)

                    Text("\(store.getGroups(for: gym).count) groups")
                        .font(.caption)
                        .foregroundColor(.gray)
                }

                Spacer()

                if hasPendingRequest {
                    Text("Pending")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.orange)
                        .cornerRadius(12)
                } else {
                    Button("Request") {
                        store.requestToJoinGym(gym)
                        showingRequestSent = true
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var hasPendingRequest: Bool {
        guard let user = store.currentUser else { return false }
        return store.gymJoinRequests.contains(where: { $0.userId == user.id && $0.gymId == gym.id && $0.status == .pending })
    }
}
