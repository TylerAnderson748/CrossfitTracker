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
        NavigationView {
            VStack(spacing: 32) {
                Image(systemName: "flame.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100)
                    .foregroundColor(.orange)

                TextField("Enter your name", text: $usernameInput)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding(.horizontal, 40)

                Button {
                    // all the function directly on store, not $store
                    store.logIn(name: usernameInput)
                } label: {
                    Text("Login")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(usernameInput.isEmpty ? Color.gray : Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }
                .disabled(usernameInput.isEmpty)

                Spacer()
            }
            .padding(.top, 100)
        }
    }
}
