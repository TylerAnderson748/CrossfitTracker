//
//  WODListView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
//

import SwiftUI

struct WODListView: View {
    let workouts = SampleData.wods

    var body: some View {
        NavigationView {
            List(workouts) { wod in
                NavigationLink(destination: WODTimerView(wod: wod)) {
                    Text(wod.title)
                }
            }
            .navigationTitle("WODs")
        }
    }
}
