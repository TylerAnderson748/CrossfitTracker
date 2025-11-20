# Firebase Setup Instructions

This project uses Firebase for authentication and database. You need to set up your own Firebase project to run the app.

## Setup Steps

1. **Go to Firebase Console**
   - Visit https://console.firebase.google.com/
   - Create a new project or select an existing one

2. **Add iOS App**
   - Click "Add app" and select iOS
   - Enter the bundle ID: `TylerAnderson.CrossfitTracker`
   - Download the `GoogleService-Info.plist` file

3. **Add Configuration to Project**
   - Copy the downloaded `GoogleService-Info.plist` file to the `CrossfitTracker/` directory
   - In Xcode, add the file to the `CrossfitTracker` target (drag it into the project navigator)
   - Make sure "Copy items if needed" is checked
   - Make sure it's added to the `CrossfitTracker` target

4. **Enable Firebase Services**
   - In Firebase Console, enable:
     - **Authentication** → Email/Password sign-in method
     - **Firestore Database** → Create database in production mode

5. **Firestore Security Rules**
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## Important Notes

- **DO NOT commit** `GoogleService-Info.plist` to git (it's already in .gitignore)
- Each developer/environment should use their own Firebase configuration
- The template file `GoogleService-Info-TEMPLATE.plist` is for reference only

## Troubleshooting

If you see build errors about missing GoogleService-Info.plist:
1. Make sure you've downloaded it from Firebase Console
2. Make sure it's named exactly `GoogleService-Info.plist`
3. Make sure it's in the `CrossfitTracker/` directory
4. Make sure it's added to the Xcode target
