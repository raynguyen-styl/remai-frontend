export interface TextPart {
  text: string
  match: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split `text` into plain/matching parts for a case-insensitive literal `query` (rendered as text, never HTML). */
export function highlightParts(text: string, query: string): TextPart[] {
  const q = query.trim()
  if (!q) return [{ text, match: false }]
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi')
  return text
    .split(re)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, match: t.toLowerCase() === q.toLowerCase() }))
}
