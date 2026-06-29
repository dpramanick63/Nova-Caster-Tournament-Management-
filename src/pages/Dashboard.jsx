import { useState, useEffect } from 'react'
import { getTournaments } from '../lib/db'
import TournamentCard from '../components/TournamentCard'
import CreateDialog   from '../components/CreateDialog'
import FAB            from '../components/FAB'
import { ToastStack, useToast } from '../components/Toast'

export default function Dashboard() {
  const [tournaments, setTournaments] = useState([])
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const { toasts, push } = useToast()

  useEffect(() => {
    getTournaments().then(setTournaments)
  }, [])

  function handleCreated(t) {
    setTournaments(prev => [t, ...prev])
    setDialogOpen(false)
    push(`"${t.name}" created`, 'success')
  }

  function handleDeleted(id) {
    setTournaments(prev => prev.filter(t => t.id !== id))
    push('Tournament deleted', 'info')
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
          <h1>Tournaments</h1>
          <p>{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} total</p>
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
