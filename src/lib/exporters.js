import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

/* ════════════════════════════════════════════════════════════════
   Standings computation (mirrors the live leaderboard)
   ════════════════════════════════════════════════════════════════ */
export function matchStandings(tournament, match) {
  const kp    = tournament.killPoints || 1
  const teams = match?.teams || []
  const alive = teams.filter(t => !t.eliminated)
  const dead  = teams.filter(t =>  t.eliminated)

  const sortAlive = [...alive].sort((a, b) => b.kills - a.kills)
  const sortDead  = [...dead].sort((a, b) => {
    const ap = (tournament.positionPoints?.[a.eliminationRank - 1] || 0) + a.kills * kp
    const bp = (tournament.positionPoints?.[b.eliminationRank - 1] || 0) + b.kills * kp
    return bp - ap
  })

  return [...sortAlive, ...sortDead].map((t, i) => {
    const info    = tournament.teamData?.[t.teamIndex] || {}
    const name    = info.name || `Team ${t.teamIndex + 1}`
    const killPt  = t.kills * kp
    const posPt   = t.eliminated ? (tournament.positionPoints?.[t.eliminationRank - 1] || 0) : 0
    const aliveCt = (t.boxes || []).filter(b => !b).length
    return {
      teamIndex: t.teamIndex,
      rank: i + 1,
      name,
      kills: t.kills,
      killPt,
      posPt,
      total: killPt + posPt,
      alive: aliveCt,
      status: t.eliminated ? `Out #${t.eliminationRank}` : (alive.length === 1 ? 'WINNER' : 'Alive'),
    }
  })
}

export function overallStandings(tournament) {
  const kp  = tournament.killPoints || 1
  const acc = {}
  for (const m of tournament.matchData || []) {
    for (const t of m.teams || []) {
      if (!acc[t.teamIndex]) acc[t.teamIndex] = { kills: 0, killPt: 0, posPt: 0, total: 0 }
      const k = t.kills * kp
      const p = t.eliminated ? (tournament.positionPoints?.[t.eliminationRank - 1] || 0) : 0
      acc[t.teamIndex].kills  += t.kills
      acc[t.teamIndex].killPt += k
      acc[t.teamIndex].posPt  += p
      acc[t.teamIndex].total  += k + p
    }
  }
  return Object.entries(acc)
    .map(([idx, s]) => ({
      teamIndex: +idx,
      name: tournament.teamData?.[+idx]?.name || `Team ${+idx + 1}`,
      ...s,
    }))
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({ ...t, rank: i + 1 }))
}

function safeName(tournament) {
  return (tournament.name || 'tournament').replace(/[^\w-]+/g, '_')
}

/* ════════════════════════════════════════════════════════════════
   Logo handling — convert stored (webp/base64) logos to PNG for jsPDF
   ════════════════════════════════════════════════════════════════ */
