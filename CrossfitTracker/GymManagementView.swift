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

    var body: some View {
        List {
            Section("Programming Groups") {
                ForEach(store.getGroups(for: gym)) { group in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.name)
                            .font(.headline)

                        Text("\(group.memberIds.count) members")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
            }

            Section("Details") {
                LabeledContent("Name", value: gym.name)
                LabeledContent("Groups", value: "\(store.getGroups(for: gym).count)")
            }
        }
        .navigationTitle(gym.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
