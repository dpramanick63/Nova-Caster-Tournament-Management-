import { useState, useCallback, useRef, useEffect } from 'react'
import { CurrentLeaderboard, MatchResults, OverallStandings } from './LiveLeaderboard'
import ConfirmDialog from '../ConfirmDialog'
import { lbVars } from '../../lib/utils'
import { pushBroadcast } from '../../lib/sync'

function freshMatchState(tournament) {
  return {
    map: '',
    isLive: false,
    isPaused: false,
    isEnded: false,
    overlayColor: '#00b140',
    overlayView: 'current',
    teams: Array.from({ length: tournament.teams || 0 }, (_, ti) => ({
      teamIndex: ti,
      boxes: Array(tournament.playersPerTeam || 4).fill(false),
      kills: 0,
      eliminated: false,
      eliminationRank: null,
    })),
  }
}

export default function MatchTab({ tournament, matchIndex, matchData, onUpdate }) {
  const [ms, setMs] = useState(() => matchData || freshMatchState(tournament))

  // Overlay leaderboard scale (persisted in match state)
  const lbScale = ms.lbScale || 1
  function changeScale(delta) {
    save(prev => ({ ...prev, lbScale: Math.min(2.4, Math.max(0.6, +(((prev.lbScale || 1) + delta).toFixed(2)))) }))
  }

  // Overlay glass style (persisted) — opaque by default
  const STYLE_DEFAULT = { blur: 0, opacity: 1, darkness: 1 }
  const lbStyle = { ...STYLE_DEFAULT, ...(ms.lbStyle || {}) }
  const [showSettings, setShowSettings] = useState(false)
  function setStyle(patch) {
    save(prev => ({ ...prev, lbStyle: { ...STYLE_DEFAULT, ...(prev.lbStyle || {}), ...patch } }))
  }

  // Manual drag-resize of the leaderboard (local UI)
  const [lbW, setLbW] = useState(380)
  const [lbH, setLbH] = useState(null)
  const lbFrame = {
    width: lbW,
    height: lbH,
    scale: lbScale,
    onResize: (w, h) => { setLbW(w); setLbH(h) },
  }

  // Push "what to show" to Firebase so the OBS overlay URL stays in sync.
  // Debounced so dragging the size/resize doesn't spam the database.
  useEffect(() => {
    const t = setTimeout(() => {
      pushBroadcast(tournament.id, {
        matchIndex,
        view: ms.overlayView || 'current',
        screenColor: ms.overlayColor || '#00b140',
        scale: lbScale,
        style: lbStyle,
        w: lbW,
        h: lbH,
      })
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id, matchIndex, ms.overlayView, ms.overlayColor, lbScale,
      lbStyle.blur, lbStyle.opacity, lbStyle.darkness, lbW, lbH])

  // Resizable split (local UI only)
  const [leftPct, setLeftPct] = useState(50)
  const splitRef = useRef(null)
  const dragging = useRef(false)

  function startDrag(e) {
    dragging.current = true
    e.preventDefault()
  }
  useEffect(() => {
    function onMove(e) {
      if (!dragging.current || !splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(75, Math.max(28, pct)))
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const save = useCallback((patch) => {
    setMs(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      onUpdate(next)
      return next
    })
  }, [onUpdate])

  /* ── live controls ──────────────────────────────────────── */
  const canEdit = ms.isLive && !ms.isPaused
  const hasMap  = !!ms.map
  const [confirmReset, setConfirmReset] = useState(false)
  const [showExport,   setShowExport]   = useState(false)

  // Downloadable when the match isn't actively live and has been played
  // (i.e. after End, or any time there's score data to export).
  const hasData    = ms.teams.some(t => t.kills > 0 || t.eliminated)
  const matchEnded = !ms.isLive && (ms.isEnded || hasData)

  async function downloadPDF() {
    const { exportMatchPDF } = await import('../../lib/exporters')
    await exportMatchPDF(tournament, ms, matchIndex)
    setShowExport(false)
  }
  async function downloadXLSX() {
    const { exportMatchXLSX } = await import('../../lib/exporters')
    exportMatchXLSX(tournament, ms, matchIndex)
    setShowExport(false)
  }

  const [copied, setCopied] = useState(false)
  function copyOverlayUrl() {
    const url = `${window.location.origin}/overlay/${tournament.id}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  function toggleLive() {
    if (!ms.isLive) {
      if (!hasMap) return   // must pick a map first
      save({ isLive:true, isPaused:false, isEnded:false, overlayView:'current' })
    } else {
      save({ isLive:false, isEnded:true })
    }
  }

  function togglePause() {
    save(prev => ({ ...prev, isPaused: !prev.isPaused }))
  }

  function resetScores() {
    save(prev => ({
      ...prev,
      isLive: false,
      isPaused: false,
      isEnded: false,
      teams: prev.teams.map(t => ({
        ...t,
        boxes: t.boxes.map(() => false),
        kills: 0,
        eliminated: false,
        eliminationRank: null,
      })),
    }))
    setConfirmReset(false)
  }

  /* ── box click ──────────────────────────────────────────── */
  function handleBox(teamIdx, boxIdx) {
    if (!canEdit) return
    save(prev => {
      const teams = prev.teams.map((t) => {
        if (t.teamIndex !== teamIdx) return t
        const newBoxes = t.boxes.map((b,bi) => bi===boxIdx ? !b : b)
        const allDead  = newBoxes.every(Boolean)
        const wasElim  = t.eliminated
        let elimRank   = t.eliminationRank
        if (!wasElim && allDead) {
          elimRank = prev.teams.filter(x => !x.eliminated).length
        }
        return {
          ...t,
          boxes: newBoxes,
          eliminated: allDead,
          eliminationRank: allDead ? elimRank : null,
        }
      })
      return { ...prev, teams }
    })
  }

  /* ── kill counter ───────────────────────────────────────── */
  function changeKills(teamIdx, delta) {
    if (!canEdit) return
    save(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.teamIndex === teamIdx
          ? { ...t, kills: Math.max(0, t.kills + delta) }
          : t
      ),
    }))
  }

  const overlayColor = ms.overlayColor || '#00b140'

  return (
    <div
      className="match-split"
      ref={splitRef}
      style={{ gridTemplateColumns: `${leftPct}% 7px 1fr` }}
    >
      {/* ═════════════ LEFT: Control Panel ═════════════════════ */}
      <div className="mc-panel">

        {/* Compact toolbar: map + live controls */}
        <div className="mc-toolbar">
          <select
            className={`mc-select mc-select--sm ${!hasMap && !ms.isLive ? 'mc-select--need' : ''}`}
            value={ms.map}
            onChange={e => save({ map: e.target.value })}
          >
            <option value="">Select Map…</option>
            {(tournament.maps || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button
            className={`mc-btn mc-btn--sm ${ms.isLive ? 'mc-btn--end' : 'mc-btn--start'}`}
            onClick={toggleLive}
            disabled={!ms.isLive && !hasMap}
            title={!ms.isLive && !hasMap ? 'Select a map first' : ''}
          >
            {ms.isLive ? '⏹ End' : '▶ Start'}
          </button>
          {ms.isLive && (
            <button
              className={`mc-btn mc-btn--sm ${ms.isPaused ? 'mc-btn--resume' : 'mc-btn--pause'}`}
              onClick={togglePause}
            >
              {ms.isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}
          <button
            className="mc-btn mc-btn--sm mc-btn--reset"
            onClick={() => setConfirmReset(true)}
            title="Reset all scores for this match"
          >
            ⟲ Reset
          </button>
        </div>
        {!hasMap && !ms.isLive && (
          <p className="mc-hint">Select a map to enable Start.</p>
        )}

        {/* Download (only after the match has ended) */}
        {matchEnded && (
          <div className="mc-export">
            <button className="mc-export-btn" onClick={() => setShowExport(s => !s)}>
              ⬇ Download Match {matchIndex + 1} Results
            </button>
            {showExport && (
              <div className="mc-export-menu">
                <button onClick={downloadPDF}>
                  <span className="mc-export-ic mc-export-ic--pdf">PDF</span>
                  Download as PDF
                </button>
                <button onClick={downloadXLSX}>
                  <span className="mc-export-ic mc-export-ic--xls">XLS</span>
                  Download as Excel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Overlay view switcher */}
        <div className="mc-view-row">
          {['current','results','overall'].map(v => (
            <button
              key={v}
              className={`mc-view-btn ${ms.overlayView===v ? 'active':''}`}
              onClick={() => save({ overlayView: v })}
            >
              {v === 'current' ? 'Live Table' : v === 'results' ? 'Results' : 'Overall'}
            </button>
          ))}
        </div>

        {/* Team control table */}
        <div className={`mc-table-wrap ${canEdit ? '' : 'mc-table-wrap--disabled'}`}>
          {!canEdit && (
            <div className="mc-lock-overlay">
              {ms.isLive && ms.isPaused
                ? '⏸  Paused — Resume to edit'
                : '▶  Start Live to edit teams'}
            </div>
          )}
          {/* sticky header */}
          <table className="tc-table" style={{ flexShrink:0 }}>
            <thead>
              <tr>
                <th style={{width:50}}>LOGO</th>
                <th>TEAM</th>
                <th style={{width:80, textAlign:'center'}}>ALIVE</th>
                <th style={{width:100, textAlign:'center'}}>KILLS</th>
              </tr>
            </thead>
          </table>
          {/* scrollable body */}
          <div className="mc-table-scroll">
            <table className="tc-table">
              <tbody>
                {ms.teams.map((t) => {
                  const info = tournament.teamData?.[t.teamIndex] || {}
                  const name = info.name || `Team ${t.teamIndex + 1}`
                  const elim = t.eliminated
                  return (
                    <tr key={t.teamIndex} className={`tc-row ${elim ? 'eliminated' : ''}`}>
                      <td className="tc-cell" style={{width:50}}>
                        {info.logo
                          ? <img src={info.logo} className="tc-logo" alt={name} />
                          : <div className="tc-logo-ph">{name.slice(0,2).toUpperCase()}</div>
                        }
                      </td>
                      <td className="tc-cell tc-name">{name}</td>
                      <td className="tc-cell" style={{width:80}}>
                        <div className="boxes">
                          {t.boxes.map((dead, bi) => (
                            <div
                              key={bi}
                              className={`pbox ${dead ? 'dead' : ''}`}
                              onClick={() => handleBox(t.teamIndex, bi)}
                              title={dead ? 'Revive' : 'Eliminate'}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="tc-cell" style={{width:100}}>
                        <div className="kill-ctrl">
                          <button className="kill-btn" onClick={() => changeKills(t.teamIndex, -1)}>−</button>
                          <span className="kill-count">{t.kills}</span>
                          <button className="kill-btn" onClick={() => changeKills(t.teamIndex, 1)}>+</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═════════════ DRAGGABLE DIVIDER ═══════════════════════ */}
      <div className="match-divider" onMouseDown={startDrag} title="Drag to resize">
        <span className="match-divider__grip" />
      </div>

      {/* ═════════════ RIGHT: Overlay ══════════════════════════ */}
      <div className="mo-panel" style={{ background: overlayColor }}>
        {/* Control bar (outside the green) */}
        <div className="mo-color-bar">
          <label className="mo-color-label">
            <span>Screen Color</span>
            <input
              type="color"
              value={overlayColor}
              onChange={e => save({ overlayColor: e.target.value })}
              className="mo-color-input"
            />
          </label>

          {/* Glass style settings */}
          <div className="mo-settings">
            <button
              className={`mo-set-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(s => !s)}
              title="Overlay glass style"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {showSettings && (
              <div className="mo-set-panel" onClick={e => e.stopPropagation()}>
                <p className="mo-set-title">Overlay Glass</p>

                <div className="mo-set-row">
                  <label>Opacity <b>{Math.round(lbStyle.opacity * 100)}%</b></label>
                  <input type="range" min="20" max="100"
                    value={Math.round(lbStyle.opacity * 100)}
                    onChange={e => setStyle({ opacity: +e.target.value / 100 })} />
                </div>
                <div className="mo-set-row">
                  <label>Blur <b>{lbStyle.blur}px</b></label>
                  <input type="range" min="0" max="20"
                    value={lbStyle.blur}
                    onChange={e => setStyle({ blur: +e.target.value })} />
                </div>
                <div className="mo-set-row">
                  <label>Darkness <b>{Math.round(lbStyle.darkness * 100)}%</b></label>
                  <input type="range" min="0" max="100"
                    value={Math.round(lbStyle.darkness * 100)}
                    onChange={e => setStyle({ darkness: +e.target.value / 100 })} />
                </div>

                <button className="mo-set-reset" onClick={() => setStyle({ blur: 0, opacity: 1, darkness: 1 })}>
                  Reset to opaque
                </button>
              </div>
            )}
          </div>

          {/* Overlay size control */}
          <div className="mo-size-ctrl">
            <span className="mo-size-label">Size</span>
            <button className="mo-size-btn" onClick={() => changeScale(-0.15)} title="Smaller">−</button>
            <span className="mo-size-val">{Math.round(lbScale * 100)}%</span>
            <button className="mo-size-btn" onClick={() => changeScale(0.15)} title="Bigger">+</button>
          </div>

          <button className="mo-obs-btn" onClick={copyOverlayUrl} title="Copy the OBS overlay link">
            {copied ? '✓ Copied' : '⧉ OBS Link'}
          </button>

          {ms.isLive && (
            <span className={`mo-live-badge ${ms.isPaused ? 'paused' : ''}`}>
              {ms.isPaused ? '⏸ PAUSED' : '● LIVE'}
            </span>
          )}
          {ms.isEnded && !ms.isLive && (
            <span className="mo-live-badge ended">■ ENDED</span>
          )}
        </div>

        {/* Leaderboard area */}
        <div className="mo-lb" style={lbVars(lbStyle)}>
         <div className="mo-lb-scale" style={{ zoom: lbScale }}>
          {ms.overlayView === 'current' && (
            <CurrentLeaderboard
              tournament={tournament}
              matchTeams={ms.teams}
              matchIndex={matchIndex}
              map={ms.map}
              frame={lbFrame}
            />
          )}
          {ms.overlayView === 'results' && (
            <MatchResults
              tournament={tournament}
              matchTeams={ms.teams}
              matchIndex={matchIndex}
              map={ms.map}
              frame={lbFrame}
            />
          )}
          {ms.overlayView === 'overall' && (
            <OverallStandings tournament={tournament} frame={lbFrame} />
          )}
         </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset Match Scores?"
          message={`All kills, eliminations and alive status for Match ${matchIndex + 1} will be cleared back to zero. This cannot be undone.`}
          confirmLabel="Reset"
          cancelLabel="Cancel"
          onConfirm={resetScores}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
