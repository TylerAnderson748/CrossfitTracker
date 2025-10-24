//
//  RootView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import SwiftUI

struct RootView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        Group {
            if store.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}
