import { describe, expect, it } from 'vitest'
import { EMOJI } from './emoji'
import { highlightParts } from './highlight'
import { newId } from './ids'
import { displayTitle } from './title'
import { validateRegistration } from './validation'

describe('Untitled display', () => {
  it('shows empty or blank titles as "Untitled"', () => {
    expect(displayTitle('')).toBe('Untitled')
    expect(displayTitle('   ')).toBe('Untitled')
    expect(displayTitle('Ideas')).toBe('Ideas')
  })
})

describe('search snippet highlighting', () => {
  it('splits case-insensitively and treats the query literally', () => {
    expect(highlightParts('Buy Oat milk', 'oat MILK')).toEqual([
      { text: 'Buy ', match: false },
      { text: 'Oat milk', match: true },
    ])
    expect(highlightParts('100% done, 1000 left', '100%')).toEqual([
      { text: '100%', match: true },
      { text: ' done, 1000 left', match: false },
    ])
    expect(highlightParts('a.b', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b', match: false },
    ])
  })
})

describe('Registration input validation (client mirror)', () => {
  const secret = (n: number) => 'x'.repeat(n)
  const ok = { email: 'ada@example.com', name: 'Ada', password: secret(8) }
  it('accepts valid input', () => expect(validateRegistration(ok)).toBeNull())
  it('Short password: rejects a 7-character password', () =>
    expect(validateRegistration({ ...ok, password: secret(7) })).toMatch(/Password/))
  it('rejects a 73-character password', () => expect(validateRegistration({ ...ok, password: secret(73) })).toMatch(/Password/))
  it('Invalid email: rejects not-an-email', () => expect(validateRegistration({ ...ok, email: 'not-an-email' })).toMatch(/email/))
  it('rejects blank or 81-character names', () => {
    expect(validateRegistration({ ...ok, name: '  ' })).toMatch(/Name/)
    expect(validateRegistration({ ...ok, name: 'x'.repeat(81) })).toMatch(/Name/)
  })
})

describe('misc', () => {
  it('has at least 20 emoji, each within the 16-character icon limit', () => {
    expect(EMOJI.length).toBeGreaterThanOrEqual(20)
    for (const e of EMOJI) expect(e.length).toBeLessThanOrEqual(16)
  })
  it('generates distinct UUID v4 ids', () => {
    const a = newId()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newId()).not.toBe(a)
  })
})
