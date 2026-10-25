/**
 * A small CSV reader for the audience step: handles quoted cells, doubled quotes, commas and newlines
 * inside quotes, CRLF, and a leading byte-order mark. Returns the header row and one object per data row.
 */
export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): ParsedCsv {
  const source = text.replace(/^﻿/, '')
  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      table.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    table.push(row)
  }

  const nonEmpty = table.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = (r[i] ?? '').trim()
    })
    return obj
  })
  return { headers: headers.filter(Boolean), rows }
}
