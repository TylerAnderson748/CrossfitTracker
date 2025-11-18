//
//  LoginView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var store: AppStore
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var username: String = ""
    @State private var isSignUpMode: Bool = false
    @State private var errorMessage: String = ""
    @State private var showError: Bool = false

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Image(systemName: "flame.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100)
                    .foregroundColor(.orange)
                    .padding(.top, 60)

                Text(isSignUpMode ? "Create Account" : "Welcome Back")
                    .font(.title)
                    .bold()

                VStack(spacing: 16) {
                    if isSignUpMode {
                        TextField("First Name", text: $firstName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .textInputAutocapitalization(.words)
                            .padding(.horizontal, 40)

                        TextField("Last Name", text: $lastName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .textInputAutocapitalization(.words)
                            .padding(.horizontal, 40)

                        TextField("Username", text: $username)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 40)
                    }

                    TextField("Email", text: $email)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 40)

                    SecureField("Password", text: $password)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .padding(.horizontal, 40)
                }

                if showError {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                        .padding(.horizontal, 40)
                }

                Button {
                    handleAuthAction()
                } label: {
                    Text(isSignUpMode ? "Sign Up" : "Log In")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(isFormValid ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }
                .disabled(!isFormValid)

                Button {
                    isSignUpMode.toggle()
                    showError = false
                    errorMessage = ""
                } label: {
                    Text(isSignUpMode ? "Already have an account? Log In" : "Don't have an account? Sign Up")
                        .font(.subheadline)
                        .foregroundColor(.blue)
                }

                Spacer()
            }
            .padding(.top, 40)
        }
    }

    private var isFormValid: Bool {
        if isSignUpMode {
            return !email.isEmpty && !password.isEmpty && password.count >= 6 && !firstName.isEmpty && !lastName.isEmpty && !username.isEmpty
        } else {
            return !email.isEmpty && !password.isEmpty && password.count >= 6
        }
    }

    private func handleAuthAction() {
        showError = false
        errorMessage = ""

        if isSignUpMode {
            store.signUp(email: email, password: password, username: username, firstName: firstName, lastName: lastName) { error in
                if let error = error {
                    errorMessage = error
                    showError = true
                }
            }
        } else {
            store.signIn(email: email, password: password) { error in
                if let error = error {
                    errorMessage = error
                    showError = true
                }
            }
        }
    }
}
