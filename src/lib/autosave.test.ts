import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutosaveController, statusLabel, type SaveStatus } from './autosave'

interface Deferred {
  resolve: () => void
  reject: (e: unknown) => void
}

/** A save function whose calls stay pending until the test settles them. */
function controllableSave() {
  const calls: Deferred[] = []
  const save = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        calls.push({ resolve, reject })
      }),
  )
  return { save, calls }
}

function setup(opts: Partial<ConstructorParameters<typeof AutosaveController>[0]> = {}) {
  const { save, calls } = controllableSave()
  const statuses: [SaveStatus, boolean][] = []
  const c = new AutosaveController({ save, onStatus: (s, r) => statuses.push([s, r]), ...opts })
  return { c, save, calls, statuses, last: () => statuses.at(-1) }
}

/** Let promise callbacks run without moving fake time. */
const tick = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Autosave', () => {
  it('Edit then pause: saves 800 ms after the last edit and shows "Saved"', async () => {
    const { c, save, calls, last } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(799)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(last()).toEqual(['saving', false])
    calls[0]!.resolve()
    await tick()
    expect(last()).toEqual(['saved', false])
    expect(statusLabel('saved')).toBe('Saved')
  })

  it('debounces: each edit restarts the 800 ms wait (saves within ~1 s of stopping)', async () => {
    const { c, save } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(500)
    c.markDirty()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('keeps a single save in flight; edits during it trigger exactly one follow-up save', async () => {
    const { c, save, calls } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)

    c.markDirty()
    await vi.advanceTimersByTimeAsync(800) // debounce fires while the first save is pending
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)

    calls[0]!.resolve()
    await tick()
    expect(save).toHaveBeenCalledTimes(2)
    calls[1]!.resolve()
    await tick()
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(c.hasPendingWork).toBe(false)
  })

  it('a save that finishes during an ongoing debounce waits for that debounce', async () => {
    const { c, save, calls, last } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    c.markDirty() // debounce restarts while in flight
    calls[0]!.resolve()
    await tick()
    expect(save).toHaveBeenCalledTimes(1)
    expect(last()![0]).toBe('saving')
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('Save failure surfaced: shows the failed state and retries with backoff 2 s, 4 s, … capped at 30 s', async () => {
    const { c, save, calls, last } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('offline'))
    await tick()
    expect(last()).toEqual(['error', true])
    expect(statusLabel('error', true)).toBe("Couldn't save – retrying")
    expect(c.isDirty).toBe(true)

    const delays = [2000, 4000, 8000, 16000, 30000, 30000]
    for (const [i, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(save).toHaveBeenCalledTimes(i + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(save).toHaveBeenCalledTimes(i + 2)
      calls[i + 1]!.reject(new Error('offline'))
      await tick()
    }

    // Recovery: next retry succeeds and the status returns to Saved.
    await vi.advanceTimersByTimeAsync(30000)
    calls.at(-1)!.resolve()
    await tick()
    expect(last()).toEqual(['saved', false])
  })

  it('edits made while a retry is pending are included in that retry', async () => {
    const { c, save, calls } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('offline'))
    await tick()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1) // no extra save; the retry is still scheduled
    await vi.advanceTimersByTimeAsync(1200)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not retry errors that retrying cannot fix', async () => {
    const { c, save, calls, last } = setup({ shouldRetry: () => false })
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('404'))
    await tick()
    expect(last()).toEqual(['error', false])
    expect(statusLabel('error', false)).toBe("Couldn't save")
    await vi.advanceTimersByTimeAsync(60000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush saves immediately (leaving the page) and resolves when done', async () => {
    const { c, save, calls } = setup()
    c.markDirty()
    const flushed = c.flush()
    expect(save).toHaveBeenCalledTimes(1)
    let done = false
    void flushed.then(() => {
      done = true
    })
    await tick()
    expect(done).toBe(false)
    calls[0]!.resolve()
    await tick()
    expect(done).toBe(true)
  })

  it('flush with nothing pending resolves without saving', async () => {
    const { c, save } = setup()
    await c.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('flush during an in-flight save waits for it and then saves newer edits', async () => {
    const { c, save, calls } = setup()
    c.markDirty()
    await vi.advanceTimersByTimeAsync(800)
    c.markDirty()
    const flushed = c.flush()
    expect(save).toHaveBeenCalledTimes(1)
    calls[0]!.resolve()
    await tick()
    expect(save).toHaveBeenCalledTimes(2)
    calls[1]!.resolve()
    await flushed
  })

  it('dispose stops pending timers', async () => {
    const { c, save } = setup()
    c.markDirty()
    c.dispose()
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).not.toHaveBeenCalled()
  })
})
