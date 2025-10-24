//
//  LiftsView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/18/25.
//

// LiftsView.swift

import SwiftUI

struct LiftsView: View {
    @EnvironmentObject var store: AppStore
    @State private var showingAddLift = false
    @State private var newLiftName = ""

    var body: some View {
        NavigationStack {
            VStack {
                List {
                    ForEach(store.lifts) { lift in
                        NavigationLink(destination: LiftDetailView(lift: lift).environmentObject(store)) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(lift.name)
                                        .font(.headline)
                                    // show most recent overall weight (any reps)
                                    if let recent = mostRecentWeightOverview(lift: lift) {
                                        Text("Recent: \(formatWeight(recent))")
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                    } else {
                                        Text("No entries yet")
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.gray)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                    .onDelete(perform: deleteLift)
                }
                .listStyle(.insetGrouped)

                Button(action: { showingAddLift = true }) {
                    Text("Add New Lift")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                        .padding([.horizontal, .bottom])
                }
            }
            .navigationTitle("Lifts")
            .sheet(isPresented: $showingAddLift) {
                NavigationStack {
                    Form {
                        Section(header: Text("New Lift")) {
                            TextField("Lift name", text: $newLiftName)
                        }
                    }
                    .navigationTitle("Add Lift")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showingAddLift = false; newLiftName = "" }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Add") {
                                let trimmed = newLiftName.trimmingCharacters(in: .whitespacesAndNewlines)
                                if !trimmed.isEmpty {
                                    store.addLift(name: trimmed)
                                }
                                showingAddLift = false
                                newLiftName = ""
                            }
                            .disabled(newLiftName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                }
            }
        }
    }

    func deleteLift(at offsets: IndexSet) {
        let ids = offsets.map { store.lifts[$0].id }
        store.lifts.remove(atOffsets: offsets)
        // optionally remove entries for those lifts
        store.liftEntries.removeAll { ids.contains($0.liftID) }
    }

    func mostRecentWeightOverview(lift: Lift) -> Double? {
        // look at all reps and take most recent overall
        let entries = store.liftEntries.filter { $0.liftID == lift.id }.sorted { $0.date > $1.date }
        return entries.first?.weight
    }

    func formatWeight(_ w: Double) -> String {
        String(format: "%.1f lb", w)
    }
}
