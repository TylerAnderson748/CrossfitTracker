//
//  GroupManagementView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/26/25.
//

import SwiftUI

struct GroupManagementView: View {
    @EnvironmentObject var store: AppStore
    let gym: Gym

    @State private var groups: [WorkoutGroup] = []
    @State private var showingAddGroup = false
    @State private var selectedGroup: WorkoutGroup?

    var body: some View {
        List {
            ForEach(groups) { group in
                NavigationLink(destination: GroupDetailView(group: group, gym: gym).environmentObject(store)) {
                    GroupRow(group: group)
                }
            }
            .onDelete(perform: deleteGroups)
        }
        .navigationTitle("Groups")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showingAddGroup = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddGroup) {
            AddGroupSheet(gym: gym) { newGroup in
                saveGroup(newGroup)
            }
        }
        .onAppear {
            loadGroups()
        }
    }

    private func loadGroups() {
        guard let gymId = gym.id else { return }

        store.loadGroupsForGym(gymId: gymId) { loadedGroups, error in
            if let error = error {
                print("❌ Error loading groups: \(error)")
                return
            }

            self.groups = loadedGroups
        }
    }

    private func saveGroup(_ group: WorkoutGroup) {
        store.createGroup(group) { savedGroup, error in
            if let error = error {
                print("❌ Error creating group: \(error)")
                return
            }

            if let savedGroup = savedGroup {
                self.groups.append(savedGroup)
            }
        }
    }

    private func deleteGroups(at offsets: IndexSet) {
        // Collect groups to delete
        let groupsToDelete = offsets.map { groups[$0] }

        var deletedCount = 0
        let totalToDelete = groupsToDelete.count

        for group in groupsToDelete {
            if !group.isDeletable {
                print("⚠️ Cannot delete \(group.name) - it's not deletable")
                deletedCount += 1
                if deletedCount == totalToDelete {
                    loadGroups() // Reload to refresh the list
                }
                continue
            }

            guard let groupId = group.id else {
                deletedCount += 1
                if deletedCount == totalToDelete {
                    loadGroups() // Reload to refresh the list
                }
                continue
            }

            store.deleteGroup(groupId: groupId) { error in
                if let error = error {
                    print("❌ Error deleting group: \(error)")
                } else {
                    print("✅ Deleted group: \(group.name)")
                }

                deletedCount += 1
                if deletedCount == totalToDelete {
                    self.loadGroups() // Reload to refresh the list
                }
            }
        }
    }
}

struct GroupRow: View {
    let group: WorkoutGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(group.name)
                    .font(.headline)

                Spacer()

