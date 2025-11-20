//
//  WODListView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import SwiftUI

struct WODListView: View {
    @EnvironmentObject var store: AppStore
    @State private var showAddWOD = false
    @State private var newWODTitle = ""
    @State private var newWODDescription = ""

    var body: some View {
        NavigationView {
            List {
                ForEach(store.wods) { wod in
                    NavigationLink(destination: WODTimerView(wod: wod)) {
                        VStack(alignment: .leading) {
                            Text(wod.title)
                                .font(.headline)
                            Text(wod.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .onDelete(perform: deleteWOD)
            }
            .navigationTitle("WODs")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        showAddWOD = true
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddWOD) {
                NavigationView {
                    Form {
                        Section("WOD Details") {
                            TextField("WOD Name", text: $newWODTitle)
                            TextField("Description", text: $newWODDescription, axis: .vertical)
                                .lineLimit(3...6)
                        }

                        Section {
                            Button("Create WOD") {
                                createWOD()
                            }
                            .disabled(newWODTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .navigationTitle("New WOD")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") {
                                showAddWOD = false
                                newWODTitle = ""
                                newWODDescription = ""
                            }
                        }
                    }
                }
            }
        }
    }

    private func createWOD() {
        let trimmedTitle = newWODTitle.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return }

        store.addWOD(title: trimmedTitle, description: newWODDescription)

        showAddWOD = false
        newWODTitle = ""
        newWODDescription = ""
    }

    private func deleteWOD(at offsets: IndexSet) {
        for index in offsets {
            let wod = store.wods[index]
            store.deleteWOD(id: wod.id)
        }
    }
}
