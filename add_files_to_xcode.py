#!/usr/bin/env python3
"""
Script to add new Swift files to Xcode project.pbxproj
"""

import re
import hashlib

def generate_uuid():
    """Generate a unique 24-character hex ID similar to Xcode's format"""
    import random
    import string
    # Generate a random 24-character hex string (similar to Xcode's format)
    chars = string.hexdigits.upper()[:16]  # 0-9A-F
    return ''.join(random.choice(chars) for _ in range(24))

# New files to add
new_files = [
    {
        'name': 'ScheduledWorkout.swift',
        'path': 'Shared/ScheduledWorkout.swift',
        'group': 'Shared'
    },
    {
        'name': 'AddWorkoutView.swift',
        'path': 'CrossfitTracker/AddWorkoutView.swift',
        'group': 'CrossfitTracker'
    },
    {
        'name': 'WeeklySchedulerView.swift',
        'path': 'CrossfitTracker/WeeklySchedulerView.swift',
        'group': 'CrossfitTracker'
    },
    {
        'name': 'MonthlySchedulerView.swift',
        'path': 'CrossfitTracker/MonthlySchedulerView.swift',
        'group': 'CrossfitTracker'
    },
    {
        'name': 'ScheduledWorkoutsView.swift',
        'path': 'CrossfitTracker/ScheduledWorkoutsView.swift',
        'group': 'CrossfitTracker'
    }
]

# Read the project file
project_path = '/home/user/CrossfitTracker/CrossfitTracker.xcodeproj/project.pbxproj'
with open(project_path, 'r') as f:
    content = f.read()

# Generate IDs for each file
file_refs = {}
build_files = {}

for file_info in new_files:
    file_ref_id = generate_uuid()
    build_file_id = generate_uuid()
    file_refs[file_info['name']] = file_ref_id
    build_files[file_info['name']] = build_file_id
    print(f"{file_info['name']}: FileRef={file_ref_id}, BuildFile={build_file_id}")

# 1. Add PBXBuildFile entries (after /* Begin PBXBuildFile section */)
build_file_section = "/* Begin PBXBuildFile section */"
build_file_entries = "\n"
for file_info in new_files:
    name = file_info['name']
    build_file_entries += f"\t\t{build_files[name]} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[name]} /* {name} */; }};\n"

content = content.replace(
    build_file_section,
    build_file_section + build_file_entries
)

# 2. Add PBXFileReference entries (before /* End PBXFileReference section */)
file_ref_section_end = "/* End PBXFileReference section */"
file_ref_entries = ""
for file_info in new_files:
    name = file_info['name']
    file_ref_entries += f"\t\t{file_refs[name]} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = \"<group>\"; }};\n"

content = content.replace(
    file_ref_section_end,
    file_ref_entries + file_ref_section_end
)

# 3. Add to PBXGroup sections
# For Shared group
shared_group_pattern = r'(CDB1A7162EA3562600B13136 /\* Shared \*/ = \{[^}]+children = \([^)]+)'
match = re.search(shared_group_pattern, content, re.DOTALL)
if match:
    shared_children = match.group(1)
    for file_info in new_files:
        if file_info['group'] == 'Shared':
            name = file_info['name']
            shared_children += f"\n\t\t\t\t{file_refs[name]} /* {name} */,"
    content = content.replace(match.group(1), shared_children)

# For CrossfitTracker group - find the main app group
crossfit_group_pattern = r'(CDB1A6AB2EA34E8F00B13136 /\* CrossfitTracker \*/ = \{[^}]+children = \([^)]+)'
match = re.search(crossfit_group_pattern, content, re.DOTALL)
if match:
    crossfit_children = match.group(1)
    for file_info in new_files:
        if file_info['group'] == 'CrossfitTracker':
            name = file_info['name']
            crossfit_children += f"\n\t\t\t\t{file_refs[name]} /* {name} */,"
    content = content.replace(match.group(1), crossfit_children)

# 4. Add to PBXSourcesBuildPhase
sources_phase_pattern = r'(CDB1A6A52EA34E8F00B13136 /\* Sources \*/ = \{[^}]+files = \([^)]+)'
match = re.search(sources_phase_pattern, content, re.DOTALL)
if match:
    sources_files = match.group(1)
    for file_info in new_files:
        name = file_info['name']
        sources_files += f"\n\t\t\t\t{build_files[name]} /* {name} in Sources */,"
    content = content.replace(match.group(1), sources_files)

# Write the modified content back
with open(project_path, 'w') as f:
    f.write(content)

print("\n✅ Files added to Xcode project successfully!")
print("\nNext steps:")
print("1. Open the project in Xcode")
print("2. Clean build folder (Shift+Cmd+K)")
print("3. Build the project (Cmd+B)")
