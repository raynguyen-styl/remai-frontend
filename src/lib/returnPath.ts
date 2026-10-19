import type { Location } from 'react-router'

export interface ReturnState {
  from?: Pick<Location, 'pathname' | 'search' | 'hash'>
}

/** Where to go after sign-in: the deep link that sent us to /login, else home. */
export function returnPath(state: unknown): string {
  const from = (state as ReturnState | null)?.from
  if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/')) return '/'
  // Never bounce back to the auth screens; reject protocol-relative paths.
  if (from.pathname.startsWith('//') || from.pathname === '/login' || from.pathname === '/register') return '/'
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}
