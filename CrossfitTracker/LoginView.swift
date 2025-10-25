//
//  LoginView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var store: AppStore
    @State private var usernameInput: String = ""
    @State private var selectedRole: UserRole = .member
    @State private var emailInput: String = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    VStack(spacing: 8) {
                        Image(systemName: "flame.fill")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 80)
                            .foregroundColor(.orange)

                        Text("CrossFit Tracker")
                            .font(.title.bold())

                        Text("Create Your Account")
                            .font(.headline)
                            .foregroundColor(.gray)
                    }
                    .padding(.top, 60)

                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Your Name")
                                .font(.subheadline.bold())
                                .foregroundColor(.primary)
                                .padding(.horizontal, 40)

                            TextField("Enter your name", text: $usernameInput)
                                .textFieldStyle(.roundedBorder)
                                .padding(.horizontal, 40)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email (Optional)")
                                .font(.subheadline.bold())
                                .foregroundColor(.primary)
                                .padding(.horizontal, 40)

                            TextField("your.email@example.com", text: $emailInput)
                                .textFieldStyle(.roundedBorder)
                                .padding(.horizontal, 40)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Choose Your Role")
                                .font(.headline)
                                .padding(.horizontal, 40)

                            Picker("Role", selection: $selectedRole) {
                                ForEach(UserRole.allCases, id: \.self) { role in
                                    Text(role.rawValue).tag(role)
                                }
                            }
                            .pickerStyle(.segmented)
                            .padding(.horizontal, 40)

                            HStack(spacing: 8) {
                                Image(systemName: "info.circle.fill")
                                    .foregroundColor(.blue)
                                    .font(.caption)

                                Text(roleDescription)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            .padding(.horizontal, 40)
                        }
                    }

                    Button {
                        let trimmedName = usernameInput.trimmingCharacters(in: .whitespaces)
                        let trimmedEmail = emailInput.trimmingCharacters(in: .whitespaces)
                        guard !trimmedName.isEmpty else { return }

                        // Create user with selected role
                        let user = store.createUser(name: trimmedName, email: trimmedEmail, role: selectedRole)
                        store.setCurrentUser(user)
                    } label: {
                        Text("Create Account")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(usernameInput.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .padding(.horizontal, 40)
                    }
                    .disabled(usernameInput.trimmingCharacters(in: .whitespaces).isEmpty)

                    Spacer(minLength: 40)
                }
            }
        }
    }

    private var roleDescription: String {
        switch selectedRole {
        case .member:
            return "View assigned workouts and track your progress"
        case .coach:
            return "Create workout programs and manage members"
        case .admin:
            return "Full access to all features"
        }
    }
}
