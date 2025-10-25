# Firebase Setup Guide for CrossFit Tracker

## Step 1: Create Firebase Project (Do This First!)

### 1.1 Go to Firebase Console
1. Open browser: https://console.firebase.google.com
2. Click **"Add project"** or **"Create a project"**

### 1.2 Configure Project
1. **Project name:** `CrossFit-Tracker` (or whatever you prefer)
2. Click **Continue**
3. **Google Analytics:** Toggle OFF (not needed for now)
4. Click **Create project**
5. Wait ~30 seconds for setup to complete
6. Click **Continue**

## Step 2: Add iOS App to Firebase

### 2.1 Register Your App
1. In Firebase Console, click the **iOS icon** (⊕ iOS)
2. **iOS bundle ID:** `com.yourusername.CrossfitTracker`
   - ⚠️ **IMPORTANT:** This must match your Xcode project's Bundle Identifier
   - To find it: Open Xcode → Select project → General → Bundle Identifier
3. **App nickname:** `CrossFit Tracker` (optional)
4. **App Store ID:** Leave blank for now
5. Click **Register app**

### 2.2 Download Config File
1. Click **Download GoogleService-Info.plist**
2. **IMPORTANT:** Save this file - you'll add it to Xcode in Step 3

### 2.3 Complete Setup
1. Click **Next** (we'll add SDK via code)
2. Click **Next** (skip initialization for now)
3. Click **Continue to console**

## Step 3: Enable Authentication

### 3.1 Set Up Auth Methods
1. In Firebase Console, click **Authentication** in left sidebar
2. Click **Get started**
3. Click **Sign-in method** tab
4. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle **Enable**
   - Click **Save**

## Step 4: Set Up Firestore Database

### 4.1 Create Database
1. In Firebase Console, click **Firestore Database** in left sidebar
2. Click **Create database**
3. **Secure rules for testing:**
   - Select **Start in test mode** (we'll add security rules later)
   - Click **Next**
4. **Location:** Choose closest to you (e.g., `us-central` for US)
5. Click **Enable**
6. Wait for database to be created (~1 minute)

### 4.2 Set Up Security Rules (For Testing)
The test mode rules will look like this:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 2, 1);
    }
  }
}
```

⚠️ **WARNING:** These rules allow anyone to read/write for 30 days. We'll add proper security later.

## Step 5: Add Firebase SDK to Xcode

### 5.1 Add GoogleService-Info.plist
1. Open your Xcode project
2. Drag `GoogleService-Info.plist` into Xcode project navigator
3. **IMPORTANT:** Check these options:
   - ✅ Copy items if needed
   - ✅ Add to targets: CrossfitTracker
4. Click **Finish**

### 5.2 Add Firebase SDK via Swift Package Manager
1. In Xcode, go to **File → Add Package Dependencies**
2. Paste this URL: `https://github.com/firebase/firebase-ios-sdk`
3. **Dependency Rule:** Up to Next Major Version `11.0.0`
4. Click **Add Package**
5. **Select these packages:**
   - ✅ FirebaseAuth
   - ✅ FirebaseFirestore
   - ✅ FirebaseFirestoreSwift
6. Click **Add Package**
7. Wait for download (~2 minutes)

## Step 6: Verify Setup

Your project should now have:
- ✅ GoogleService-Info.plist in project
- ✅ Firebase packages in Package Dependencies
- ✅ Firestore Database created
- ✅ Authentication enabled

## Next Steps

After completing these steps:
1. I'll update your code to initialize Firebase
2. Convert authentication to use Firebase Auth
3. Convert data storage from UserDefaults to Firestore
4. Test real-time collaboration!

## Troubleshooting

**"GoogleService-Info.plist not found"**
- Make sure you dragged it into the Xcode project, not just the folder
- Check it's in the same group as your .swift files
- Verify "Target Membership" includes CrossfitTracker

**"Bundle ID mismatch"**
- Firebase bundle ID must exactly match Xcode bundle ID
- Case sensitive!
- Check in Firebase Console → Project Settings → Your apps

**"Package download failed"**
- Check internet connection
- Try again (sometimes Firebase servers are slow)
- Use Xcode 15+ for best compatibility

## Costs

With your current app usage:
- **Authentication:** FREE (unlimited)
- **Firestore:** FREE (well within 50K reads/20K writes per day)
- **Total:** $0/month ✅

You're all set to start coding with Firebase! 🎉
