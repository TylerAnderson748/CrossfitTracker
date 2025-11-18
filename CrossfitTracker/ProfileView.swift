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
    @State private var editUsername = ""
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        NavigationView {
            List {
                // Alert for users without username
                if store.appUser?.username == nil || store.appUser?.username?.isEmpty == true {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Username Required")
                                    .font(.headline)
                                Text("Please set a username for your account")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button("Set Now") {
                                editFirstName = store.appUser?.firstName ?? ""
                                editLastName = store.appUser?.lastName ?? ""
                                editUsername = store.appUser?.username ?? ""
                                showingEditProfile = true
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.vertical, 4)
                    }
                }

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
                            if let username = store.appUser?.username {
                                Text("@\(username)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Text(store.userName)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(store.userRole.displayName)
                                .font(.caption)
                                .foregroundColor(.blue)
                        }

                        Spacer()

                        Button(action: {
                            editFirstName = store.appUser?.firstName ?? ""
                            editLastName = store.appUser?.lastName ?? ""
                            editUsername = store.appUser?.username ?? ""
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

                Section("Privacy Settings") {
                    Toggle(isOn: Binding(
                        get: { store.appUser?.hideFromLeaderboards ?? false },
                        set: { newValue in
                            store.updateLeaderboardVisibility(hideFromLeaderboards: newValue) { error in
                                if let error = error {
                                    print("❌ Error updating leaderboard visibility: \(error)")
                                }
                            }
                        }
                    )) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Hide from Leaderboards")
                                .font(.body)
                            Text("Your workout results won't be shown on public leaderboards")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Admin section - only visible to superAdmins
                if store.userRole == .superAdmin {
                    Section("Admin") {
                        NavigationLink(destination: AdminView()) {
                            HStack {
                                Image(systemName: "shield.fill")
                                    .foregroundColor(.purple)
                                Text("User Role Management")
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
                    username: $editUsername,
                    onSave: { saveProfile() }
                )
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
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

        print("🔄 Saving profile...")
        print("   First Name: \(editFirstName)")
        print("   Last Name: \(editLastName)")
        print("   Username: '\(editUsername)'")
        print("   Current username: '\(store.appUser?.username ?? "nil")'")

        // If username changed, validate it first
        let currentUsername = store.appUser?.username ?? ""
        let newUsername = editUsername.trimmingCharacters(in: .whitespaces)
        let usernameChanged = newUsername.lowercased() != currentUsername.lowercased()

        print("   Username changed: \(usernameChanged)")

        if usernameChanged && !newUsername.isEmpty {
            print("   → Checking username availability...")
            // Check username availability
            store.checkUsernameAvailability(username: newUsername) { [self] isAvailable, error in
                if let error = error {
                    print("   ❌ Error checking username: \(error)")
                    errorMessage = "Error checking username: \(error)"
                    showError = true
                    return
                }

                print("   → Username available: \(isAvailable)")
                if !isAvailable {
                    errorMessage = "Username '\(newUsername)' is already taken. Please choose a different username."
                    showError = true
                    return
                }

                // Username is available, proceed with update
                print("   → Updating profile in Firestore...")
                updateProfileInFirestore(userId: userId, username: newUsername)
            }
        } else {
            // No username change, just update
            print("   → No username change, updating profile...")
            updateProfileInFirestore(userId: userId, username: currentUsername)
        }
    }

    private func updateProfileInFirestore(userId: String, username: String) {
        print("   → Calling updateUserProfile with username: '\(username)'")
        store.updateUserProfile(userId: userId, firstName: editFirstName, lastName: editLastName, username: username) { error in
            if let error = error {
                print("❌ Error updating profile: \(error)")
                errorMessage = "Failed to update profile: \(error)"
                showError = true
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
    @Binding var username: String
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

                Section {
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Username")
                } footer: {
                    Text("Your unique username. This cannot be changed once set.")
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
                    .disabled(firstName.isEmpty || lastName.isEmpty || username.isEmpty)
                }
            }
        }
    }
}
