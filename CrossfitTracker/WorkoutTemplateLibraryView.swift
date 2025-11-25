//
//  WorkoutTemplateLibraryView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/21/25.
//

import SwiftUI

struct WorkoutTemplateLibraryView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym?

    @State private var personalTemplates: [WorkoutTemplate] = []
    @State private var gymTemplates: [WorkoutTemplate] = []
    @State private var selectedWorkoutType: WorkoutType = .wod
    @State private var searchText: String = ""

    var filteredPersonalTemplates: [WorkoutTemplate] {
        personalTemplates.filter { template in
            template.workoutType == selectedWorkoutType &&
            (searchText.isEmpty ||
             template.title.localizedCaseInsensitiveContains(searchText) ||
             template.description.localizedCaseInsensitiveContains(searchText))
        }
    }

    var filteredGymTemplates: [WorkoutTemplate] {
        gymTemplates.filter { template in
            template.workoutType == selectedWorkoutType &&
            (searchText.isEmpty ||
             template.title.localizedCaseInsensitiveContains(searchText) ||
             template.description.localizedCaseInsensitiveContains(searchText))
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search templates...", text: $searchText)
            }
            .padding()
            .background(Color(.systemGray6))

            // Workout type picker
            Picker("Workout Type", selection: $selectedWorkoutType) {
                Text("WOD").tag(WorkoutType.wod)
                Text("Lift").tag(WorkoutType.lift)
            }
            .pickerStyle(.segmented)
            .padding()

            // Templates list
            List {
                // Personal templates section
                Section(header: HStack {
                    Image(systemName: "person.fill")
                        .font(.caption)
                    Text("My Saved \(selectedWorkoutType == .wod ? "WODs" : "Lifts")")
                    Spacer()
                }) {
                    if filteredPersonalTemplates.isEmpty {
                        Text(searchText.isEmpty ? "No saved templates yet" : "No matching templates")
                            .foregroundColor(.secondary)
                            .italic()
                    } else {
                        ForEach(filteredPersonalTemplates) { template in
                            TemplateRow(template: template)
                        }
                        .onDelete { indexSet in
                            deletePersonalTemplates(at: indexSet)
                        }
                    }
                }

                // Gym templates section (if gym is provided)
                if gym != nil {
                    Section(header: HStack {
                        Image(systemName: "building.2.fill")
                            .font(.caption)
                        Text("Gym Saved \(selectedWorkoutType == .wod ? "WODs" : "Lifts")")
                        Spacer()
                    }) {
                        if filteredGymTemplates.isEmpty {
                            Text(searchText.isEmpty ? "No gym templates yet" : "No matching templates")
                                .foregroundColor(.secondary)
                                .italic()
                        } else {
                            ForEach(filteredGymTemplates) { template in
                                TemplateRow(template: template)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Workout Library")
        .onAppear {
            loadTemplates()
        }
        .onChange(of: selectedWorkoutType) { _ in
            loadTemplates()
        }
    }

    private func loadTemplates() {
        guard let userId = store.currentUser?.uid else {
            print("❌ No user logged in")
            return
        }

        print("🔍 [WorkoutTemplateLibrary] Loading templates for user: \(userId), type: \(selectedWorkoutType.rawValue)")

        // Load personal templates
        store.loadUserWorkoutTemplates(userId: userId, workoutType: selectedWorkoutType) { templates, error in
            if let error = error {
                print("❌ Error loading personal templates: \(error)")
            } else {
                print("📥 [WorkoutTemplateLibrary] Received \(templates.count) templates from Firebase")
                for template in templates {
                    print("   - '\(template.title)' (isPersonal: \(template.isPersonal), type: \(template.workoutType.rawValue))")
                }
                self.personalTemplates = templates.filter { $0.isPersonal }
                print("✅ Loaded \(self.personalTemplates.count) personal templates after filtering")
            }
        }

        // Load gym templates (non-personal templates)
        // For now, we'll show all non-personal templates created by any user
        // In the future, we might want to filter by gym
        store.loadUserWorkoutTemplates(userId: userId, workoutType: selectedWorkoutType) { templates, error in
            if let error = error {
                print("❌ Error loading gym templates: \(error)")
            } else {
                self.gymTemplates = templates.filter { !$0.isPersonal }
                print("✅ Loaded \(self.gymTemplates.count) gym templates after filtering")
            }
        }
    }

    private func deletePersonalTemplates(at offsets: IndexSet) {
        let templatesToDelete = offsets.map { filteredPersonalTemplates[$0] }

        for template in templatesToDelete {
            guard let templateId = template.id else { continue }

            store.deleteWorkoutTemplate(templateId: templateId) { error in
                if let error = error {
                    print("❌ Error deleting template: \(error)")
                } else {
                    print("✅ Template deleted")
                    loadTemplates() // Reload templates
                }
            }
        }
    }
}

struct TemplateRow: View {
    let template: WorkoutTemplate

    private var workoutTypeColor: Color {
        template.workoutType == .wod ? .blue : .orange
    }

    private var workoutTypeIcon: String {
        template.workoutType == .wod ? "figure.run" : "dumbbell.fill"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(template.title)
                    .font(.headline)

                Spacer()

                // Workout type badge
                HStack(spacing: 4) {
                    Image(systemName: workoutTypeIcon)
                        .font(.caption2)
                    Text(template.workoutType.rawValue.uppercased())
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(workoutTypeColor)
                .cornerRadius(8)
            }

            Text(template.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(3)

            HStack {
                Image(systemName: "calendar")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text("Created \(template.createdAt, style: .date)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                if template.isPersonal {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.caption2)
                        Text("Personal")
                            .font(.caption)
                    }
                    .foregroundColor(.blue)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "building.2.fill")
                            .font(.caption2)
                        Text("Gym")
                            .font(.caption)
                    }
                    .foregroundColor(.green)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
