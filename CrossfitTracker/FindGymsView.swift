//
//  FindGymsView.swift
//  CrossfitTracker
//
//  Created by Claude on 11/25/25.
//

import SwiftUI

struct FindGymsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var allGyms: [Gym] = []
    @State private var searchText: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var pendingRequests: Set<String> = [] // Gym IDs with pending requests

    var filteredGyms: [Gym] {
        // Filter out gyms the user is already a member/coach/owner of
        let userGyms = allGyms.filter { gym in
            guard let userId = store.currentUser?.uid else { return false }
            return !(gym.ownerId == userId ||
                    gym.coachIds.contains(userId) ||
                    gym.memberIds.contains(userId))
        }

        if searchText.isEmpty {
            return userGyms
        } else {
            return userGyms.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        NavigationView {
            VStack {
                if isLoading {
                    ProgressView("Loading gyms...")
                        .padding()
                } else if filteredGyms.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)

                        Text(searchText.isEmpty ? "No gyms available" : "No matching gyms")
                            .font(.headline)
                            .foregroundColor(.secondary)

                        if !searchText.isEmpty {
                            Text("Try a different search term")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                } else {
                    List {
                        ForEach(filteredGyms) { gym in
                            GymSearchRow(
                                gym: gym,
                                hasPendingRequest: pendingRequests.contains(gym.id ?? ""),
                                onRequest: {
                                    requestMembership(gym: gym)
                                }
                            )
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search gyms")
                }
            }
            .navigationTitle("Find Gyms")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadGyms()
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown error")
            }
        }
    }

    private func loadGyms() {
        isLoading = true
        store.loadAllGyms { gyms, error in
            isLoading = false
            if let error = error {
                errorMessage = error
                showError = true
                return
            }

            allGyms = gyms
        }
    }

    private func requestMembership(gym: Gym) {
        guard let gymId = gym.id else { return }

        store.requestGymMembership(gymId: gymId, gymName: gym.name) { error in
            if let error = error {
                errorMessage = error
                showError = true
            } else {
                // Add to pending requests
                pendingRequests.insert(gymId)
                errorMessage = "Request sent to \(gym.name)!"
                showError = true
            }
        }
    }
}

struct GymSearchRow: View {
    let gym: Gym
    let hasPendingRequest: Bool
    let onRequest: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(gym.name)
                    .font(.headline)

                HStack(spacing: 16) {
                    Label("\(gym.coachIds.count) coaches", systemImage: "person.2")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Label("\(gym.memberIds.count) members", systemImage: "person.3")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if hasPendingRequest {
                Text("Pending")
                    .font(.caption)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(8)
            } else {
                Button(action: onRequest) {
                    Text("Request")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue)
                        .cornerRadius(8)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
