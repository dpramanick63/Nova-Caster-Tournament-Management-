import { useState } from 'react'
import { exportTournamentPDF, exportTournamentXLSX } from '../lib/exporters'

export default function TournamentExport({ tournament, className = '', label = 'Download', menuUp = false }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function toggle(e) { e.stopPropagation(); setOpen(o => !o) }

  async function pdf(e) {
    e.stopPropagation()
    setBusy(true)
    try { await exportTournamentPDF(tournament) }
    finally { setBusy(false); setOpen(false) }
  }

  function xls(e) {
    e.stopPropagation()
    exportTournamentXLSX(tournament)
    setOpen(false)
  }

  return (
    <div className={`texport ${className}`} onClick={e => e.stopPropagation()}>
      <button className="texport-btn" onClick={toggle} title="Download full tournament">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {label}
      </button>

      {open && (
        <div className={`texport-menu ${menuUp ? 'up' : ''}`}>
          <button onClick={pdf} disabled={busy}>
            <span className="mc-export-ic mc-export-ic--pdf">PDF</span>
            {busy ? 'Building…' : 'Full Tournament PDF'}
          </button>
          <button onClick={xls}>
            <span className="mc-export-ic mc-export-ic--xls">XLS</span>
            Full Tournament Excel
          </button>
        </div>
      )}
    </div>
  )
}
