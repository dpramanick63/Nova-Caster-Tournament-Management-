// Data layer — localStorage is the fast cache; Firebase index is the source
// of truth for *which tournaments exist*, so deletes propagate across devices.

import { pushIndex, pushMeta, pushMatches, removeRemote, fetchIndex } from './sync'
import { firebaseReady } from './firebase'

const KEY    = 'nova_tournaments'
const SYNCED = 'nova_synced_ids'   // ids we know have been pushed to Firebase

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function write(data) { localStorage.setItem(KEY, JSON.stringify(data)) }

function readSynced() {
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED)) || []) } catch { return new Set() }
}
function writeSynced(set) { localStorage.setItem(SYNCED, JSON.stringify([...set])) }
function markSynced(id) { const s = readSynced(); s.add(id); writeSynced(s) }
function unmarkSynced(id) { const s = readSynced(); s.delete(id); writeSynced(s) }

const byCreated = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
const INDEX_FIELDS = ['name', 'teams', 'date', 'playerType', 'playersPerTeam']

/**
 * Dashboard list. Firebase index is authoritative for existence:
 *  - local tournament present remotely  → keep
 *  - local tournament gone remotely but was synced → deleted elsewhere → drop
 *  - local tournament never synced      → migrate it up (one-time), keep
 */
export async function getTournaments() {
  const local = read()
  if (!firebaseReady) return [...local].sort(byCreated)

  let remote
  try { remote = await fetchIndex() }
  catch { return [...local].sort(byCreated) }   // offline → don't reconcile

  const remoteIds = new Set(remote.map(r => r.id))
  const synced    = readSynced()

  const keptLocal = []
  for (const t of local) {
    if (remoteIds.has(t.id)) { synced.add(t.id); keptLocal.push(t); continue } // confirmed in cloud
    if (synced.has(t.id)) { synced.delete(t.id); continue }   // was synced, now gone → deleted elsewhere
    // never synced → migrate up once and keep
    pushIndex(t); pushMeta(t.id, t); pushMatches(t.id, t.matchData || [])
    synced.add(t.id)
    keptLocal.push(t)
    remote.push({ ...t })
    remoteIds.add(t.id)
  }

  if (keptLocal.length !== local.length) write(keptLocal)
  writeSynced(synced)

  // Build the displayed list from the authoritative remote set,
  // preferring full local data (faster open) where we have it.
  const localById = Object.fromEntries(keptLocal.map(t => [t.id, t]))
  return remote
    .filter(r => r && r.id)
    .map(r => localById[r.id] || r)
    .sort(byCreated)
}

export function getTournament(id) {
  return Promise.resolve(read().find(t => t.id === id) || null)
}

/** Cache a tournament loaded from Firebase; mark it synced (it came from there). */
export function upsertLocal(t) {
  if (!t?.id) return
  const list = read()
  const idx  = list.findIndex(x => x.id === t.id)
  if (idx === -1) list.unshift(t)
  else list[idx] = { ...list[idx], ...t }
  write(list)
  markSynced(t.id)
}

export function createTournament(payload) {
  const list = read()
  const item = { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }
  list.unshift(item)
  write(list)
  pushIndex(item)
  pushMeta(item.id, item)
  markSynced(item.id)
  return Promise.resolve(item)
}

export function updateTournament(id, patch) {
  const list = read()
  const idx  = list.findIndex(t => t.id === id)
  if (idx === -1) return Promise.resolve(null)
  list[idx] = { ...list[idx], ...patch }
  write(list)
  if (INDEX_FIELDS.some(f => f in patch)) { pushIndex(list[idx]); markSynced(id) }
  return Promise.resolve(list[idx])
}

export function deleteTournament(id) {
  write(read().filter(t => t.id !== id))
  unmarkSynced(id)
  removeRemote(id)   // remove from Firebase so it vanishes on every device
  return Promise.resolve()
}
