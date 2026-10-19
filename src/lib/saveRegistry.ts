// Tracks live autosave controllers so sign-out / trash can flush pending edits first.
import type { AutosaveController } from './autosave'

const controllers = new Set<AutosaveController>()

export function registerSaver(c: AutosaveController): void {
  controllers.add(c)
}

export function unregisterSaver(c: AutosaveController): void {
  controllers.delete(c)
}

export function hasPendingSaves(): boolean {
  for (const c of controllers) if (c.hasPendingWork) return true
  return false
}

/** Flush every controller; gives up waiting after `timeoutMs`. */
export async function flushAllSaves(timeoutMs = 3000): Promise<void> {
  const all = Promise.all([...controllers].map((c) => c.flush()))
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  await Promise.race([all, timeout])
  clearTimeout(timer)
}

export function disposeAllSaves(): void {
  for (const c of controllers) c.dispose()
  controllers.clear()
}
