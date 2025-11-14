//
//  ProfileView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var store: AppStore
    @State private var gyms: [Gym] = []
    @State private var groups: [WorkoutGroup] = []
    @State private var showingEditProfile = false
    @State private var editFirstName = ""
    @State private var editLastName = ""

    var body: some View {
        NavigationView {
            List {
                Section {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 60)
                            .foregroundColor(.gray)

                        VStack(alignment: .leading, spacing: 4) {
                            if let fullName = store.appUser?.fullName, !fullName.isEmpty {
                                Text(fullName)
                                    .font(.title3.bold())
                            }
                            Text(store.userName)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Text(store.userRole.displayName)
                                .font(.caption)
                                .foregroundColor(.blue)
                        }

                        Spacer()

                        Button(action: {
                            editFirstName = store.appUser?.firstName ?? ""
                            editLastName = store.appUser?.lastName ?? ""
                            showingEditProfile = true
                        }) {
                            Image(systemName: "pencil.circle.fill")
                                .font(.title2)
                                .foregroundColor(.blue)
                        }
                    }
                    .padding(.vertical, 8)
                }

                if !gyms.isEmpty {
                    Section("My Gyms") {
                        ForEach(gyms) { gym in
                            HStack {
                                Image(systemName: "building.2")
                                    .foregroundColor(.orange)
                                VStack(alignment: .leading) {
                                    Text(gym.name)
                                        .font(.headline)
                                    if gym.ownerId == store.currentUser?.uid {
                                        Text("Owner")
                                            .font(.caption)
                                            .foregroundColor(.purple)
                                    } else if gym.coachIds.contains(store.currentUser?.uid ?? "") {
                                        Text("Coach")
                                            .font(.caption)
                                            .foregroundColor(.blue)
                                    } else {
                                        Text("Member")
                                            .font(.caption)
                                            .foregroundColor(.green)
                                    }
                                }
                            }
                        }
                    }
                }

                if !groups.isEmpty {
                    Section("My Groups") {
                        ForEach(groups) { group in
                            HStack {
                                Image(systemName: group.type == .personal ? "person.fill" : "person.3.fill")
                                    .foregroundColor(group.type == .personal ? .purple : .blue)
                                VStack(alignment: .leading) {
                                    Text(group.name)
                                        .font(.headline)
                                    if let gymId = group.gymId {
                                        if let gym = gyms.first(where: { $0.id == gymId }) {
                                            Text(gym.name)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                    } else {
                                        Text("Personal")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }

                Section {
                    Button(action: { store.logOut() }) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                        .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Profile")
            .onAppear {
                loadUserData()
            }
            .sheet(isPresented: $showingEditProfile) {
                EditProfileSheet(
                    firstName: $editFirstName,
                    lastName: $editLastName,
                    onSave: { saveProfile() }
                )
            }
        }
    }

    private func loadUserData() {
        guard let userId = store.currentUser?.uid else { return }

        // Load gyms
        store.loadGyms { allGyms, error in
            if let error = error {
                print("❌ Error loading gyms: \(error)")
                return
            }

            // Filter to gyms where user is owner, coach, or member
            self.gyms = allGyms.filter { gym in
                gym.ownerId == userId || gym.coachIds.contains(userId) || gym.memberIds.contains(userId)
            }
        }

        // Load groups
        store.loadGroupsForUser(userId: userId) { loadedGroups, error in
            if let error = error {
                print("❌ Error loading groups: \(error)")
                return
            }

            self.groups = loadedGroups
        }
    }

    private func saveProfile() {
        guard let userId = store.currentUser?.uid else { return }

        store.updateUserProfile(userId: userId, firstName: editFirstName, lastName: editLastName) { error in
            if let error = error {
                print("❌ Error updating profile: \(error)")
            } else {
                print("✅ Profile updated successfully")
                showingEditProfile = false
            }
        }
    }
}

struct EditProfileSheet: View {
    @Environment(\.dismiss) var dismiss
    @Binding var firstName: String
    @Binding var lastName: String
    let onSave: () -> Void

    var body: some View {
        NavigationView {
            Form {
                Section("Personal Information") {
                    TextField("First Name", text: $firstName)
                        .textInputAutocapitalization(.words)
                    TextField("Last Name", text: $lastName)
                        .textInputAutocapitalization(.words)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave()
                    }
                    .disabled(firstName.isEmpty || lastName.isEmpty)
                }
            }
        }
    }
}
