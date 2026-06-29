// Data layer — localStorage is the fast local cache; Firebase mirrors it
// so tournaments are reachable from any device.

import { pushIndex, pushMeta, removeRemote, fetchIndex } from './sync'

const KEY = 'nova_tournaments'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

// Fields that belong in the lightweight cross-device index.
const INDEX_FIELDS = ['name', 'teams', 'date', 'playerType', 'playersPerTeam']

/** Dashboard list = local tournaments + any remote-only ones (other devices). */
export async function getTournaments() {
  const local    = read()
  const localIds = new Set(local.map(t => t.id))
  const remote   = await fetchIndex()
  const stubs    = remote.filter(r => r && r.id && !localIds.has(r.id))
  return [...local, ...stubs].sort(
    (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  )
}

export function getTournament(id) {
  return Promise.resolve(read().find(t => t.id === id) || null)
}

/** Cache a tournament loaded from Firebase into localStorage. */
export function upsertLocal(t) {
  if (!t?.id) return
  const list = read()
  const idx  = list.findIndex(x => x.id === t.id)
  if (idx === -1) list.unshift(t)
  else list[idx] = { ...list[idx], ...t }
  write(list)
}

export function createTournament(payload) {
  const list = read()
  const item = { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }
  list.unshift(item)
  write(list)
  pushIndex(item)   // appear on other devices' dashboards
  pushMeta(item.id, item)
  return Promise.resolve(item)
}

export function updateTournament(id, patch) {
  const list = read()
  const idx  = list.findIndex(t => t.id === id)
  if (idx === -1) return Promise.resolve(null)
  list[idx] = { ...list[idx], ...patch }
  write(list)
  // Refresh the index only when a listed field changes (not on every kill).
  if (INDEX_FIELDS.some(f => f in patch)) pushIndex(list[idx])
  return Promise.resolve(list[idx])
}

export function deleteTournament(id) {
  write(read().filter(t => t.id !== id))
  removeRemote(id)  // remove from Firebase so it vanishes everywhere
  return Promise.resolve()
}
