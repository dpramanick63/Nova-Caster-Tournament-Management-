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

/* ── Overlay cache (instant load before Firebase responds) ────── */
const CACHE = 'nova_overlay_'
export function readOverlayCache(id) {
  try { return JSON.parse(localStorage.getItem(CACHE + id)) || null } catch { return null }
}
function writeOverlayCache(id, data) {
  try { localStorage.setItem(CACHE + id, JSON.stringify(data)) } catch { /* quota */ }
}

/**
 * Subscribe to the overlay data with THREE separate listeners so a score
 * change only re-downloads the small `matches` node — never the logos in
 * `meta`. Combines them in memory, caches each update, and calls `cb`.
 */
export function subscribeOverlay(id, cb) {
  if (!firebaseReady || !db || !id) { cb(null); return () => {} }

  const combined = readOverlayCache(id) || { meta: null, matches: [], broadcast: null }
  let ready = false
  const emit = () => {
    if (!ready) return
    writeOverlayCache(id, combined)
    cb({ ...combined })
  }

  const subs = []
  const watch = (leaf) => onValue(ref(db, path(id, leaf)), snap => {
    combined[leaf] = snap.val()
    emit()
  })

  subs.push(watch('meta'))
  subs.push(watch('matches'))
  subs.push(watch('broadcast'))

  // First paint from cache immediately; live updates follow.
  ready = true
  cb({ ...combined })

  return () => subs.forEach(u => u && u())
}
