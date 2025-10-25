//
//  CoachProgrammingView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/24/25.
//

import SwiftUI

struct CoachProgrammingView: View {
    @EnvironmentObject var store: AppStore
    @State private var selectedGym: Gym?
    @State private var selectedGroup: ProgrammingGroup?
    @State private var selectedDate = Date()
    @State private var showingAddWorkout = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Gym and Group selectors
                if !store.gyms.isEmpty {
                    Form {
                        Section("Select Gym") {
                            Picker("Gym", selection: $selectedGym) {
                                Text("Select...").tag(nil as Gym?)
                                ForEach(myGyms) { gym in
                                    Text(gym.name).tag(gym as Gym?)
                                }
                            }
                        }

                        if let gym = selectedGym {
                            Section("Select Group") {
                                Picker("Group", selection: $selectedGroup) {
                                    Text("Select...").tag(nil as ProgrammingGroup?)
                                    ForEach(store.getGroups(for: gym)) { group in
                                        Text(group.name).tag(group as ProgrammingGroup?)
                                    }
                                }
                            }
                        }

                        if selectedGym != nil && selectedGroup != nil {
                            Section("Schedule Workout") {
                                DatePicker("Date", selection: $selectedDate, displayedComponents: .date)

                                Button("Add Workout") {
                                    showingAddWorkout = true
                                }
                            }
                        }
                    }
                } else {
                    ContentUnavailableView(
                        "No Gyms",
                        systemImage: "building.2",
                        description: Text("Create a gym in the Manage tab to start programming workouts")
                    )
                }
            }
            .navigationTitle("Programming")
            .sheet(isPresented: $showingAddWorkout) {
                if let gym = selectedGym, let group = selectedGroup {
                    PostWorkoutView(gym: gym, group: group, date: selectedDate)
                        .environmentObject(store)
                }
            }
        }
    }

    private var myGyms: [Gym] {
        guard let user = store.currentUser else { return [] }
        return store.gyms.filter { $0.ownerUserId == user.id }
    }
}

struct PostWorkoutView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss

    let gym: Gym
    let group: ProgrammingGroup
    let date: Date

    var body: some View {
        NavigationStack {
            List {
                Section("Select WOD to Post") {
                    ForEach(SampleData.wods) { wod in
                        Button {
                            postWorkout(wod)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(wod.title)
                                    .font(.headline)
                                    .foregroundColor(.primary)

                                Text(wod.description)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Post Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func postWorkout(_ wod: WOD) {
        store.scheduleWOD(wod, for: date, gymId: gym.id, groupId: group.id)
        dismiss()
    }
}
