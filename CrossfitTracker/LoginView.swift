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

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Image(systemName: "flame.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100)
                    .foregroundColor(.orange)

                TextField("Enter your name", text: $usernameInput)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, 40)

                Button {
                    let trimmedName = usernameInput.trimmingCharacters(in: .whitespaces)
                    guard !trimmedName.isEmpty else { return }
                    store.logIn(name: trimmedName)
                } label: {
                    Text("Login")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(usernameInput.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }
                .disabled(usernameInput.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer()
            }
            .padding(.top, 100)
        }
    }
}
