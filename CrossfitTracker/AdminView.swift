//
//  AdminView.swift
//  CrossfitTracker
//
//  Created by Claude on 11/18/25.
//

import SwiftUI

struct AdminView: View {
    @EnvironmentObject var store: AppStore
    @State private var searchEmail = ""
    @State private var searchedUser: AppUser?
    @State private var selectedRole: UserRole = .athlete
    @State private var isSearching = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showSuccess = false
    @State private var successMessage = ""

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text("Search for users by email to manage their roles")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } header: {
                    Text("User Role Management")
                }

                Section {
                    HStack {
                        TextField("User Email", text: $searchEmail)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)

                        Button("Search") {
                            searchUser()
                        }
                        .disabled(searchEmail.isEmpty || isSearching)
                    }
                } header: {
                    Text("Search User")
                }

                if let user = searchedUser {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Name:")
                                    .foregroundColor(.secondary)
                                Text(user.fullName.isEmpty ? "No name set" : user.fullName)
                            }

                            HStack {
                                Text("Email:")
                                    .foregroundColor(.secondary)
                                Text(user.email)
                            }

                            HStack {
                                Text("Username:")
                                    .foregroundColor(.secondary)
                                Text(user.username ?? "Not set")
                            }

                            HStack {
                                Text("Current Role:")
                                    .foregroundColor(.secondary)
                                Text(user.role.displayName)
                                    .foregroundColor(.blue)
                            }

                            HStack {
                                Text("User ID:")
                                    .foregroundColor(.secondary)
                                Text(user.id ?? "Unknown")
                                    .font(.caption)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Text("User Details")
                    }

                    Section {
                        Picker("New Role", selection: $selectedRole) {
                            ForEach([UserRole.athlete, UserRole.coach, UserRole.owner, UserRole.superAdmin], id: \.self) { role in
                                Text(role.displayName).tag(role)
                            }
                        }

                        Button("Update Role") {
                            updateUserRole()
                        }
                        .disabled(selectedRole == user.role || isSearching)
                    } header: {
                        Text("Change Role")
                    }
                }
            }
            .navigationTitle("Admin Panel")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .alert("Success", isPresented: $showSuccess) {
                Button("OK", role: .cancel) {
                    searchedUser = nil
                    searchEmail = ""
                }
            } message: {
                Text(successMessage)
            }
        }
    }

    private func searchUser() {
        isSearching = true

        store.findUserByEmail(email: searchEmail.trimmingCharacters(in: .whitespaces)) { user, error in
            isSearching = false

            if let error = error {
                errorMessage = error
                showError = true
                searchedUser = nil
                return
            }

            if let user = user {
                searchedUser = user
                selectedRole = user.role
            }
        }
    }

    private func updateUserRole() {
        guard let userId = searchedUser?.id else {
            errorMessage = "No user selected"
            showError = true
            return
        }

        isSearching = true

        store.updateUserRole(userId: userId, role: selectedRole) { error in
            isSearching = false

            if let error = error {
                errorMessage = "Failed to update role: \(error)"
                showError = true
                return
            }

            successMessage = "Successfully updated role to \(selectedRole.displayName)"
            showSuccess = true

            // Refresh user data
            searchUser()
        }
    }
}
