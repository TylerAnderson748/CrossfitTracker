//
//  GymManagementView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/25/25.
//

import SwiftUI

struct GymManagementView: View {
    @EnvironmentObject var store: AppStore
    @State private var gyms: [Gym] = []
    @State private var showingAddGym = false
    @State private var showingFindGyms = false
    @State private var selectedGym: Gym?

    var body: some View {
        NavigationView {
            VStack {
                if gyms.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "building.2")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)

                        Text("No Gyms Yet")
                            .font(.title2)
                            .foregroundColor(.secondary)

                        Text("Create a gym or request to join an existing one")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        HStack(spacing: 12) {
                            Button(action: { showingAddGym = true }) {
                                Label("Create Gym", systemImage: "plus.circle.fill")
                                    .font(.headline)
                            }
                            .buttonStyle(.borderedProminent)

                            Button(action: { showingFindGyms = true }) {
                                Label("Find Gyms", systemImage: "magnifyingglass")
                                    .font(.headline)
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(.top)
                    }
                    .padding()
                } else {
                    List {
                        ForEach(gyms) { gym in
                            NavigationLink(destination: GymDetailView(gym: gym).environmentObject(store)) {
                                GymRow(gym: gym)
                            }
                        }
                        .onDelete(perform: deleteGyms)
                    }
                }
            }
            .navigationTitle("Gym Management")
            .toolbar {
                if !gyms.isEmpty {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button(action: { showingFindGyms = true }) {
                            Label("Find", systemImage: "magnifyingglass")
                        }
                    }
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: { showingAddGym = true }) {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddGym) {
                AddGymSheet { gym in
                    saveGym(gym)
                }
            }
            .sheet(isPresented: $showingFindGyms) {
                FindGymsView()
                    .environmentObject(store)
            }
            .onAppear {
                loadGyms()
            }
        }
    }

    private func loadGyms() {
        store.loadGyms { loadedGyms, error in
            if let error = error {
                print("❌ Error loading gyms: \(error)")
                return
            }

            self.gyms = loadedGyms
        }
    }

    private func saveGym(_ gym: Gym) {
        store.createGym(name: gym.name) { savedGym, error in
            if let error = error {
                print("❌ Error creating gym: \(error)")
                return
            }

            if let savedGym = savedGym {
                self.gyms.append(savedGym)
            }
        }
    }

    private func deleteGyms(at offsets: IndexSet) {
        // Collect gyms to delete
        let gymsToDelete = offsets.map { gyms[$0] }

        var deletedCount = 0
        let totalToDelete = gymsToDelete.count

        for gym in gymsToDelete {
            guard let gymId = gym.id else {
                deletedCount += 1
                if deletedCount == totalToDelete {
                    loadGyms() // Reload to refresh the list
                }
                continue
            }

            store.deleteGym(gymId: gymId) { error in
                if let error = error {
                    print("❌ Error deleting gym: \(error)")
                } else {
                    print("✅ Deleted gym: \(gym.name)")
                }

                deletedCount += 1
                if deletedCount == totalToDelete {
                    self.loadGyms() // Reload to refresh the list
                }
            }
        }
    }
}

struct GymRow: View {
    let gym: Gym

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(gym.name)
                .font(.headline)

