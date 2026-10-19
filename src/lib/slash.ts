// Slash command menu model (spec web-client "Slash command menu").
import type { BlockType } from '../api/types'

export interface SlashOption {
  type: BlockType
  label: string
  hint: string
  /** Glyph shown in the menu; purely decorative. */
  glyph: string
  keywords: readonly string[]
}

export const SLASH_OPTIONS: readonly SlashOption[] = [
  { type: 'paragraph', label: 'Text', hint: 'Plain text', glyph: 'Aa', keywords: ['paragraph', 'plain'] },
  { type: 'heading1', label: 'Heading 1', hint: 'Big section heading', glyph: 'H1', keywords: ['h1', 'title'] },
  { type: 'heading2', label: 'Heading 2', hint: 'Medium section heading', glyph: 'H2', keywords: ['h2', 'subtitle'] },
  { type: 'heading3', label: 'Heading 3', hint: 'Small section heading', glyph: 'H3', keywords: ['h3'] },
  { type: 'todo', label: 'To-do list', hint: 'Track tasks with a checkbox', glyph: '☐', keywords: ['todo', 'task', 'checkbox', 'check'] },
  { type: 'bulleted', label: 'Bulleted list', hint: 'A simple bulleted list', glyph: '•', keywords: ['bullet', 'unordered', 'ul'] },
  { type: 'numbered', label: 'Numbered list', hint: 'A list with numbering', glyph: '1.', keywords: ['number', 'ordered', 'ol'] },
  { type: 'quote', label: 'Quote', hint: 'Capture a quote', glyph: '❝', keywords: ['blockquote', 'citation'] },
  { type: 'code', label: 'Code', hint: 'Monospace, whitespace kept', glyph: '</>', keywords: ['snippet', 'pre'] },
  { type: 'divider', label: 'Divider', hint: 'Visually divide blocks', glyph: '—', keywords: ['hr', 'separator', 'line', 'rule'] },
]

/** The menu query if `text` is a slash command ("/head" -> "head"), else null. */
export function slashQuery(text: string): string | null {
  return text.startsWith('/') && !text.includes('\n') ? text.slice(1) : null
}

/** The menu opens when `/` is typed as the first character of an empty block. */
export function opensSlashMenu(prevText: string, nextText: string): boolean {
  return prevText === '' && nextText === '/'
}

/**
 * Filter by name, case-insensitively. Label prefix matches rank first, then
 * other label matches, then keyword/type matches; ties keep menu order.
 */
export function filterSlashOptions(query: string, options: readonly SlashOption[] = SLASH_OPTIONS): SlashOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...options]
  const ranked: { option: SlashOption; rank: number; order: number }[] = []
  options.forEach((option, order) => {
    const label = option.label.toLowerCase()
    let rank = -1
    if (label.startsWith(q)) rank = 0
    else if (label.split(/[\s-]+/).some((w) => w.startsWith(q)) || label.includes(q)) rank = 1
    else if (option.type.startsWith(q) || option.keywords.some((k) => k.startsWith(q))) rank = 2
    if (rank >= 0) ranked.push({ option, rank, order })
  })
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return ranked.map((r) => r.option)
}

/** Move the highlighted index with wrap-around. */
export function moveSelection(current: number, delta: number, count: number): number {
  if (count <= 0) return 0
  return (((current + delta) % count) + count) % count
}

/** DOM id of a menu option, for aria-activedescendant. */
export function slashOptionId(menuId: string, index: number): string {
  return `${menuId}-opt-${index}`
}
