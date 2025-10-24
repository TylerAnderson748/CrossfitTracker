//
//  ProfileView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100)
                    .foregroundColor(.gray)

                Text(store.userName)
                    .font(.title2.bold())

                Button {
                    store.logOut() // ✅ Call directly on store
                } label: {
                    Text("Sign Out")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.horizontal, 40)
                }

                Spacer()
            }
            .padding(.top, 80)
            .navigationTitle("Profile")
        }
    }
}
