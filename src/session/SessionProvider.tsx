import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import type { AuthResponse, User } from '../api/types'
import { API_URL } from '../config'
import { disposeAllSaves } from '../lib/saveRegistry'
import { readStorage, writeStorage } from '../lib/storage'
import { SessionContext, TOKEN_KEY } from './session'

/**
 * Holds the token outside render state so the API client reads it at request time
 * and a discarded token is never sent again.
 */
class TokenStore {
  private value: string | null
  constructor(initial: string | null) {
    this.value = initial
  }
  get(): string | null {
    return this.value
  }
  set(next: string | null): void {
    this.value = next
    writeStorage(TOKEN_KEY, next)
  }
}

export function SessionProvider({ children, apiUrl = API_URL }: { children: ReactNode; apiUrl?: string }) {
  const [token, setToken] = useState<string | null>(() => readStorage(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [store] = useState(() => new TokenStore(token))

  const signOut = useCallback(() => {
    disposeAllSaves()
    store.set(null)
    setToken(null)
    setUser(null)
  }, [store])

  const signIn = useCallback(
    (auth: AuthResponse) => {
      store.set(auth.token)
      setToken(auth.token)
      setUser(auth.user)
    },
    [store],
  )

  const api = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => store.get(), onUnauthorized: signOut }),
    [apiUrl, store, signOut],
  )

  // Load the profile for a token restored from storage. A 401 signs out via the client hook.
  useEffect(() => {
    if (!token || user) return
    let cancelled = false
    api.me().then(
      (me) => {
        if (!cancelled) setUser(me)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [api, token, user])

  // Signing out in another tab signs out here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && !e.newValue && store.get()) signOut()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store, signOut])

  const value = useMemo(() => ({ token, user, api, signIn, signOut }), [token, user, api, signIn, signOut])
  return <SessionContext value={value}>{children}</SessionContext>
}
