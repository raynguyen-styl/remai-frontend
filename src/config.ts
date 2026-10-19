const DEFAULT_API_URL = 'http://localhost:8080'

/** Base URL of remai-backend, from `VITE_API_URL` (no trailing slash). */
export const API_URL: string = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
