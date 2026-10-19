import { describe, expect, it } from 'vitest'
import { filterSlashOptions, moveSelection, opensSlashMenu, SLASH_OPTIONS, slashQuery } from './slash'

const labels = (q: string) => filterSlashOptions(q).map((o) => o.label)

describe('Slash command menu — model', () => {
  it('offers every block type', () => {
    expect(SLASH_OPTIONS.map((o) => o.type).sort()).toEqual(
      ['bulleted', 'code', 'divider', 'heading1', 'heading2', 'heading3', 'numbered', 'paragraph', 'quote', 'todo'].sort(),
    )
  })

  it('opens when "/" is typed as the first character of an empty block', () => {
    expect(opensSlashMenu('', '/')).toBe(true)
    expect(opensSlashMenu('a', 'a/')).toBe(false)
    expect(opensSlashMenu('', 'x')).toBe(false)
  })

  it('derives the query from the block text', () => {
    expect(slashQuery('/head')).toBe('head')
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('head')).toBeNull()
    expect(slashQuery('/a\nb')).toBeNull()
  })

  it('shows everything for an empty query', () => {
    expect(filterSlashOptions('')).toHaveLength(SLASH_OPTIONS.length)
  })

  it('Turn into heading: "/head" filters to the headings with Heading 1 first', () => {
    expect(labels('head')).toEqual(['Heading 1', 'Heading 2', 'Heading 3'])
  })

  it('filters by name case-insensitively', () => {
    expect(labels('QUO')).toEqual(['Quote'])
    expect(labels('list')).toEqual(['To-do list', 'Bulleted list', 'Numbered list'])
  })

  it('ranks label prefix matches before keyword matches', () => {
    expect(labels('to')[0]).toBe('To-do list')
    expect(labels('todo')).toEqual(['To-do list'])
    expect(labels('h1')).toEqual(['Heading 1'])
  })

  it('returns nothing when no option matches', () => {
    expect(labels('table')).toEqual([])
  })

  it('arrow selection wraps around', () => {
    expect(moveSelection(0, -1, 3)).toBe(2)
    expect(moveSelection(2, 1, 3)).toBe(0)
    expect(moveSelection(0, 1, 0)).toBe(0)
  })
})
