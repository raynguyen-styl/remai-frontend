// Autosave protocol (design D10, spec page-content "Autosave").
// - markDirty() (re)starts an 800 ms debounce.
// - Only one save is in flight; edits during a save mark it dirty and another save follows.
// - flush() saves now (leaving the page / tab hidden).
// - On failure: status "error", retry with backoff 2 s -> 4 s -> ... capped at 30 s.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type StatusListener = (status: SaveStatus, retrying: boolean) => void

export interface AutosaveOptions {
  /** Persist the latest state. Read state at call time, not at markDirty time. */
  save: () => Promise<void>
  /** `retrying` is true when a failed save has a retry scheduled. */
  onStatus?: StatusListener
  /** Return false for errors that retrying cannot fix (e.g. 401, 404). */
  shouldRetry?: (error: unknown) => boolean
  debounceMs?: number
  retryBaseMs?: number
  retryMaxMs?: number
}

export const AUTOSAVE_DEBOUNCE_MS = 800
export const RETRY_BASE_MS = 2000
export const RETRY_MAX_MS = 30000

export class AutosaveController {
  private readonly opts: Required<Omit<AutosaveOptions, 'onStatus'>> & Pick<AutosaveOptions, 'onStatus'>
  private dirty = false
  private inFlight: Promise<void> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private failures = 0
  private disposed = false
  private status: SaveStatus = 'idle'
  private idleWaiters: (() => void)[] = []

  constructor(options: AutosaveOptions) {
    this.opts = {
      shouldRetry: () => true,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      retryBaseMs: RETRY_BASE_MS,
      retryMaxMs: RETRY_MAX_MS,
      ...options,
    }
  }

  get isDirty(): boolean {
    return this.dirty
  }

  /** True while there is anything not yet persisted (dirty or a save in flight). */
  get hasPendingWork(): boolean {
    return this.dirty || this.inFlight !== null
  }

  get currentStatus(): SaveStatus {
    return this.status
  }

  get isRetrying(): boolean {
    return this.retryTimer !== null
  }

  /** Swap the status listener, e.g. when the view unmounts but pending work must still finish. */
  setStatusListener(listener: StatusListener | undefined): void {
    this.opts.onStatus = listener
  }

  markDirty(): void {
    if (this.disposed) return
    this.dirty = true
    // While a retry is scheduled, the retry will pick up the latest state.
    if (this.retryTimer) return
    this.clearDebounce()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.run()
    }, this.opts.debounceMs)
  }

  /** Save pending changes now. Resolves once nothing is dirty or a save has failed. */
  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.clearDebounce()
    if (this.retryTimer && this.dirty) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (!this.dirty && !this.inFlight) return Promise.resolve()
    const done = new Promise<void>((resolve) => this.idleWaiters.push(resolve))
    if (!this.inFlight) this.run()
    return done
  }

  dispose(): void {
    this.disposed = true
    this.clearDebounce()
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.resolveWaiters()
  }

  private clearDebounce() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = null
  }

  private setStatus(status: SaveStatus) {
    this.status = status
    this.opts.onStatus?.(status, this.retryTimer !== null)
  }

  private resolveWaiters() {
    const waiters = this.idleWaiters
    this.idleWaiters = []
    waiters.forEach((w) => w())
  }

  private run(): void {
    if (this.disposed) return
    if (this.inFlight) return // the in-flight save re-runs on completion if dirty
    if (!this.dirty) {
      this.resolveWaiters()
      return
    }
    this.dirty = false
    this.setStatus('saving')
    const attempt = this.opts.save()
    this.inFlight = attempt
    attempt.then(
      () => this.onSettled(null),
      (error: unknown) => this.onSettled({ error }),
    )
  }

  private onSettled(failure: { error: unknown } | null) {
    this.inFlight = null
    if (this.disposed) return

    if (failure) {
      this.dirty = true // the failed changes still need saving
      this.failures += 1
      if (this.opts.shouldRetry(failure.error)) {
        const delay = Math.min(this.opts.retryBaseMs * 2 ** (this.failures - 1), this.opts.retryMaxMs)
        this.clearDebounce()
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          this.run()
        }, delay)
      }
      this.setStatus('error')
      this.resolveWaiters()
      return
    }

    this.failures = 0
    if (this.dirty) {
      // Edited during the save: save again, unless a debounce is still counting down.
      if (this.debounceTimer) {
        this.setStatus('saving')
      } else {
        this.run()
      }
      return
    }
    this.setStatus('saved')
    this.resolveWaiters()
  }
}

export function statusLabel(status: SaveStatus, retrying = true): string {
  switch (status) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return retrying ? "Couldn't save – retrying" : "Couldn't save"
    default:
      return ''
  }
}
