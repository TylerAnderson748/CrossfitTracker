//
//  GymManagementView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import SwiftUI

struct GymManagementView: View {
    @EnvironmentObject var store: AppStore
    @State private var showingCreateGym = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(myGyms) { gym in
                        NavigationLink(destination: GymDetailView(gym: gym).environmentObject(store)) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(gym.name)
                                    .font(.headline)

                                Text("\(store.getGroups(for: gym).count) groups")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                } header: {
                    Text("My Gyms")
                }
            }
            .navigationTitle("Gym Management")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateGym = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingCreateGym) {
                CreateGymView()
                    .environmentObject(store)
            }
        }
    }

    private var myGyms: [Gym] {
        guard let user = store.currentUser else { return [] }
        return store.gyms.filter { $0.ownerUserId == user.id }
    }
}

struct CreateGymView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    @State private var gymName: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Gym Details") {
                    TextField("Gym Name", text: $gymName)
                }
            }
            .navigationTitle("Create Gym")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createGym()
                    }
                    .disabled(gymName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func createGym() {
        let trimmed = gymName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        _ = store.createGym(name: trimmed)
        dismiss()
    }
}

struct GymDetailView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym
    @State private var showingCreateGroup = false

    var body: some View {
        List {
            // Pending join requests section
            if !pendingRequests.isEmpty {
                Section {
                    ForEach(pendingRequests) { request in
                        JoinRequestRow(request: request, gym: gym)
                            .environmentObject(store)
                    }
                } header: {
                    Label("\(pendingRequests.count) Pending Requests", systemImage: "person.badge.plus")
                }
            }

            // Programming Groups section
            Section {
                ForEach(store.getGroups(for: gym)) { group in
                    NavigationLink(destination: GroupMembersView(gym: gym, group: group).environmentObject(store)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.name)
                                .font(.headline)

                            Text("\(group.memberIds.count) members")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                }

                Button {
                    showingCreateGroup = true
                } label: {
                    Label("Add Custom Group", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Programming Groups")
            }

            // Stats section
            Section("Details") {
                LabeledContent("Name", value: gym.name)
                LabeledContent("Groups", value: "\(store.getGroups(for: gym).count)")
                LabeledContent("Members", value: "\(totalMembers)")
            }
        }
        .navigationTitle(gym.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingCreateGroup) {
            CreateProgrammingGroupView(gym: gym)
                .environmentObject(store)
        }
    }

    private var pendingRequests: [GymJoinRequest] {
        store.getPendingRequests(for: gym)
    }

    private var totalMembers: Int {
        Set(store.gymMemberships.filter { $0.gymId == gym.id }.map { $0.userId }).count
    }
}

struct JoinRequestRow: View {
    @EnvironmentObject var store: AppStore
    let request: GymJoinRequest
    let gym: Gym

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let user = store.getUser(byId: request.userId) {
                    Text(user.name)
                        .font(.headline)

                    Text(user.email)
                        .font(.caption)
                        .foregroundColor(.gray)
                } else {
                    Text("Unknown User")
                        .font(.headline)
                }

                Text(request.requestedAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.gray)
            }

            Spacer()

            HStack(spacing: 8) {
                Button {
                    store.approveJoinRequest(request)
                } label: {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.title2)
                }

                Button {
                    store.denyJoinRequest(request)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                        .font(.title2)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct CreateProgrammingGroupView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    let gym: Gym

    @State private var groupName: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Group Details") {
                    TextField("Group Name (e.g., Advanced, Beginners)", text: $groupName)
                }

                Section {
                    Text("Create custom groups to organize your members and assign different workouts to different skill levels or training focuses.")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            .navigationTitle("New Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createGroup()
                    }
                    .disabled(groupName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func createGroup() {
        let trimmed = groupName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        _ = store.createProgrammingGroup(name: trimmed, gymId: gym.id)
        dismiss()
    }
}

struct GroupMembersView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym
    let group: ProgrammingGroup

    var body: some View {
        List {
            Section {
                ForEach(members, id: \.id) { user in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.name)
                                .font(.headline)

                            if !user.email.isEmpty {
                                Text(user.email)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }

                        Spacer()

                        Text(user.role.rawValue)
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(roleColor(for: user.role))
                            .cornerRadius(8)
                    }
                }
            } header: {
                Text("\(members.count) Members")
            }
        }
        .navigationTitle(group.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var members: [User] {
        group.memberIds.compactMap { memberId in
            store.getUser(byId: memberId)
        }
    }

    private func roleColor(for role: UserRole) -> Color {
        switch role {
        case .member: return .green
        case .coach: return .blue
        case .admin: return .purple
        }
    }
}