                if group.type == .personal {
                    Image(systemName: "person.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                } else if group.type == .defaultGroup {
                    Image(systemName: "star.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            HStack(spacing: 16) {
                Label("\(group.memberIds.count) members", systemImage: "person.3")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if group.membershipType == .autoAssignAll {
                    Label("Auto-assign", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                } else {
                    Label("Invite-only", systemImage: "lock.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                }

                if !group.isDeletable {
                    Label("Protected", systemImage: "exclamationmark.shield.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct AddGroupSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let gym: Gym
    let onSave: (WorkoutGroup) -> Void

    @State private var name: String = ""
    @State private var membershipType: MembershipType = .inviteOnly
    @State private var isPublic: Bool = false

    var body: some View {
        NavigationView {
            Form {
                Section("Group Details") {
                    TextField("Group Name", text: $name)
                }

                Section("Membership") {
                    Picker("Type", selection: $membershipType) {
                        Text("Invite Only").tag(MembershipType.inviteOnly)
                        Text("Auto-assign All Members").tag(MembershipType.autoAssignAll)
                    }
                    .pickerStyle(.segmented)

                    Toggle("Public Group", isOn: $isPublic)
                }

                Section {
                    Text("Auto-assign will automatically add all gym members to this group.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("Public groups may be used for future features like group leaderboards.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Create Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        guard let gymId = gym.id, let userId = store.currentUser?.uid else { return }

                        let group = WorkoutGroup(
                            gymId: gymId,
                            name: name,
                            type: .custom,
                            membershipType: membershipType,
                            ownerId: userId,
                            isPublic: isPublic
                        )

                        onSave(group)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

struct GroupDetailView: View {
    @EnvironmentObject var store: AppStore
    @State var group: WorkoutGroup
    let gym: Gym

    @State private var members: [AppUser] = []
    @State private var availableUsers: [AppUser] = []
    @State private var showingAddMember = false
    @State private var showingAddClassTime = false

    var body: some View {
        List {
            Section("Group Information") {
                HStack {
                    Text("Name")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(group.name)
                }

                HStack {
                    Text("Type")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(group.type == .defaultGroup ? "Default" : group.type == .custom ? "Custom" : "Personal")
                }

                HStack {
                    Text("Membership")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(group.membershipType == .autoAssignAll ? "Auto-assign All" : "Invite Only")
                }

                HStack {
                    Text("Visibility")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(group.isPublic ? "Public" : "Private")
                }
            }

            Section(header: HStack {
                Text("Default Class Times")
                Spacer()
                Button(action: { showingAddClassTime = true }) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.blue)
                }
            }) {
                if group.defaultTimeSlots.isEmpty {
                    Text("No class times set")
                        .foregroundColor(.secondary)
                        .italic()
                } else {
                    ForEach(group.defaultTimeSlots) { slot in
                        HStack {
                            Image(systemName: "clock")
                                .foregroundColor(.blue)
                            Text(slot.timeString)
                                .font(.body)
                            Spacer()
                            Text(slot.capacity == 0 ? "Unlimited" : "Cap: \(slot.capacity)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .onDelete(perform: deleteTimeSlot)
                }
            }

            Section("Workout Visibility") {
                Toggle("Hide details by default", isOn: Binding(
                    get: { group.hideDetailsByDefault },
                    set: { newValue in
                        var updatedGroup = group
                        updatedGroup.hideDetailsByDefault = newValue
                        updateGroupSettings(updatedGroup)
                    }
                ))

                if group.hideDetailsByDefault {
                    Picker("Reveal", selection: Binding(
                        get: { group.defaultRevealDaysBefore },
                        set: { newValue in
                            var updatedGroup = group
                            updatedGroup.defaultRevealDaysBefore = newValue
                            updateGroupSettings(updatedGroup)
                        }
                    )) {
                        Text("Same day").tag(0)
                        Text("Day before").tag(1)
                        Text("2 days before").tag(2)
                        Text("3 days before").tag(3)
                    }

                    DatePicker("At time", selection: Binding(
                        get: {
                            let calendar = Calendar.current
                            return calendar.date(from: DateComponents(hour: group.defaultRevealHour, minute: group.defaultRevealMinute)) ?? Date()
                        },
                        set: { newValue in
                            let calendar = Calendar.current
                            var updatedGroup = group
                            updatedGroup.defaultRevealHour = calendar.component(.hour, from: newValue)
                            updatedGroup.defaultRevealMinute = calendar.component(.minute, from: newValue)
                            updateGroupSettings(updatedGroup)
                        }
                    ), displayedComponents: .hourAndMinute)

                    // Show summary of reveal settings
                    HStack {
                        Image(systemName: "eye")
                            .foregroundColor(.blue)
                        Text(revealSummary(for: group))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Text("Workout names and descriptions will be hidden from members until the reveal time. Coaches and gym owners can always see details.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Section(header: HStack {
                Text("Members (\(group.memberIds.count))")
                Spacer()
                if group.membershipType == .inviteOnly {
                    Button(action: { showingAddMember = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.blue)
                    }
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
                                .foregroundColor(.blue)
                            VStack(alignment: .leading) {
                                Text(member.fullName.isEmpty ? member.email : member.fullName)
                                    .font(.body)
                                if !member.fullName.isEmpty {
                                    Text(member.email)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Spacer()

                            if group.membershipType == .inviteOnly && group.isDeletable {
                                Button(action: {
                                    removeMember(member)
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.red)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(group.name)
        .onAppear {
            loadMembers()
        }
        .sheet(isPresented: $showingAddMember) {
            AddMemberToGroupSheet(group: group, gym: gym, existingMembers: members) { userId in
                addMemberToGroup(userId: userId)
            }
        }
        .sheet(isPresented: $showingAddClassTime) {
            AddClassTimeSheet { newSlot in
                addTimeSlot(newSlot)
            }
        }
    }

    private func addTimeSlot(_ slot: DefaultTimeSlot) {
        guard let groupId = group.id else { return }

        var updatedGroup = group
        updatedGroup.defaultTimeSlots.append(slot)
        updatedGroup.defaultTimeSlots.sort { ($0.hour * 60 + $0.minute) < ($1.hour * 60 + $1.minute) }

        store.updateGroup(updatedGroup) { error in
            if let error = error {
                print("❌ Error adding time slot: \(error)")
            } else {
                self.group = updatedGroup
            }
        }
    }

    private func deleteTimeSlot(at offsets: IndexSet) {
        var updatedGroup = group
        updatedGroup.defaultTimeSlots.remove(atOffsets: offsets)

        store.updateGroup(updatedGroup) { error in
            if let error = error {
                print("❌ Error deleting time slot: \(error)")
            } else {
                self.group = updatedGroup
            }
        }
    }

    private func updateGroupSettings(_ updatedGroup: WorkoutGroup) {
        store.updateGroup(updatedGroup) { error in
            if let error = error {
                print("❌ Error updating group settings: \(error)")
            } else {
                self.group = updatedGroup
            }
        }
    }

    private func revealSummary(for group: WorkoutGroup) -> String {
        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short

        let calendar = Calendar.current
        let revealTime = calendar.date(from: DateComponents(hour: group.defaultRevealHour, minute: group.defaultRevealMinute)) ?? Date()
        let timeString = timeFormatter.string(from: revealTime)

        switch group.defaultRevealDaysBefore {
        case 0:
            return "Details revealed at \(timeString) on workout day"
        case 1:
            return "Details revealed day before at \(timeString)"
        case 2:
            return "Details revealed 2 days before at \(timeString)"
        default:
            return "Details revealed \(group.defaultRevealDaysBefore) days before at \(timeString)"
        }
    }

    private func loadMembers() {
        members = []
        for memberId in group.memberIds {
            store.loadUser(userId: memberId) { user, error in
                if let error = error {
                    print("❌ Error loading member: \(error)")
                    return
                }

                if let user = user, !self.members.contains(where: { $0.id == user.id }) {
                    self.members.append(user)
                }
            }
        }
    }

    private func addMemberToGroup(userId: String) {
        guard let groupId = group.id else { return }

        store.addUserToGroup(groupId: groupId, userId: userId) { error in
            if let error = error {
                print("❌ Error adding user to group: \(error)")
                return
            }

            // Reload members
            loadMembers()
        }
    }

    private func removeMember(_ member: AppUser) {
        guard let groupId = group.id, let memberId = member.id else { return }

        store.removeUserFromGroup(groupId: groupId, userId: memberId) { error in
            if let error = error {
                print("❌ Error removing user from group: \(error)")
                return
            }

            // Remove from local list
            if let index = members.firstIndex(where: { $0.id == memberId }) {
                members.remove(at: index)
            }
        }
    }
}

struct AddMemberToGroupSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var store: AppStore
    let group: WorkoutGroup
    let gym: Gym
    let existingMembers: [AppUser]
    let onAdd: (String) -> Void

    @State private var gymUsers: [AppUser] = []

    var availableUsers: [AppUser] {
        gymUsers.filter { user in
            !existingMembers.contains(where: { $0.id == user.id })
        }
    }

    var body: some View {
        NavigationView {
            List {
                if availableUsers.isEmpty {
                    Text("All gym members are already in this group")
                        .foregroundColor(.secondary)
                        .italic()
                } else {
                    ForEach(availableUsers) { user in
                        Button(action: {
                            if let userId = user.id {
                                onAdd(userId)
                                dismiss()
                            }
                        }) {
                            HStack {
                                Image(systemName: "person.circle")
                                    .foregroundColor(.blue)
                                VStack(alignment: .leading) {
                                    Text(user.fullName.isEmpty ? user.email : user.fullName)
                                        .foregroundColor(.primary)
                                    if !user.fullName.isEmpty {
                                        Text(user.email)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                                Image(systemName: "plus.circle")
                                    .foregroundColor(.blue)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadGymUsers()
            }
        }
    }

    private func loadGymUsers() {
        // Clear existing users to ensure fresh data
        gymUsers = []

        guard let gymId = gym.id else {
            print("❌ No gym ID")
            return
        }

        // Reload gym from Firestore to get latest member list
        store.loadGym(gymId: gymId) { loadedGym, error in
            if let error = error {
                print("❌ Error loading gym: \(error)")
                return
            }

            guard let loadedGym = loadedGym else {
                print("❌ Gym not found")
                return
            }

            // Load all gym members and coaches
            let allUserIds = Set(loadedGym.memberIds + loadedGym.coachIds)

            for userId in allUserIds {
                self.store.loadUser(userId: userId) { user, error in
                    if let error = error {
                        print("❌ Error loading user: \(error)")
                        return
                    }

                    if let user = user, !self.gymUsers.contains(where: { $0.id == user.id }) {
                        self.gymUsers.append(user)
                    }
                }
            }
        }
    }
}

struct AddClassTimeSheet: View {
    @Environment(\.dismiss) var dismiss
    let onSave: (DefaultTimeSlot) -> Void

    @State private var selectedTime: Date = {
        let calendar = Calendar.current
        return calendar.date(from: DateComponents(hour: 9, minute: 0)) ?? Date()
    }()
    @State private var capacity: Int = 20
    @State private var unlimitedCapacity: Bool = false

    var body: some View {
        NavigationView {
            Form {
                Section("Class Time") {
                    DatePicker("Time", selection: $selectedTime, displayedComponents: .hourAndMinute)
                }

                Section("Capacity") {
                    Toggle("Unlimited", isOn: $unlimitedCapacity)

                    if !unlimitedCapacity {
                        Stepper("Max attendees: \(capacity)", value: $capacity, in: 1...200)
                    }
                }

                Section {
                    Text("This sets the default class time for workouts assigned to this group. You can override these defaults when programming individual workouts.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Add Class Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let calendar = Calendar.current
                        let hour = calendar.component(.hour, from: selectedTime)
                        let minute = calendar.component(.minute, from: selectedTime)

                        let slot = DefaultTimeSlot(
                            hour: hour,
                            minute: minute,
                            capacity: unlimitedCapacity ? 0 : capacity
                        )

                        onSave(slot)
                        dismiss()
                    }
                }
            }
        }
    }
}
