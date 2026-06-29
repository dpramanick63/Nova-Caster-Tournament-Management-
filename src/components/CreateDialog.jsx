import { useState, useRef, useEffect } from 'react'
import { createTournament } from '../lib/db'

const TYPES = [
  { key: 'squad',  label: 'Squad',  players: 4 },
  { key: 'duo',    label: 'Duo',    players: 2 },
  { key: 'solo',   label: 'Solo',   players: 1 },
  { key: 'custom', label: 'Custom', players: null },
]

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

export default function CreateDialog({ onClose, onCreated }) {
  const [name,     setName]     = useState('')
  const [teams,    setTeams]    = useState('')
  const [typeKey,  setTypeKey]  = useState('squad')
  const [custom,   setCustom]   = useState('')
  const [date,     setDate]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function ripple(e) {
    const btn  = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const sp   = document.createElement('span')
    sp.className = 'ripple'
    sp.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;`
    btn.appendChild(sp)
    setTimeout(() => sp.remove(), 700)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !teams) return
    const t = TYPES.find(t => t.key === typeKey)
    const ppt = typeKey === 'custom' ? (parseInt(custom) || 0) : t.players
    setLoading(true)
    const created = await createTournament({
      name:          name.trim(),
      teams:         parseInt(teams),
      playerType:    typeKey,
      playersPerTeam: ppt,
      date,
    })
    setLoading(false)
    onCreated(created)
  }

  const today = new Date().toISOString().slice(0,10)

  return (
    <div className="dialog-backdrop" onMouseDown={handleBackdrop}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div className="dialog__head">
          <p className="dialog__title" id="dlg-title">Create Tournament</p>
          <button className="dialog__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form className="dialog__body" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="field">
            <label htmlFor="t-name">Tournament Name</label>
            <input
              ref={nameRef}
              id="t-name"
              type="text"
              placeholder="e.g. FF Pro League S3"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Teams */}
          <div className="field">
            <label htmlFor="t-teams">Number of Teams</label>
            <input
              id="t-teams"
              type="number"
              placeholder="12"
              min="2"
              max="256"
              value={teams}
              onChange={e => setTeams(e.target.value)}
              required
            />
          </div>

          {/* Player type */}
          <div className="field">
            <label>Players per Team</label>
            <div className="seg-wrap">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`seg ${typeKey === t.key ? 'active' : ''}`}
                  onClick={() => setTypeKey(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={`custom-wrap ${typeKey === 'custom' ? 'visible' : ''}`}>
              <input
                type="number"
                placeholder="Players per team"
                min="1"
                max="99"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                style={{ marginTop: 8, width: '100%' }}
                required={typeKey === 'custom'}
              />
            </div>
          </div>

          {/* Date */}
          <div className="field">
            <label htmlFor="t-date">Tournament Date</label>
            <input
              id="t-date"
              type="date"
              min={today}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="dialog__submit"
            disabled={loading}
            onMouseDown={ripple}
          >
            {loading ? 'Creating…' : 'Create Tournament'}
          </button>
        </form>
      </div>
    </div>
  )
}
