# Adding New Workout Scheduling Files to Xcode

The new workout scheduling feature files have been created but need to be added to your Xcode project.

## Files to Add

### Shared Folder (5 files total - 1 new):
1. **Shared/ScheduledWorkout.swift** ← NEW FILE

### CrossfitTracker Folder (4 new files):
1. **CrossfitTracker/AddWorkoutView.swift** ← NEW FILE
2. **CrossfitTracker/WeeklySchedulerView.swift** ← NEW FILE
3. **CrossfitTracker/MonthlySchedulerView.swift** ← NEW FILE
4. **CrossfitTracker/ScheduledWorkoutsView.swift** ← NEW FILE

## Steps to Add Files in Xcode

### Option 1: Drag and Drop (Easiest)
1. Open **CrossfitTracker.xcodeproj** in Xcode
2. In Finder, navigate to the project folder
3. Drag **Shared/ScheduledWorkout.swift** into the **Shared** group in Xcode's navigator
4. Drag the 4 new **CrossfitTracker/*.swift** files into the **CrossfitTracker** group
5. In the dialog that appears:
   - ✅ Check "Copy items if needed" (optional, files are already in place)
   - ✅ Check "CrossfitTracker" under "Add to targets"
   - Click **Finish**

### Option 2: Add Files Menu
1. Open **CrossfitTracker.xcodeproj** in Xcode
2. Right-click on **Shared** folder in the Project Navigator
3. Select **Add Files to "CrossfitTracker"...**
4. Navigate to and select **Shared/ScheduledWorkout.swift**
5. Make sure "CrossfitTracker" target is checked
6. Click **Add**
7. Repeat for the 4 new files in **CrossfitTracker** folder

### Option 3: Command Line (Advanced)
If you have `xcodeproj` Ruby gem installed:
```bash
# This is more complex and requires Ruby gems
gem install xcodeproj
# Then use a script to add files programmatically
```

## After Adding Files

1. **Build the project**: Cmd+B
2. If you see any errors about missing files, check that all 5 files were added to the **CrossfitTracker** target
3. You should now see the new **Schedule** tab when you run the app

## Verify Files Are Added

In Xcode's Project Navigator, you should see:
```
CrossfitTracker/
├── CrossfitTracker/
│   ├── AddWorkoutView.swift ← NEW
│   ├── MonthlySchedulerView.swift ← NEW
│   ├── ScheduledWorkoutsView.swift ← NEW
│   ├── WeeklySchedulerView.swift ← NEW
│   └── (other existing files)
└── Shared/
    ├── ScheduledWorkout.swift ← NEW
    └── (other existing files)
```

## Current Build Errors

The errors you're seeing:
```
Cannot find type 'ScheduledWorkout' in scope
```

Will be resolved once **Shared/ScheduledWorkout.swift** is added to the Xcode project.

---

All changes have been committed to git branch: `claude/duplicate-branch-0127VcnbcWa8UXLQgjAsBuCe`
