// Data layer.
//  • Firebase `index` = the single source of truth for which tournaments exist.
//  • localStorage = a cache of full tournament data for fast opening / offline.
// The dashboard shows exactly what's in the index, so a delete on one device
// removes it everywhere (live, via subscribeTournaments).

import { pushIndex, pushMeta, removeRemote, fetchIndex, subscribeIndex } from './sync'
import { firebaseReady } from './firebase'

const KEY = 'nova_tournaments'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function write(data) { localStorage.setItem(KEY, JSON.stringify(data)) }

const byCreated = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
const INDEX_FIELDS = ['name', 'teams', 'date', 'playerType', 'playersPerTeam']

// Combine the authoritative remote list with cached full local data.
function mergeList(remote) {
  const localById = Object.fromEntries(read().map(t => [t.id, t]))
  return remote.filter(r => r && r.id).map(r => localById[r.id] || r).sort(byCreated)
}

export async function getTournaments() {
  if (!firebaseReady) return read().sort(byCreated)     // offline → local cache
  try { return mergeList(await fetchIndex()) }
  catch { return read().sort(byCreated) }               // network error → local cache
}

/** Live dashboard list — reflects creates & deletes from every device instantly. */
export function subscribeTournaments(cb) {
  if (!firebaseReady) { cb(read().sort(byCreated)); return () => {} }
  return subscribeIndex(remote => cb(mergeList(remote)))
}

export function getTournament(id) {
  return Promise.resolve(read().find(t => t.id === id) || null)
}

/** Cache a tournament loaded from Firebase into localStorage. */
export function upsertLocal(t) {
  if (!t?.id) return
  const list = read()
  const i = list.findIndex(x => x.id === t.id)
  if (i === -1) list.unshift(t)
  else list[i] = { ...list[i], ...t }
  write(list)
}

export function createTournament(payload) {
  const list = read()
  const item = { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }
  list.unshift(item)
  write(list)
  pushIndex(item)
  pushMeta(item.id, item)
  return Promise.resolve(item)
}

export function updateTournament(id, patch) {
  const list = read()
  const i = list.findIndex(t => t.id === id)
  if (i === -1) return Promise.resolve(null)
  list[i] = { ...list[i], ...patch }
  write(list)
  if (INDEX_FIELDS.some(f => f in patch)) pushIndex(list[i])
  return Promise.resolve(list[i])
}

export function deleteTournament(id) {
  write(read().filter(t => t.id !== id))   // clear local cache
  removeRemote(id)                          // clear Firebase → vanishes on all devices
  return Promise.resolve()
}
