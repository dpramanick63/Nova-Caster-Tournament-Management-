import { useState, useRef, useEffect } from 'react'
import { ordinal, resizeImage, defaultPosPoints } from '../../lib/utils'
import TournamentExport from '../TournamentExport'

const TYPES = [
  { key: 'squad',  label: 'Squad',  players: 4 },
  { key: 'duo',    label: 'Duo',    players: 2 },
  { key: 'solo',   label: 'Solo',   players: 1 },
  { key: 'custom', label: 'Custom', players: null },
]

// keep an array at length n: preserve existing, fill new with `make(i)`
function resize(arr, n, make) {
  return Array.from({ length: n }, (_, i) => (i < arr.length ? arr[i] : make(i)))
}

export default function MatchSettings({ tournament, onSave }) {
  /* ── Tournament detail state (editable, except name) ──────── */
  const [tlogo,      setTlogo]      = useState(tournament.logo || null)
  const [teamCount,  setTeamCount]  = useState(tournament.teams || 0)
  const [playerType, setPlayerType] = useState(tournament.playerType || 'squad')
  const [customPpt,  setCustomPpt]  = useState(
    tournament.playerType === 'custom' ? (tournament.playersPerTeam || '') : ''
  )
  const [date,       setDate]       = useState(tournament.date || '')

  const playersPerTeam = playerType === 'custom'
    ? (parseInt(customPpt) || 1)
    : (TYPES.find(t => t.key === playerType)?.players || 4)

  /* ── Registration / scoring / config ──────────────────────── */
  const [teamRows, setTeamRows] = useState(() =>
    Array.from({ length: tournament.teams || 0 }, (_, i) => ({
      name: tournament.teamData?.[i]?.name || '',
      logo: tournament.teamData?.[i]?.logo || null,
    }))
  )
  const [posPoints, setPosPoints] = useState(() =>
    Array.from({ length: tournament.teams || 0 }, (_, i) =>
      tournament.positionPoints?.[i] ?? defaultPosPoints(i + 1)
    )
  )
  const [killPoints, setKillPoints] = useState(tournament.killPoints ?? 1)
  const [numMatches, setNumMatches] = useState(tournament.numMatches ?? 6)
  const [maps,       setMaps]       = useState(tournament.maps || [])
  const [mapInput,   setMapInput]   = useState('')
  const [saving,     setSaving]     = useState(false)

  const fileRefs = useRef([])
  const tlogoRef = useRef(null)

  /* keep teamRows & posPoints in sync with the team count */
  useEffect(() => {
    setTeamRows(prev => resize(prev, teamCount, () => ({ name: '', logo: null })))
    setPosPoints(prev => resize(prev, teamCount, (i) => defaultPosPoints(i + 1)))
  }, [teamCount])

  function updateRow(i, patch) {
    setTeamRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  async function handleLogo(i, file) {
    if (!file) return
    const b64 = await resizeImage(file, 80)
    if (b64) updateRow(i, { logo: b64 })
  }

  async function handleTlogo(file) {
    if (!file) return
    const b64 = await resizeImage(file, 140)
    if (b64) setTlogo(b64)
  }

  function addMap() {
    const m = mapInput.trim()
    if (!m || maps.includes(m)) return
    setMaps(prev => [...prev, m])
    setMapInput('')
  }
  function removeMap(m) { setMaps(prev => prev.filter(x => x !== m)) }

  function ffPreset() {
    setPosPoints(Array.from({ length: teamCount }, (_, i) => defaultPosPoints(i + 1)))
  }

  /* rebuild matchData for a new team count / players-per-team, preserving live data */
  function rebuildMatchData(existing, n, ppt) {
    return (existing || []).map(m => ({
      ...m,
      teams: Array.from({ length: n }, (_, ti) => {
        const old = m.teams?.find(t => t.teamIndex === ti)
        if (old) {
          const boxes = Array.from({ length: ppt }, (_, bi) => old.boxes?.[bi] ?? false)
          return { ...old, boxes }
        }
        return { teamIndex: ti, boxes: Array(ppt).fill(false), kills: 0, eliminated: false, eliminationRank: null }
      }),
    }))
  }

  /* ── Saves ────────────────────────────────────────────────── */
  async function saveDetails() {
    setSaving(true)
    const patch = {
      logo: tlogo,
      teams: teamCount,
      playerType,
      playersPerTeam,
      date,
      teamData: resize(teamRows, teamCount, () => ({ name: '', logo: null })),
      positionPoints: resize(posPoints, teamCount, (i) => defaultPosPoints(i + 1)),
    }
    if (tournament.matchData?.length) {
      patch.matchData = rebuildMatchData(tournament.matchData, teamCount, playersPerTeam)
    }
    await onSave(patch, 'Tournament details updated')
    setSaving(false)
  }

  async function saveTeams() {
    setSaving(true)
    await onSave({ teamData: teamRows }, 'Teams saved')
    setSaving(false)
  }

  async function saveScoring() {
    setSaving(true)
    await onSave({ positionPoints: posPoints }, 'Scoring saved')
    setSaving(false)
  }

  async function generateTabs() {
    setSaving(true)
    const n = Math.max(1, parseInt(numMatches) || 1)
    const existing = tournament.matchData || []

    const freshTeam = (ti) => ({
      teamIndex: ti,
      boxes: Array(playersPerTeam || 4).fill(false),
      kills: 0,
      eliminated: false,
      eliminationRank: null,
    })

    const matchData = Array.from({ length: n }, (_, i) =>
      existing[i] || {
        map: '', isLive: false, isPaused: false, isEnded: false,
        overlayColor: '#00b140', overlayView: 'current',
        teams: Array.from({ length: teamCount }, (_, ti) => freshTeam(ti)),
      }
    )

    await onSave({
      logo: tlogo,
      teams: teamCount,
      playerType,
      playersPerTeam,
      date,
      teamData: teamRows,
      positionPoints: posPoints,
      killPoints: parseFloat(killPoints) || 1,
      numMatches: n,
      maps,
      settingsSaved: true,
      matchData,
    }, `${n} match tab${n > 1 ? 's' : ''} generated`)
    setSaving(false)
  }

  const filled = teamRows.filter(r => r.name.trim()).length

  return (
    <div className="ms-wrap">

      {/* ══ 00 TOURNAMENT DETAILS ═══════════════════════════════ */}
      <div className="ms-section">
        <div className="ms-section-head">
          <span className="ms-section-num">00</span>
          <span className="ms-section-title">Tournament Details</span>
        </div>

        <div className="ms-section-body" style={{ display:'flex', flexDirection:'column', gap:22 }}>
          {/* Logo + name */}
          <div style={{ display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
            <input
              type="file" accept="image/*" style={{ display:'none' }}
              ref={tlogoRef} onChange={e => handleTlogo(e.target.files?.[0])}
            />
            <div className="td-logo">
              {tlogo
                ? <img src={tlogo} alt="" />
                : <span>LOGO</span>
              }
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button className="btn-ghost" onClick={() => tlogoRef.current?.click()}>
                {tlogo ? 'Change Logo' : 'Upload Logo'}
              </button>
              {tlogo && (
                <button className="td-clear" onClick={() => setTlogo(null)}>Remove logo</button>
              )}
            </div>
            <div className="field" style={{ flex:1, minWidth:200 }}>
              <label>Tournament Name (locked)</label>
              <input type="text" value={tournament.name} disabled style={{ opacity:.6, cursor:'not-allowed' }} />
            </div>
          </div>

          {/* Editable settings */}
          <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
            <div className="field" style={{ flex:1, minWidth:150 }}>
              <label>Number of Teams</label>
              <input
                type="number" min="2" max="100" value={teamCount}
                onChange={e => setTeamCount(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="field" style={{ flex:1, minWidth:150 }}>
              <label>Tournament Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Players per Team</label>
            <div className="seg-wrap">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  className={`seg ${playerType === t.key ? 'active' : ''}`}
                  onClick={() => setPlayerType(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={`custom-wrap ${playerType === 'custom' ? 'visible' : ''}`}>
              <input
                type="number" min="1" max="12" placeholder="Players per team"
                value={customPpt} onChange={e => setCustomPpt(e.target.value)}
              />
            </div>
          </div>

          <div className="ms-action-row" style={{ justifyContent:'space-between' }}>
            <TournamentExport tournament={tournament} label="Download Tournament" />
            <button className="btn-ghost" onClick={saveDetails} disabled={saving}>
              Save Details
            </button>
          </div>
        </div>
      </div>

      {/* ══ 01 TEAM REGISTRATION ════════════════════════════════ */}
      <div className="ms-section">
        <div className="ms-section-head">
          <span className="ms-section-num">01</span>
          <span className="ms-section-title">Team Registration</span>
          <span style={{ marginLeft:'auto', fontSize:13, color:'var(--tx3)' }}>
            {filled} / {teamCount} filled
          </span>
        </div>

        <div className="ms-section-body" style={{ padding:0 }}>
          {Array.from({ length: teamCount }, (_, i) => (
            <input
              key={i}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              ref={el => fileRefs.current[i] = el}
              onChange={e => handleLogo(i, e.target.files?.[0])}
            />
          ))}

          <div className="reg-table-wrap">
            <table className="reg-table">
              <thead>
                <tr>
                  <th className="reg-th" style={{ width:50 }}>#</th>
                  <th className="reg-th">Team Name</th>
                  <th className="reg-th" style={{ width:160 }}>Logo</th>
                  <th className="reg-th" style={{ width:90 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((row, i) => (
                  <tr key={i} className="reg-row">
                    <td className="reg-td reg-num">{i + 1}</td>
                    <td className="reg-td">
                      <input
                        className="reg-name-input"
                        type="text"
                        placeholder={`Team ${i + 1}`}
                        value={row.name}
                        onChange={e => updateRow(i, { name: e.target.value })}
                      />
                    </td>
                    <td className="reg-td">
                      <div className="reg-logo-cell">
                        {row.logo
                          ? <img src={row.logo} className="reg-logo-img" alt="" />
                          : <div className="reg-logo-ph">{i + 1}</div>
                        }
                        <button
                          className="reg-upload-btn"
                          onClick={() => fileRefs.current[i]?.click()}
                        >
                          {row.logo ? 'Change' : '+ Logo'}
                        </button>
                      </div>
                    </td>
                    <td className="reg-td">
                      <span className={`reg-status ${row.name.trim() ? 'set' : ''}`}>
                        {row.name.trim() ? '✓' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ms-action-row" style={{ padding:'14px 20px' }}>
            <button className="btn-ghost" onClick={saveTeams} disabled={saving}>
              Save Teams
            </button>
          </div>
        </div>
      </div>

      {/* ══ 02 POSITION SCORING ═════════════════════════════════ */}
      <div className="ms-section">
        <div className="ms-section-head">
          <span className="ms-section-num">02</span>
          <span className="ms-section-title">Position Scoring</span>
          <button className="ms-preset-btn" onClick={ffPreset}>
            Free Fire Preset
          </button>
        </div>

        <div className="ms-section-body">
          <div className="pos-grid">
            {posPoints.map((pts, i) => (
              <div className="pos-row" key={i}>
                <span className="pos-label">{ordinal(i + 1)} Place</span>
                <input
                  className="pos-input"
                  type="number"
                  min="0"
                  value={pts}
                  onChange={e =>
                    setPosPoints(prev =>
                      prev.map((v, j) => j === i ? Number(e.target.value) : v)
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="ms-action-row">
            <button className="btn-ghost" onClick={saveScoring} disabled={saving}>
              Save Scoring
            </button>
          </div>
        </div>
      </div>

      {/* ══ 03 MATCH CONFIGURATION ══════════════════════════════ */}
      <div className="ms-section">
        <div className="ms-section-head">
          <span className="ms-section-num">03</span>
          <span className="ms-section-title">Match Configuration</span>
        </div>

        <div className="ms-section-body" style={{ display:'flex', flexDirection:'column', gap:24 }}>

          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            <div className="field" style={{ flex:1, minWidth:160 }}>
              <label>Number of Matches</label>
              <input
                type="number"
                min="1"
                max="20"
                value={numMatches}
                onChange={e => setNumMatches(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex:1, minWidth:160 }}>
              <label>Kill Points per Kill</label>
              <div className="kp-ctrl">
                <button className="kp-btn" onClick={() => setKillPoints(v => Math.max(0.5, +v - 0.5))}>−</button>
                <div className="kp-val">{killPoints}</div>
                <button className="kp-btn" onClick={() => setKillPoints(v => +v + 0.5)}>+</button>
              </div>
            </div>
          </div>

          <div className="field">
            <label>Maps</label>
            <div className="maps-input-row">
              <input
                type="text"
                placeholder="e.g. Bermuda — press Enter or Add"
                value={mapInput}
                onChange={e => setMapInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMap() } }}
              />
              <button className="btn-ghost" onClick={addMap} style={{ flexShrink:0 }}>Add</button>
            </div>
            {maps.length > 0 && (
              <div className="maps-chips">
                {maps.map(m => (
                  <span key={m} className="map-chip">
                    {m}
                    <button className="map-chip__rm" onClick={() => removeMap(m)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={generateTabs}
            disabled={saving}
            style={{ alignSelf:'stretch', height:54 }}
          >
            {saving
              ? 'Saving…'
              : tournament.settingsSaved
                ? 'Update & Regenerate Match Tabs'
                : 'Save & Generate Match Tabs'
            }
          </button>

        </div>
      </div>

    </div>
  )
}
