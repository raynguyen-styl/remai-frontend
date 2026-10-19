import { LIMITS } from '../api/types'

/** Client-side mirror of the server's registration rules (spec user-auth). */
export function validateRegistration(input: { email: string; name: string; password: string }): string | null {
  const email = input.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  const name = input.name.trim()
  if (name.length < 1 || name.length > LIMITS.nameMax) return `Name must be 1–${LIMITS.nameMax} characters.`
  if (input.password.length < LIMITS.passwordMin || input.password.length > LIMITS.passwordMax)
    return `Password must be ${LIMITS.passwordMin}–${LIMITS.passwordMax} characters.`
  return null
}
