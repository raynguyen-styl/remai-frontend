import { createContext, use } from 'react'
import type { ApiClient } from '../api/client'
import type { AuthResponse, User } from '../api/types'

/** localStorage key for the session token (design D8; see Risks). */
export const TOKEN_KEY = 'remai.token'

export interface SessionValue {
  token: string | null
  user: User | null
  api: ApiClient
  signIn: (auth: AuthResponse) => void
  /** Discards the token; RequireAuth then shows the sign-in screen. */
  signOut: () => void
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

export function useApi(): ApiClient {
  return useSession().api
}
