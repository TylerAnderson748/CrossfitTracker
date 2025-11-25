//
//  MembershipRequestsView.swift
//  CrossfitTracker
//
//  Created by Claude on 11/25/25.
//

import SwiftUI

struct MembershipRequestsView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym

    @State private var pendingRequests: [GymMembershipRequest] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false

    var body: some View {
        VStack {
            if isLoading {
                ProgressView("Loading requests...")
                    .padding()
            } else if pendingRequests.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "tray")
                        .font(.system(size: 60))
                        .foregroundColor(.gray)

                    Text("No Pending Requests")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    Text("New membership requests will appear here")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding()
            } else {
                List {
                    ForEach(pendingRequests) { request in
                        MembershipRequestRow(
                            request: request,
                            onApprove: {
                                approveRequest(request)
                            },
                            onDeny: {
                                denyRequest(request)
                            }
                        )
                    }
                }
            }
        }
        .navigationTitle("Membership Requests")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadRequests()
        }
        .refreshable {
            loadRequests()
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
    }

    private func loadRequests() {
        guard let gymId = gym.id else { return }

        isLoading = true
        store.loadPendingMembershipRequests(gymId: gymId) { requests, error in
            isLoading = false
            if let error = error {
                errorMessage = error
                showError = true
                return
            }

            pendingRequests = requests
        }
    }

    private func approveRequest(_ request: GymMembershipRequest) {
        guard let requestId = request.id,
              let gymId = gym.id else { return }

        store.approveMembershipRequest(requestId: requestId, gymId: gymId, userId: request.userId) { error in
            if let error = error {
                errorMessage = error
                showError = true
            } else {
                // Remove from list
                pendingRequests.removeAll { $0.id == requestId }
            }
        }
    }

    private func denyRequest(_ request: GymMembershipRequest) {
        guard let requestId = request.id else { return }

        store.denyMembershipRequest(requestId: requestId) { error in
            if let error = error {
                errorMessage = error
                showError = true
            } else {
                // Remove from list
                pendingRequests.removeAll { $0.id == requestId }
            }
        }
    }
}

struct MembershipRequestRow: View {
    let request: GymMembershipRequest
    let onApprove: () -> Void
    let onDeny: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "person.circle.fill")
                    .font(.title)
                    .foregroundColor(.blue)

                VStack(alignment: .leading, spacing: 2) {
                    if let displayName = request.userDisplayName, !displayName.isEmpty {
                        Text(displayName)
                            .font(.headline)
                        Text(request.userEmail)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text(request.userEmail)
                            .font(.headline)
                    }

                    Text(timeAgo(from: request.requestedAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            HStack(spacing: 12) {
                Button(action: onApprove) {
                    Label("Approve", systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)

                Button(action: onDeny) {
                    Label("Deny", systemImage: "xmark.circle.fill")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }
        }
        .padding(.vertical, 8)
    }

    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        let hours = Int(interval / 3600)
        let minutes = Int(interval / 60)
        let days = hours / 24

        if days > 7 {
            let weeks = days / 7
            return "\(weeks)w ago"
        } else if days > 0 {
            return "\(days)d ago"
        } else if hours > 0 {
            return "\(hours)h ago"
        } else if minutes > 0 {
            return "\(minutes)m ago"
        } else {
            return "Just now"
        }
    }
}
