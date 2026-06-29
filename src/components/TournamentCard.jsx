import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteTournament } from '../lib/db'
import ConfirmDialog from './ConfirmDialog'
import TournamentExport from './TournamentExport'

const TYPE_LABEL = { squad:'Squad', duo:'Duo', solo:'Solo', custom:'Custom' }

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function fmt(iso) {
  if (!iso) return '—'
  try { return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) }
  catch { return iso }
}

export default function TournamentCard({ tournament, onDeleted, style }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const { id, name, teams, playerType, playersPerTeam, date } = tournament

  function askDelete(e) {
    e.stopPropagation()
    setConfirming(true)
  }

  async function confirmDelete() {
    await deleteTournament(id)
    setConfirming(false)
    onDeleted(id)
  }

  return (
    <div className="t-card" style={style} onClick={() => navigate(`/tournament/${id}`)}>
      <div className="t-card__top">
        <p className="t-card__name">{name}</p>
      </div>

      <div className="t-card__meta">
        <div className="t-card__row">
          <span className="t-card__label">Teams</span>
          <span className="t-card__value">{teams}</span>
        </div>
        <div className="t-card__row">
          <span className="t-card__label">Format</span>
          <span className="t-card__badge">{TYPE_LABEL[playerType] || playerType}</span>
        </div>
        <div className="t-card__row">
          <span className="t-card__label">Players / team</span>
          <span className="t-card__value">{playersPerTeam}</span>
        </div>
      </div>

      <div className="t-card__footer">
        <div className="t-card__date-chip">
          <CalIcon />{fmt(date)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <TournamentExport tournament={tournament} className="texport--card" label="" menuUp />
          <button className="t-card__del" onClick={askDelete} title="Delete tournament">
            <TrashIcon />
          </button>
        </div>
      </div>

      {confirming && (
        <div onClick={e => e.stopPropagation()}>
          <ConfirmDialog
            title="Delete Tournament?"
            message={`"${name}" and all its match data will be permanently removed. This cannot be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={confirmDelete}
            onCancel={() => setConfirming(false)}
          />
        </div>
      )}
    </div>
  )
}
