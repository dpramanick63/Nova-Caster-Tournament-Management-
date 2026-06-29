import { useState, useEffect } from 'react'
import { getTournaments } from '../lib/db'
import { fetchStorage } from '../lib/sync'
import { firebaseReady } from '../lib/firebase'
import TournamentCard from '../components/TournamentCard'
import CreateDialog   from '../components/CreateDialog'
import FAB            from '../components/FAB'
import { ToastStack, useToast } from '../components/Toast'

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function StorageMeter({ storage }) {
  if (!storage || !storage.ready) return null
  const pct = Math.min(100, (storage.used / storage.limit) * 100)
  const level = pct > 90 ? 'crit' : pct > 70 ? 'warn' : 'ok'
  return (
    <div className="storage-meter">
      <div className="storage-meter__head">
        <span className="storage-meter__label">Database Storage</span>
        <span className="storage-meter__val">
          {fmtBytes(storage.used)} <span className="storage-meter__cap">/ 1 GB</span>
        </span>
      </div>
      <div className="storage-meter__bar">
        <div className={`storage-meter__fill ${level}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
      </div>
      <span className="storage-meter__pct">{pct < 0.1 ? '<0.1' : pct.toFixed(1)}% used · {fmtBytes(storage.limit - storage.used)} free</span>
    </div>
  )
}

export default function Dashboard() {
  const [tournaments, setTournaments] = useState([])
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [storage,     setStorage]     = useState(null)
  const { toasts, push } = useToast()

  function refreshStorage() {
    if (firebaseReady) fetchStorage().then(setStorage)
  }

  useEffect(() => {
    getTournaments().then(setTournaments)
    refreshStorage()
  }, [])

  function handleCreated(t) {
    setTournaments(prev => [t, ...prev])
    setDialogOpen(false)
    push(`"${t.name}" created`, 'success')
    refreshStorage()
  }

  function handleDeleted(id) {
    setTournaments(prev => prev.filter(t => t.id !== id))
    push('Tournament deleted', 'info')
    setTimeout(refreshStorage, 600)   // let the Firebase delete settle
  }

  const now = new Date()
  const upcoming = tournaments.filter(t => !t.date || new Date(t.date + 'T00:00:00') >= now)
  const past     = tournaments.filter(t =>  t.date && new Date(t.date + 'T00:00:00') <  now)

  return (
    <div className="dashboard dashboard-enter">
      <nav className="nav">
        <span className="nav__logo">NOVA</span>
        <div className="nav__right">
          <div className="nav__dot" />
          <span className="nav__status">Live</span>
        </div>
      </nav>

      <main className="dash-main">
        <div className="dash-header">
          <div>
            <h1>Tournaments</h1>
            <p>{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} total</p>
          </div>
          <StorageMeter storage={storage} />
        </div>

        <div className="card-grid">
          {upcoming.length === 0 && past.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">◈</div>
              <p className="empty-state__title">No Tournaments Yet</p>
              <p className="empty-state__sub">Tap the + button to create your first tournament</p>
            </div>
          )}

          {upcoming.map((t, i) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              onDeleted={handleDeleted}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}

          {past.map((t, i) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              onDeleted={handleDeleted}
              style={{
                animationDelay: `${(upcoming.length + i) * 60}ms`,
                opacity: 0.55,
                filter: 'saturate(0.4)',
              }}
            />
          ))}
        </div>
      </main>

      <FAB onOpenDialog={() => setDialogOpen(true)} />

      {dialogOpen && (
        <CreateDialog
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  )
}
