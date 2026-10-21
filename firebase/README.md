# Firebase Spark Free-Tier Setup Guide (Phone & Laptop Sync)

This guide explains how to enable cross-device history synchronization between your phone and laptop using **Firebase Cloud Firestore** and **Firebase Authentication** on the **Spark Free Plan (₹0 / Free forever)**.

> **Zero-Cost Architecture:**  
> - **Firebase is 100% OPTIONAL.** Without Firebase, the application operates locally in browser **IndexedDB**.  
> - **Zero Firebase Storage:** Handwriting stroke images are kept in client IndexedDB. Only text predictions, corrections, and timestamps synchronize via Firestore. This ensures zero cloud bandwidth charges and strictly avoids paid tiers (Blaze).

---

## 1. Create a Firebase Project (Spark Plan)

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it `tero-handwriting`, and proceed on the default **Spark (No-cost)** plan.
3. Google Analytics can be disabled or enabled.

---

## 2. Enable Authentication (Email/Password & Anonymous)

1. In the Firebase console sidebar, navigate to **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Click **Email/Password** &rarr; Enable **Email/Password** &rarr; Save.
   - Click **Anonymous** &rarr; Enable &rarr; Save.
4. *Why this matters:* Restrictive Firestore rules (`request.auth != null`) prevent public internet access. Logging into the same account on your phone and laptop shares the exact same recognition history in real time.

---

## 3. Enable Cloud Firestore

1. In the sidebar, click **Build > Firestore Database**.
2. Click **Create database** (choose your closest location, e.g. `asia-south1` or `us-central1`).
3. Select **Start in production mode**.
4. Go to the **Rules** tab, paste the contents of `firebase/firestore.rules`, and click **Publish**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /recognition_attempts/{attemptId} {
         allow read, write: if request.auth != null;
       }
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

---

## 4. Register Web App & Add Keys to `frontend/.env`

1. In Project Settings > General, scroll down to **Your apps** and click the **Web icon (`</>`)**.
2. Register the app (e.g. `Tero Web App`).
3. Copy the keys and paste them into `frontend/.env` (and into Vercel Project Settings > Environment Variables when deploying):
   ```bash
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_PROJECT_ID=tero-handwriting
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef...
   VITE_FIREBASE_AUTH_DOMAIN=tero-handwriting.firebaseapp.com
   ```
4. Restart the frontend development server (`npm run dev`) or redeploy to Vercel.
5. In the app, click the **IndexedDB (Local)** / **Cloud Sync** badge in the header, sign in with your account on both your phone and laptop, and your recognition history will instantly sync across devices in real time.
