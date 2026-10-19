import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { returnPath, type ReturnState } from '../lib/returnPath'
import { useSession } from './session'

/** Spec web-client "Addressable pages": signed-out visitors see sign-in, then return here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useSession()
  const location = useLocation()
  if (!token) {
    const state: ReturnState = { from: { pathname: location.pathname, search: location.search, hash: location.hash } }
    return <Navigate to="/login" replace state={state} />
  }
  return children
}

/** Sign-in/up screens redirect away once a session exists. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { token } = useSession()
  const location = useLocation()
  if (token) return <Navigate to={returnPath(location.state)} replace />
  return children
}