function loadPng(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width  = img.naturalWidth  || 64
        c.height = img.naturalHeight || 64
        c.getContext('2d').drawImage(img, 0, 0)
        resolve(c.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function prepLogos(tournament) {
  const map = new Map()
  const td  = tournament.teamData || []
  await Promise.all(td.map(async (t, i) => { map.set(i, await loadPng(t?.logo)) }))
  return map
}

/* ════════════════════════════════════════════════════════════════
   PDF building blocks
   ════════════════════════════════════════════════════════════════ */
function metaLine(tournament) {
  return [tournament.date ? `Date: ${tournament.date}` : '', `Kill Pts: ${tournament.killPoints || 1}`]
    .filter(Boolean).join('      ')
}

function headerBand(doc, title, sub, meta) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(11, 15, 32); doc.rect(0, 0, W, 96, 'F')
  doc.setFillColor(0, 212, 255); doc.rect(0, 96, W, 3, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.text(title || 'Tournament', 40, 46)
  doc.setTextColor(0, 212, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(sub, 40, 68)
  if (meta) {
    doc.setTextColor(150, 160, 190); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text(meta, 40, 85)
  }
}

function drawLogoCell(doc, cell, png, name) {
  const s = 16
  const x = cell.x + (cell.width - s) / 2
  const y = cell.y + (cell.height - s) / 2
  if (png) {
    try { doc.addImage(png, 'PNG', x, y, s, s); return } catch { /* fall through */ }
  }
  // placeholder
  doc.setFillColor(228, 232, 240); doc.roundedRect(x, y, s, s, 2, 2, 'F')
  doc.setFontSize(6); doc.setTextColor(120, 130, 150)
  doc.text((name || '?').slice(0, 2).toUpperCase(), x + s / 2, y + s / 2 + 2, { align: 'center' })
}

function matchTable(doc, rows, logoMap, startY) {
  autoTable(doc, {
    startY,
    head: [['', '#', 'Team', 'Alive', 'Kills', 'Kill Pts', 'Pos Pts', 'Total', 'Status']],
    body: rows.map(r => ['', r.rank, r.name, r.alive, r.kills, r.killPt, r.posPt, r.total, r.status]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, minCellHeight: 22, valign: 'middle', textColor: [30, 35, 55], lineColor: [225, 230, 240] },
    headStyles: { fillColor: [12, 16, 36], textColor: [0, 212, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' },
      6: { halign: 'center' }, 7: { halign: 'center', fontStyle: 'bold' }, 8: { halign: 'center' },
    },
    alternateRowStyles: { fillColor: [246, 248, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const medal = [[255, 215, 0], [192, 192, 192], [205, 127, 50]][data.row.index]
        if (medal) { data.cell.styles.fillColor = medal; data.cell.styles.textColor = [20, 20, 20] }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const r = rows[data.row.index]
        drawLogoCell(doc, data.cell, logoMap.get(r.teamIndex), r.name)
      }
    },
  })
  return doc.lastAutoTable.finalY
}

function overallTable(doc, rows, logoMap, startY) {
  autoTable(doc, {
    startY,
    head: [['', '#', 'Team', 'Kills', 'Kill Pts', 'Pos Pts', 'Total']],
    body: rows.map(r => ['', r.rank, r.name, r.kills, r.killPt, r.posPt, r.total]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, minCellHeight: 22, valign: 'middle', textColor: [30, 35, 55], lineColor: [225, 230, 240] },
    headStyles: { fillColor: [12, 16, 36], textColor: [124, 58, 237], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' },
      6: { halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [246, 248, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const medal = [[255, 215, 0], [192, 192, 192], [205, 127, 50]][data.row.index]
        if (medal) { data.cell.styles.fillColor = medal; data.cell.styles.textColor = [20, 20, 20] }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const r = rows[data.row.index]
        drawLogoCell(doc, data.cell, logoMap.get(r.teamIndex), r.name)
      }
    },
  })
  return doc.lastAutoTable.finalY
}

function addFooters(doc) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const n = doc.internal.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFontSize(8); doc.setTextColor(150, 160, 190); doc.setFont('helvetica', 'bold')
    doc.text('NOVA CASTER TOURNAMENT SERVICES PVT LTD', 40, H - 22)
    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${p} / ${n}`, W - 40, H - 22, { align: 'right' })
  }
}

/* ════════════════════════════════════════════════════════════════
   Single-match exports
   ════════════════════════════════════════════════════════════════ */
export async function exportMatchPDF(tournament, match, matchIndex) {
  const logoMap = await prepLogos(tournament)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  headerBand(doc, tournament.name, `MATCH ${matchIndex + 1}${match?.map ? '  -  ' + String(match.map).toUpperCase() : ''}`, metaLine(tournament))
  matchTable(doc, matchStandings(tournament, match), logoMap, 120)
  addFooters(doc)
  doc.save(`${safeName(tournament)}_Match-${matchIndex + 1}.pdf`)
}

export function exportMatchXLSX(tournament, match, matchIndex) {
  const rows = matchStandings(tournament, match)
  const aoa = [
    [tournament.name || 'Tournament'],
    [`Match ${matchIndex + 1}${match?.map ? ' - ' + match.map : ''}`],
    [tournament.date ? `Date: ${tournament.date}` : '', '', `Kill Points: ${tournament.killPoints || 1}`],
    [],
    ['Rank', 'Team', 'Alive', 'Kills', 'Kill Pts', 'Pos Pts', 'Total', 'Status'],
    ...rows.map(r => [r.rank, r.name, r.alive, r.kills, r.killPt, r.posPt, r.total, r.status]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 12 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Match ${matchIndex + 1}`)
  XLSX.writeFile(wb, `${safeName(tournament)}_Match-${matchIndex + 1}.xlsx`)
}

/* ════════════════════════════════════════════════════════════════
   Full-tournament exports
   ════════════════════════════════════════════════════════════════ */
export async function exportTournamentPDF(tournament) {
  const logoMap = await prepLogos(tournament)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const matches = tournament.matchData || []
  const meta = metaLine(tournament)

  // one page per match
  matches.forEach((m, i) => {
    if (i > 0) doc.addPage()
    headerBand(doc, tournament.name, `MATCH ${i + 1}${m.map ? '  -  ' + String(m.map).toUpperCase() : ''}`, meta)
    matchTable(doc, matchStandings(tournament, m), logoMap, 120)
  })

  // overall standings page
  if (matches.length > 0) doc.addPage()
  headerBand(doc, tournament.name, 'OVERALL STANDINGS', meta)
  overallTable(doc, overallStandings(tournament), logoMap, 120)

  addFooters(doc)
  doc.save(`${safeName(tournament)}_FULL.pdf`)
}

export function exportTournamentXLSX(tournament) {
  const wb = XLSX.utils.book_new()
  const matches = tournament.matchData || []

  matches.forEach((m, i) => {
    const rows = matchStandings(tournament, m)
    const aoa = [
      [tournament.name || 'Tournament'],
      [`Match ${i + 1}${m.map ? ' - ' + m.map : ''}`],
      [],
      ['Rank', 'Team', 'Alive', 'Kills', 'Kill Pts', 'Pos Pts', 'Total', 'Status'],
      ...rows.map(r => [r.rank, r.name, r.alive, r.kills, r.killPt, r.posPt, r.total, r.status]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, `Match ${i + 1}`)
  })

  // overall sheet
  const orows = overallStandings(tournament)
  const oaoa = [
    [tournament.name || 'Tournament'],
    ['Overall Standings'],
    [],
    ['Rank', 'Team', 'Kills', 'Kill Pts', 'Pos Pts', 'Total'],
    ...orows.map(r => [r.rank, r.name, r.kills, r.killPt, r.posPt, r.total]),
  ]
  const ows = XLSX.utils.aoa_to_sheet(oaoa)
  ows['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 8 }, { wch: 9 }, { wch: 9 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ows, 'Overall')

  XLSX.writeFile(wb, `${safeName(tournament)}_FULL.xlsx`)
}
