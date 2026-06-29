// Data layer — localStorage now, swap to MongoDB API calls later by replacing these functions.

const KEY = 'nova_tournaments'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getTournaments() {
  return Promise.resolve(read())
}

export function getTournament(id) {
  return Promise.resolve(read().find(t => t.id === id) || null)
}

export function createTournament(payload) {
  const list = read()
  const item = { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }
  list.unshift(item)
  write(list)
  return Promise.resolve(item)
}

export function updateTournament(id, patch) {
  const list = read()
  const idx  = list.findIndex(t => t.id === id)
  if (idx === -1) return Promise.resolve(null)
  list[idx] = { ...list[idx], ...patch }
  write(list)
  return Promise.resolve(list[idx])
}

export function deleteTournament(id) {
  write(read().filter(t => t.id !== id))
  return Promise.resolve()
}