            HStack(spacing: 16) {
                Label("\(gym.coachIds.count) coaches", systemImage: "person.2")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Label("\(gym.memberIds.count) members", systemImage: "person.3")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct AddGymSheet: View {
    @Environment(\.dismiss) var dismiss
    let onSave: (Gym) -> Void

    @State private var name: String = ""
    @EnvironmentObject var store: AppStore

    var body: some View {
        NavigationView {
            Form {
                Section("Gym Details") {
                    TextField("Gym Name", text: $name)
                }
            }
            .navigationTitle("Create Gym")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        guard let userId = store.currentUser?.uid else { return }
                        let gym = Gym(name: name, ownerId: userId)
                        onSave(gym)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

struct GymDetailView: View {
    @EnvironmentObject var store: AppStore
    @State var gym: Gym

    @State private var coaches: [AppUser] = []
    @State private var members: [AppUser] = []
    @State private var showingAddCoach = false
    @State private var showingAddMember = false
    @State private var pendingRequestCount: Int = 0

    var isOwner: Bool {
        gym.ownerId == store.currentUser?.uid
    }

    var body: some View {
        List {
            Section("Gym Information") {
                HStack {
                    Text("Name")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(gym.name)
                }

                HStack {
                    Text("Created")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(gym.createdAt, style: .date)
                }
            }

            // Membership Requests section (only for owners)
            if isOwner && pendingRequestCount > 0 {
                Section {
                    NavigationLink(destination: MembershipRequestsView(gym: gym).environmentObject(store)) {
                        HStack {
                            Image(systemName: "person.badge.plus")
                                .foregroundColor(.orange)
                            Text("Membership Requests")
                            Spacer()
                            Text("\(pendingRequestCount)")
                                .font(.caption)
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.orange)
                                .cornerRadius(12)
                        }
                    }
                }
            }

            Section(header: HStack {
                Text("Coaches")
                Spacer()
                Button(action: { showingAddCoach = true }) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.blue)
                }
            }) {
                if coaches.isEmpty {
                    Text("No coaches yet")
                        .foregroundColor(.secondary)
                        .italic()
                } else {
                    ForEach(coaches) { coach in
                        HStack {
                            Image(systemName: "person.circle.fill")
                                .foregroundColor(.blue)
                            VStack(alignment: .leading) {
                                Text(coach.fullName.isEmpty ? coach.email : coach.fullName)
                                    .font(.body)
                                if !coach.fullName.isEmpty {
                                    Text(coach.email)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            Section(header: HStack {
                Text("Members")
                Spacer()
                Button(action: { showingAddMember = true }) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.blue)
                }
            }) {
                if members.isEmpty {
                    Text("No members yet")
                        .foregroundColor(.secondary)
                        .italic()
                } else {
                    ForEach(members) { member in
                        HStack {
                            Image(systemName: "person.circle.fill")
                                .foregroundColor(.gray)
                            VStack(alignment: .leading) {
                                Text(member.fullName.isEmpty ? member.email : member.fullName)
                                    .font(.body)
                                if !member.fullName.isEmpty {
                                    Text(member.email)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            Section("Groups") {
                NavigationLink(destination: GroupManagementView(gym: gym).environmentObject(store)) {
                    HStack {
                        Image(systemName: "person.3.sequence")
                            .foregroundColor(.purple)
                        Text("Manage Groups")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Section("Programming") {
                NavigationLink(destination: CoachProgrammingView(gym: gym).environmentObject(store)) {
                    HStack {
                        Image(systemName: "calendar.badge.plus")
                            .foregroundColor(.green)
                        Text("Create Programming")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                NavigationLink(destination: WorkoutTemplateLibraryView(gym: gym).environmentObject(store)) {
                    HStack {
                        Image(systemName: "book.fill")
                            .foregroundColor(.orange)
                        Text("Workout Library")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Gym Details")
        .onAppear {
            reloadGym()
        }
        .sheet(isPresented: $showingAddCoach) {
            AddUserToGymSheet(gym: gym, role: .coach) { email in
                addUserToGym(email: email, role: .coach)
            }
        }
        .sheet(isPresented: $showingAddMember) {
            AddUserToGymSheet(gym: gym, role: .athlete) { email in
                addUserToGym(email: email, role: .athlete)
            }
        }
    }

    private func addUserToGym(email: String, role: UserRole) {
        guard let gymId = gym.id else {
            print("❌ No gym ID")
            return
        }

        // Find user by email
        store.findUserByEmail(email: email) { user, error in
            if let error = error {
                print("❌ Error finding user: \(error)")
                return
            }

            guard let user = user, let userId = user.id else {
                print("❌ User not found or has no ID")
                return
            }

            // Add user to gym
            store.addUserToGym(gymId: gymId, userId: userId, role: role) { error in
                if let error = error {
                    print("❌ Error adding user to gym: \(error)")
                    return
                }

                // Add to local list
                if role == .coach {
                    if !self.coaches.contains(where: { $0.id == user.id }) {
                        self.coaches.append(user)
                    }
                } else {
                    if !self.members.contains(where: { $0.id == user.id }) {
                        self.members.append(user)
                    }
                }
            }
        }
    }

    private func reloadGym() {
        guard let gymId = gym.id else {
            print("❌ GymDetailView: No gym ID for reload")
            return
        }

        print("🔵 GymDetailView: Reloading gym \(gym.name) (\(gymId))")
        store.loadGym(gymId: gymId) { updatedGym, error in
            if let error = error {
                print("❌ GymDetailView: Error reloading gym: \(error)")
                return
            }

            if let updatedGym = updatedGym {
                print("✅ GymDetailView: Gym reloaded with \(updatedGym.memberIds.count) members")
                self.gym = updatedGym
                self.loadGymUsers()
                if self.isOwner {
                    self.loadPendingRequestCount()
                }
            }
        }
    }

    private func loadGymUsers() {
        // Clear existing lists
        coaches = []
        members = []

        print("🔵 GymDetailView: Loading users - \(gym.coachIds.count) coaches, \(gym.memberIds.count) members")

        // Load coaches
        for coachId in gym.coachIds {
            store.loadUser(userId: coachId) { user, error in
                if let error = error {
                    print("❌ Error loading coach: \(error)")
                    return
                }

                if let user = user, !self.coaches.contains(where: { $0.email == user.email }) {
                    print("✅ Adding coach to list: \(user.email)")
                    self.coaches.append(user)
                    print("   Total coaches now: \(self.coaches.count)")
                }
            }
        }

        // Load members
        for memberId in gym.memberIds {
            store.loadUser(userId: memberId) { user, error in
                if let error = error {
                    print("❌ Error loading member: \(error)")
                    return
                }

                if let user = user {
                    let alreadyExists = self.members.contains(where: { $0.email == user.email })
                    print("🔵 Processing member \(user.email): alreadyExists=\(alreadyExists)")

                    if !alreadyExists {
                        print("✅ Adding member to list: \(user.email)")
                        self.members.append(user)
                        print("   Total members now: \(self.members.count)")
                    } else {
                        print("⚠️ Skipping duplicate member: \(user.email)")
                    }
                }
            }
        }
    }

    private func loadPendingRequestCount() {
        guard let gymId = gym.id else {
            print("❌ GymDetailView: No gym ID for loading pending requests")
            return
        }

        print("🔵 GymDetailView: Loading pending request count for gym \(gym.name) (\(gymId))")
        store.loadPendingMembershipRequests(gymId: gymId) { requests, error in
            if let error = error {
                print("❌ GymDetailView: Error loading pending requests: \(error)")
                return
            }

            print("✅ GymDetailView: Found \(requests.count) pending requests")
            pendingRequestCount = requests.count
        }
    }
}

struct AddUserToGymSheet: View {
    @Environment(\.dismiss) var dismiss
    let gym: Gym
    let role: UserRole
    let onAdd: (String) -> Void

    @State private var email: String = ""

    var body: some View {
        NavigationView {
            Form {
                Section("User Email") {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                }

                Section {
                    Text("Enter the email address of the user you want to add as a \(role.displayName.lowercased()).")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Add \(role.displayName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onAdd(email)
                        dismiss()
                    }
                    .disabled(email.isEmpty)
                }
            }
        }
    }
}
