// ────────────────────────────────────────────────────────────────
// Firebase Realtime Database — powers the live OBS overlay URL.
//
// HOW TO SET UP (one time, ~3 min):
//  1. Go to https://console.firebase.google.com  → "Add project" (any name).
//  2. In the project: build → "Realtime Database" → "Create Database"
//       → pick a location → start in "Test mode".
//  3. Project settings (gear icon) → "Your apps" → Web (</>) → register app.
//  4. Copy the firebaseConfig values it shows into the object below.
//       Make sure "databaseURL" is included (it looks like
//       https://<project>-default-rtdb.<region>.firebasedatabase.app).
//
// The app still works fully offline (localStorage) without this —
// Firebase only adds the shareable live overlay URL for OBS.
// ────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  databaseURL:       'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId:         'YOUR_PROJECT',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
}

export const firebaseReady =
  !!firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes('YOUR_')

let db = null
if (firebaseReady) {
  try {
    const app = initializeApp(firebaseConfig)
    db = getDatabase(app)
  } catch (e) {
    console.warn('[NOVA] Firebase init failed:', e)
  }
} else {
  console.info('[NOVA] Firebase not configured — running localStorage-only (no live overlay URL).')
}

export { db }
