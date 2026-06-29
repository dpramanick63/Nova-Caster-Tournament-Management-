import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTournament, updateTournament, deleteTournament } from '../lib/db'
import MatchSettings from '../components/match/MatchSettings'
import MatchTab      from '../components/match/MatchTab'
import ConfirmDialog from '../components/ConfirmDialog'
import { ToastStack, useToast } from '../components/Toast'
import { pushMeta, pushMatches } from '../lib/sync'

export default function TournamentDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const [confirmDel, setConfirmDel] = useState(false)
  const { toasts, push } = useToast()
  const [tourn, setTourn]      = useState(null)
  const [activeTab, setActive] = useState(0)

  useEffect(() => {
    getTournament(id).then(t => {
      if (!t) { navigate('/dashboard'); return }
      setTourn(t)
      // seed the live overlay with current data
      pushMeta(id, t)
      pushMatches(id, t.matchData || [])
    })
  }, [id])

  async function handleSettingsSaved(patch, msg) {
    const updated = await updateTournament(id, patch)
    setTourn(updated)
    pushMeta(id, updated)
    pushMatches(id, updated.matchData || [])
    if (msg) push(msg, 'success')
  }

  async function handleMatchUpdated(matchIndex, matchData) {
    const matches = [...(tourn.matchData || [])]
    matches[matchIndex] = matchData
    const updated = await updateTournament(id, { matchData: matches })
    setTourn(updated)
    pushMatches(id, matches)   // live: stream scores to the overlay
  }

  async function handleDelete() {
    await deleteTournament(id)
    navigate('/dashboard')
  }

  if (!tourn) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', color:'var(--tx2)',
      fontFamily:'Orbitron,sans-serif', fontSize:'0.85rem', letterSpacing:'2px',
    }}>
      LOADING…
    </div>
  )

  const settingsSaved = tourn.settingsSaved || false
  const numMatches    = tourn.numMatches    || 0

  return (
    <div className="t-detail">
      {/* Nav */}
      <nav className="nav">
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button className="nav__back" onClick={() => navigate('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
          <span className="nav__logo">{tourn.name}</span>
        </div>
        <div className="nav__right">
          <button className="nav__delete" onClick={() => setConfirmDel(true)} title="Delete tournament">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
            Delete
          </button>
          <div className="nav__dot" />
          <span className="nav__status">System Online</span>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 0 ? 'active' : ''}`}
          onClick={() => setActive(0)}
        >
          Match Settings
        </button>

        {settingsSaved && Array.from({ length: numMatches }, (_, i) => (
          <button
            key={i}
            className={`tab-btn ${activeTab === i + 1 ? 'active' : ''}`}
            onClick={() => setActive(i + 1)}
          >
            Match {i + 1}
            {tourn.matchData?.[i]?.isLive && <span className="tab-live-dot" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 0 ? (
          <MatchSettings
            tournament={tourn}
            onSave={handleSettingsSaved}
          />
        ) : (
          <MatchTab
            key={activeTab}
            tournament={tourn}
            matchIndex={activeTab - 1}
            matchData={(tourn.matchData || [])[activeTab - 1] || null}
            onUpdate={data => handleMatchUpdated(activeTab - 1, data)}
          />
        )}
      </div>

      {confirmDel && (
        <ConfirmDialog
          title="Delete Tournament?"
          message={`"${tourn.name}" and all its match data will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  )
}
