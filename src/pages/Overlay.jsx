import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { subscribeOverlay, readOverlayCache } from '../lib/sync'
import { firebaseReady } from '../lib/firebase'
import { lbVars } from '../lib/utils'
import { CurrentLeaderboard, MatchResults, OverallStandings } from '../components/match/LiveLeaderboard'

/*
  Clean broadcast overlay for OBS Browser Source.
  URL:  /overlay/<tournamentId>
  - Transparent background (OBS renders alpha) → no chroma key needed.
  - Add ?chroma=1 to use the solid screen colour instead (for chroma-key).
  Reads live data from Firebase and mirrors whatever the caster is showing.
*/
export default function Overlay() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const chroma = params.get('chroma') === '1'
  // Seed from cache so OBS shows the last state instantly on (re)load.
  const [data, setData] = useState(() => (firebaseReady ? readOverlayCache(id) : undefined))

  useEffect(() => subscribeOverlay(id, setData), [id])

  // Make the whole document transparent so OBS keys nothing out.
  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  if (!firebaseReady) {
    return <div className="ovl-msg">Firebase not configured — add your keys in src/lib/firebase.js</div>
  }
  if (data === undefined) return <div className="ovl-page" />          // loading: stay transparent
  if (!data || !data.meta) return <div className="ovl-page" />          // no data yet

  const meta    = data.meta
  const matches = data.matches || []
  const b       = data.broadcast || { matchIndex: 0, view: 'current' }
  const match   = matches[b.matchIndex] || { teams: [] }

  const tournament = {
    ...meta,
    matchData: matches,
  }

  const frame = { width: b.w || 380, height: b.h || null, scale: 1, onResize: () => {} }
  const stageStyle = {
    zoom: b.scale || 1,
    ...lbVars(b.style || {}),
  }

  return (
    <div
      className="ovl-page"
      style={chroma ? { background: b.screenColor || '#00b140' } : undefined}
    >
      <div className="ovl-stage" style={stageStyle}>
        {b.view === 'current' && (
          <CurrentLeaderboard tournament={tournament} matchTeams={match.teams || []} matchIndex={b.matchIndex} map={match.map} frame={frame} />
        )}
        {b.view === 'results' && (
          <MatchResults tournament={tournament} matchTeams={match.teams || []} matchIndex={b.matchIndex} map={match.map} frame={frame} />
        )}
        {b.view === 'overall' && (
          <OverallStandings tournament={tournament} frame={frame} />
        )}
      </div>
    </div>
  )
}
