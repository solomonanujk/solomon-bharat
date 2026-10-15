import React from 'react'

// Minimal, safe formatter for Solomon AI replies: paragraphs, "-" / "1." lists, **bold**,
// and "|" tables. Everything is rendered as React text, never as raw HTML.

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

export function GuideMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }
    if (/^#{1,6}\s/.test(line)) {
      blocks.push(<p key={i} className="font-[700]">{inline(line.replace(/^#{1,6}\s/, ''))}</p>)
      i += 1
      continue
    }
    if (/^[-*•]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      const ordered = /^\d+[.)]\s/.test(line)
      const items: string[] = []
      while (i < lines.length && (/^[-*•]\s/.test(lines[i].trim()) || /^\d+[.)]\s/.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s/, ''))
        i += 1
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List key={i} className={ordered ? 'list-decimal pl-5 space-y-1' : 'list-disc pl-5 space-y-1'}>
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </List>,
      )
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i += 1
      }
      blocks.push(
        <div key={i} className="overflow-x-auto">
          <table className="text-[13px] border-collapse">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'font-[700]' : ''}>
                  {r.map((c, ci) => <td key={ci} className="border border-current/20 px-2 py-1 align-top">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^([-*•]|\d+[.)])\s|^\||^#{1,6}\s/.test(lines[i].trim())) {
      para.push(lines[i].trim())
      i += 1
    }
    blocks.push(<p key={i}>{inline(para.join(' '))}</p>)
  }
  return <div className={className ?? 'flex flex-col gap-2.5'}>{blocks}</div>
}
