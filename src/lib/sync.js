// Live sync to Firebase Realtime Database for the OBS overlay URL.
// No-ops gracefully when Firebase isn't configured.

import { db, firebaseReady } from './firebase'
import { ref, set, onValue } from 'firebase/database'

// Firebase rejects `undefined`; round-trip strips it (undefined -> dropped).
const clean = (v) => JSON.parse(JSON.stringify(v ?? null))

const path = (id, leaf) => `tournaments/${id}/${leaf}`

/** Static-ish data: name, team list + logos, scoring. Changes rarely. */
export function pushMeta(id, t) {
  if (!firebaseReady || !db || !id) return Promise.resolve()
  return set(ref(db, path(id, 'meta')), clean({
    name: t.name || 'Tournament',
    logo: t.logo || null,
    teamData: t.teamData || [],
    positionPoints: t.positionPoints || [],
    killPoints: t.killPoints || 1,
    playersPerTeam: t.playersPerTeam || 4,
  })).catch(e => console.warn('[NOVA] pushMeta', e))
}

/** Dynamic match scores. Written on every kill/elimination. */
export function pushMatches(id, matchData) {
  if (!firebaseReady || !db || !id) return Promise.resolve()
  return set(ref(db, path(id, 'matches')), clean(matchData || []))
    .catch(e => console.warn('[NOVA] pushMatches', e))
}

/** What the overlay should display right now. */
export function pushBroadcast(id, b) {
  if (!firebaseReady || !db || !id) return Promise.resolve()
  return set(ref(db, path(id, 'broadcast')), clean(b))
    .catch(e => console.warn('[NOVA] pushBroadcast', e))
}

/** Overlay page subscribes to the whole tournament node (realtime). */
export function subscribeOverlay(id, cb) {
  if (!firebaseReady || !db || !id) { cb(null); return () => {} }
  return onValue(ref(db, `tournaments/${id}`), snap => cb(snap.val()))
}
