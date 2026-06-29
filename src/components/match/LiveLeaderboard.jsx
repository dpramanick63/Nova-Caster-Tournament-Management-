import { useLayoutEffect, useRef } from 'react'

/* Resizable frame — edge + corner handles with directional cursors.
   width/height are controlled by the parent so size persists across views. */
function LbFrame({ className = '', width, height, scale = 1, onResize, children }) {
  const ref = useRef(null)

  function start(dir, e) {
    e.preventDefault()
    e.stopPropagation()
    const z = scale || 1
    const rect = ref.current.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const sw = rect.width / z, sh = rect.height / z

    function move(ev) {
      let w = sw, h = sh
      if (dir.includes('e')) w = sw + (ev.clientX - sx) / z
      if (dir.includes('w')) w = sw - (ev.clientX - sx) / z
      if (dir.includes('s')) h = sh + (ev.clientY - sy) / z
      if (dir.includes('n')) h = sh - (ev.clientY - sy) / z
      onResize(
        Math.max(240, Math.min(960, Math.round(w))),
        Math.max(120, Math.min(1300, Math.round(h)))
      )
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={ref}
      className={`lb-wrap ${className}`}
      style={{ width: width || undefined, height: height || undefined }}
    >
      {children}
      <span className="lb-rs lb-rs-n"  onPointerDown={e => start('n', e)} />
      <span className="lb-rs lb-rs-s"  onPointerDown={e => start('s', e)} />
      <span className="lb-rs lb-rs-e"  onPointerDown={e => start('e', e)} />
      <span className="lb-rs lb-rs-w"  onPointerDown={e => start('w', e)} />
      <span className="lb-rs lb-rs-se" onPointerDown={e => start('se', e)} />
      <span className="lb-rs lb-rs-sw" onPointerDown={e => start('sw', e)} />
    </div>
  )
}

function computeRows(tournament, matchTeams) {
  const kp = tournament.killPoints || 1
  const alive = matchTeams.filter(t => !t.eliminated)
  const dead  = matchTeams.filter(t =>  t.eliminated)
  const sortAlive = [...alive].sort((a,b) => b.kills - a.kills)
  const sortDead  = [...dead].sort((a,b) => {
    const ap = (tournament.positionPoints?.[a.eliminationRank-1] || 0) + a.kills*kp
    const bp = (tournament.positionPoints?.[b.eliminationRank-1] || 0) + b.kills*kp
    return bp - ap
  })
  return [...sortAlive, ...sortDead].map((t,i) => {
    const info   = tournament.teamData?.[t.teamIndex] || { name:`Team ${t.teamIndex+1}`, logo:null }
    const killPt = t.kills * kp
    const posPt  = t.eliminated ? (tournament.positionPoints?.[t.eliminationRank-1] || 0) : 0
    return { ...t, info, killPt, posPt, total: killPt+posPt, rank: i+1 }
  })
}

function computeOverall(tournament) {
  const kp   = tournament.killPoints || 1
  const acc  = {}
  for (const match of tournament.matchData || []) {
    for (const t of match.teams || []) {
      if (!acc[t.teamIndex]) acc[t.teamIndex] = { kills:0, killPt:0, posPt:0, total:0 }
      const k  = t.kills * kp
      const p  = t.eliminated ? (tournament.positionPoints?.[t.eliminationRank-1] || 0) : 0
      acc[t.teamIndex].kills  += t.kills
      acc[t.teamIndex].killPt += k
      acc[t.teamIndex].posPt  += p
      acc[t.teamIndex].total  += k + p
    }
  }
  return Object.entries(acc)
    .map(([idx, s]) => ({
      teamIndex: +idx,
      info: tournament.teamData?.[+idx] || { name:`Team ${+idx+1}`, logo:null },
      ...s,
    }))
    .sort((a,b) => b.total - a.total)
    .map((t,i) => ({ ...t, rank: i+1 }))
}

function rankColor(r) {
  if (r === 1) return '#FFD700'
  if (r === 2) return '#C0C0C0'
  if (r === 3) return '#CD7F32'
  return 'rgba(255,255,255,.92)'
}

function TeamLogo({ logo, name }) {
  if (logo) return <img src={logo} alt={name} className="lb-logo" />
  return (
    <div className="lb-logo-ph">
      {(name || '?').slice(0,2).toUpperCase()}
    </div>
  )
}


// Shared broadcast header — tournament logo (if any) + name + sub-line
function LbHeader({ tournament, sub, tag }) {
  return (
    <div className="lb-head">
      {tournament.logo && (
        <img src={tournament.logo} alt="" className="lb-head-logo-img" />
      )}
      <div className="lb-head-info">
        <div className="lb-head-title">{tournament.name}</div>
        <div className="lb-head-sub">{sub}</div>
      </div>
      {tag && <span className="lb-head-tag">{tag}</span>}
    </div>
  )
}

// FLIP hook: animates rows when order changes — with a cool slide + glow pulse
function useFlip(orderKey) {
  const ref  = useRef(null)
  const prev = useRef({})
  useLayoutEffect(() => {
    if (!ref.current) return
    const els = ref.current.querySelectorAll('[data-fk]')
    const newR = {}
    els.forEach(el => { newR[el.dataset.fk] = el.getBoundingClientRect().top })
    els.forEach(el => {
      const k  = el.dataset.fk
      const dy = (prev.current[k] ?? newR[k]) - newR[k]
      if (Math.abs(dy) > 0.5) {
        const movingUp = dy > 0
        const climb = movingUp
          ? '#00d4ff'   // cyan when rising
          : '#f59e0b'   // amber when dropping

        // Duration scales with distance so big jumps glide slower & readable.
        // Clamped 0.85s → 1.6s. Slower overall for a smooth broadcast feel.
        const dist = Math.abs(dy)
        const dur  = Math.min(1.6, Math.max(0.85, dist / 320 + 0.75))
        const glowDur = (dur + 0.25).toFixed(2)

        // INVERT — snap to old position, lifted above siblings
        el.style.transition = 'none'
        el.style.transform  = `translateY(${dy}px) scale(1.04)`
        el.style.zIndex     = '8'
        el.style.borderRadius = '4px'
        el.style.boxShadow  = `inset 3px 0 0 ${climb}, 0 0 26px ${climb}66, 0 8px 20px rgba(0,0,0,.5)`
        el.style.background = movingUp ? 'rgba(0,212,255,.16)' : 'rgba(245,158,11,.12)'
        // force reflow
        el.getBoundingClientRect()

        // PLAY — smooth ease-out glide (gentle, no jittery overshoot)
        el.style.transition =
          `transform ${dur}s cubic-bezier(0.25,0.8,0.3,1), ` +
          `box-shadow ${glowDur}s ease, background ${glowDur}s ease`
        el.style.transform  = 'translateY(0) scale(1)'
        el.style.boxShadow  = `inset 3px 0 0 ${climb}00, 0 0 0 ${climb}00, 0 0 0 rgba(0,0,0,0)`
        el.style.background = 'transparent'

        const cleanup = (e) => {
          if (e.propertyName !== 'transform') return
          el.style.transform = ''
          el.style.boxShadow = ''
          el.style.background = ''
          el.style.zIndex    = ''
          el.style.borderRadius = ''
          el.style.transition = ''
          el.removeEventListener('transitionend', cleanup)
        }
        el.addEventListener('transitionend', cleanup)
      }
    })
    prev.current = newR
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey])
  return ref
}

/* ───── Current Match Leaderboard ────────────────────────── */
export function CurrentLeaderboard({ tournament, matchTeams, matchIndex, map, frame }) {
  const rows     = computeRows(tournament, matchTeams)
  const orderKey = rows.map(r => r.teamIndex).join('-')
  const ref      = useFlip(orderKey)
  const aliveRow = rows.filter(r => !r.eliminated)

  return (
    <LbFrame {...frame}>
      <LbHeader
        tournament={tournament}
        sub={`MATCH ${matchIndex+1}${map ? `  ·  ${map.toUpperCase()}` : ''}`}
      />
      <div className="lb-table" ref={ref}>
        <div className="lb-col-bar">
          <span style={{width:18}}>RK</span>
          <span style={{flex:1}}>TEAM</span>
          <span style={{width:44,textAlign:'center'}}>ALIVE</span>
          <span style={{width:30,textAlign:'center'}}>K</span>
          <span style={{width:38,textAlign:'right'}}>PTS</span>
        </div>
        {rows.map((row) => {
          const isWinner = !row.eliminated && aliveRow.length === 1
          const isLeader = !isWinner && row.rank === 1 && row.total > 0
          return (
            <div
              key={row.teamIndex}
              data-fk={String(row.teamIndex)}
              className={`lb-row rank-${row.rank} ${row.eliminated ? 'eliminated' : ''} ${isWinner ? 'winner' : ''} ${isLeader ? 'leader' : ''}`}
            >
              <span className="lb-rank" style={{color: rankColor(row.rank)}}>{row.rank}</span>
              <span className="lb-team">
                <TeamLogo logo={row.info.logo} name={row.info.name} />
                <span className="lb-name">{row.info.name || `Team ${row.teamIndex+1}`}</span>
              </span>
              <span className="lb-bars">
                {row.eliminated
                  ? <span className="lb-elim">#{row.eliminationRank}</span>
                  : (row.boxes || []).map((dead, bi) => (
                      <span key={bi} className={`lb-bar ${dead ? 'down' : ''}`} />
                    ))
                }
              </span>
              <span className="lb-kills">{row.kills}</span>
              <span className="lb-pts">{row.total}</span>
            </div>
          )
        })}
      </div>
    </LbFrame>
  )
}

/* ───── Match Results View ───────────────────────────────── */
export function MatchResults({ tournament, matchTeams, matchIndex, map, frame }) {
  const rows = computeRows(tournament, matchTeams)
  const top3 = rows.slice(0,3)
  const rest = rows.slice(3)
  return (
    <LbFrame className="lb-results" {...frame}>
      <LbHeader
        tournament={tournament}
        sub={`MATCH ${matchIndex+1}${map ? `  ·  ${map.toUpperCase()}` : ''}`}
        tag="RESULTS"
      />

      {/* Top 3 podium */}
      <div className="podium">
        {[1,0,2].map(i => {
          const row = top3[i]
          if (!row) return <div key={i} className="podium-slot" />
          const isLeader = i === 0 && row.total > 0   // 1st place with points
          return (
            <div key={i} className={`podium-slot pos-${i+1} ${isLeader ? 'leader' : ''}`} style={{animationDelay:`${i*120}ms`}}>
              <div className="podium-rank" style={{color: rankColor(i+1)}}>{ordinalSymbol(i+1)}</div>
              <div className="podium-logo">
                <TeamLogo logo={row.info.logo} name={row.info.name} />
              </div>
              <div className="podium-name">{row.info.name || `Team ${row.teamIndex+1}`}</div>
              <div className="podium-pts">{row.total} <span style={{fontSize:'0.65rem',color:'var(--tx3)'}}>PTS</span></div>
            </div>
          )
        })}
      </div>

      {/* Rest compact */}
      {rest.length > 0 && (
        <div className="lb-table lb-results-rest">
          {rest.map(row => (
            <div key={row.teamIndex} className={`lb-row rank-${row.rank} ${row.eliminated ? 'eliminated' : ''}`}>
              <span className="lb-rank" style={{color: rankColor(row.rank)}}>{row.rank}</span>
              <span className="lb-team">
                <TeamLogo logo={row.info.logo} name={row.info.name} />
                <span className="lb-name">{row.info.name || `Team ${row.teamIndex+1}`}</span>
              </span>
              <span className="lb-kills">{row.kills}</span>
              <span className="lb-pts">{row.total}</span>
            </div>
          ))}
        </div>
      )}
    </LbFrame>
  )
}

/* ───── Overall Standings ────────────────────────────────── */
export function OverallStandings({ tournament, frame }) {
  const rows     = computeOverall(tournament)
  const orderKey = rows.map(r => r.teamIndex).join('-')
  const ref      = useFlip(orderKey)
  return (
    <LbFrame {...frame}>
      <LbHeader tournament={tournament} sub="OVERALL STANDINGS" />
      <div className="lb-table" ref={ref}>
        <div className="lb-col-bar">
          <span style={{width:18}}>RK</span>
          <span style={{flex:1}}>TEAM</span>
          <span style={{width:30,textAlign:'center'}}>K</span>
          <span style={{width:30,textAlign:'center'}}>KP</span>
          <span style={{width:30,textAlign:'center'}}>PP</span>
          <span style={{width:38,textAlign:'right'}}>TOT</span>
        </div>
        {rows.map(row => (
          <div key={row.teamIndex} data-fk={String(row.teamIndex)} className={`lb-row rank-${row.rank} ${row.rank === 1 && row.total > 0 ? 'leader' : ''}`}>
            <span className="lb-rank" style={{color: rankColor(row.rank)}}>{row.rank}</span>
            <span className="lb-team">
              <TeamLogo logo={row.info.logo} name={row.info.name} />
              <span className="lb-name">{row.info.name || `Team ${row.teamIndex+1}`}</span>
            </span>
            <span className="lb-kills">{row.kills}</span>
            <span className="lb-kills">{row.killPt}</span>
            <span className="lb-kills">{row.posPt}</span>
            <span className="lb-pts">{row.total}</span>
          </div>
        ))}
      </div>
    </LbFrame>
  )
}

function ordinalSymbol(n) {
  return ['1ST','2ND','3RD'][n-1] || n+'TH'
}
