// ────────────────────────────────────────────────────────────────
// Firebase Realtime Database — powers the live OBS overlay URL.
//
// Credentials come from environment variables (NOT hardcoded):
//   • Local dev  → put them in a .env.local file (see .env.example)
//   • Vercel     → Project → Settings → Environment Variables
//
// Vite only exposes vars prefixed with VITE_ to the browser.
// The app runs fully on localStorage even if these are unset —
// Firebase only adds the shareable live overlay URL for OBS.
// ────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = !!firebaseConfig.databaseURL

let db = null
if (firebaseReady) {
  try {
    const app = initializeApp(firebaseConfig)
    db = getDatabase(app)
  } catch (e) {
    console.warn('[NOVA] Firebase init failed:', e)
  }
} else {
  console.info('[NOVA] Firebase env vars not set — running localStorage-only (no live overlay URL).')
}

export { db }
