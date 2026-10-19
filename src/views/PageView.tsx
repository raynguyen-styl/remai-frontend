import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../api/client'
import { LIMITS, type Block, type UpdatePageInput } from '../api/types'
import { BlockEditor, type BlockEditorHandle } from '../editor/BlockEditor'
import { AutosaveController, statusLabel, type SaveStatus } from '../lib/autosave'
import { ensureEditable } from '../lib/blocks'
import { registerSaver, unregisterSaver } from '../lib/saveRegistry'
import { displayTitle } from '../lib/title'
import { ancestorsOf } from '../lib/tree'
import { usePages } from '../pages/pages'
import { useApi } from '../session/session'
import { TopBar } from '../shell/TopBar'
import { AutoTextarea } from '../ui/AutoTextarea'
import { EmojiPicker } from '../ui/EmojiPicker'
import { DotsIcon, SmileIcon, TrashIcon } from '../ui/Icons'
import { Menu } from '../ui/Menu'
import { useDocumentTitle } from '../ui/useDocumentTitle'

/** Route element for /p/:pageId. Keyed so every page gets fresh editor + autosave state. */
export function PageRoute() {
  const { pageId = '' } = useParams()
  return <PageView key={pageId} pageId={pageId} />
}

type LoadState = 'loading' | 'ready' | 'notfound' | 'error'

interface Snapshot {
  title: string
  icon: string
  blocks: Block[]
}

/** Errors a retry cannot fix: bad input, signed out, page gone, too large. */
const NON_RETRYABLE = new Set([400, 401, 404, 413])

function PageView({ pageId }: { pageId: string }) {
  const api = useApi()
  const { pages, patchLocal, trashPage } = usePages()
  const [load, setLoad] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [save, setSave] = useState<{ status: SaveStatus; retrying: boolean }>({ status: 'idle', retrying: false })
  const [pickerOpen, setPickerOpen] = useState(false)

  const latest = useRef<Snapshot>({ title: '', icon: '', blocks: [] })
  const dirty = useRef({ title: false, icon: false, blocks: false })
  const controllerRef = useRef<AutosaveController | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<BlockEditorHandle>(null)
  const focusTitleOnReady = useRef(false)

  useDocumentTitle(load === 'ready' ? displayTitle(title) : null)

  // Load the page with its blocks.
  useEffect(() => {
    const ctrl = new AbortController()
    api.getPage(pageId, ctrl.signal).then(
      (page) => {
        const initial = ensureEditable(page.blocks)
        latest.current = { title: page.title, icon: page.icon, blocks: initial }
        focusTitleOnReady.current = !page.title && page.blocks.length === 0
        setTitle(page.title)
        setIcon(page.icon)
        setBlocks(initial)
        setLoad('ready')
        patchLocal(pageId, { title: page.title, icon: page.icon })
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return
        if (isApiError(err) && err.status === 401) return // session handler shows sign-in
        setLoad(isApiError(err) && (err.status === 404 || err.status === 400) ? 'notfound' : 'error')
      },
    )
    return () => ctrl.abort()
  }, [api, pageId, attempt, patchLocal])

  useEffect(() => {
    if (load === 'ready' && focusTitleOnReady.current) {
      focusTitleOnReady.current = false
      titleRef.current?.focus()
    }
  }, [load])

  // Autosave (design D10): one controller per page; title via PATCH, content via PUT.
  useEffect(() => {
    const controller = new AutosaveController({
      save: async () => {
        const pending = { ...dirty.current }
        dirty.current = { title: false, icon: false, blocks: false }
        const snap = latest.current
        try {
          if (pending.title || pending.icon) {
            const patch: UpdatePageInput = {}
            if (pending.title) patch.title = snap.title
            if (pending.icon) patch.icon = snap.icon
            const page = await api.updatePage(pageId, patch)
            pending.title = false
            pending.icon = false
            patchLocal(pageId, { updatedAt: page.updatedAt })
          }
          if (pending.blocks) {
            await api.saveBlocks(pageId, snap.blocks)
            pending.blocks = false
          }
        } catch (err) {
          const d = dirty.current
          dirty.current = { title: d.title || pending.title, icon: d.icon || pending.icon, blocks: d.blocks || pending.blocks }
          throw err
        }
      },
      onStatus: (status, retrying) => setSave({ status, retrying }),
      shouldRetry: (err) => !(isApiError(err) && NON_RETRYABLE.has(err.status)),
    })
    controllerRef.current = controller
    registerSaver(controller)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void controller.flush()
    }
    const onPageHide = () => void controller.flush()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!controller.hasPendingWork) return
      void controller.flush()
      e.preventDefault() // ask the browser to confirm leaving with unsaved edits
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      controllerRef.current = null
      // Leaving the page: save now, and keep retrying in the background if that fails.
      const finish = () => {
        controller.dispose()
        unregisterSaver(controller)
      }
      controller.setStatusListener((status) => {
        if (status === 'saved') finish()
      })
      void controller.flush().then(() => {
        if (!controller.hasPendingWork) finish()
      })
    }
  }, [api, pageId, patchLocal])

  const markDirty = useCallback((part: 'title' | 'icon' | 'blocks') => {
    dirty.current[part] = true
    controllerRef.current?.markDirty()
  }, [])

  function onTitleChange(value: string) {
    const next = value.replace(/[\r\n]+/g, ' ')
    setTitle(next)
    latest.current = { ...latest.current, title: next }
    patchLocal(pageId, { title: next })
    markDirty('title')
  }

  function onIconChange(next: string) {
    setIcon(next)
    setPickerOpen(false)
    latest.current = { ...latest.current, icon: next }
    patchLocal(pageId, { icon: next })
    markDirty('icon')
  }

  const onBlocksChange = useCallback(
    (next: Block[]) => {
      setBlocks(next)
      latest.current = { ...latest.current, blocks: next }
      markDirty('blocks')
    },
    [markDirty],
  )

  function focusTitleEnd() {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }

  const crumbs = ancestorsOf(pages, pageId)
  const statusText = statusLabel(save.status, save.retrying)

  if (load === 'notfound' || load === 'error') {
    return (
      <>
        <TopBar />
        <div className="empty-state">
          <h1>{load === 'notfound' ? 'This page doesn’t exist' : 'Couldn’t open this page'}</h1>
          <p>
            {load === 'notfound'
              ? 'It may have been moved to the trash or deleted.'
              : 'Check your connection and try again.'}
          </p>
          <div className="empty-actions">
            {load === 'error' && (
              <button type="button" className="btn btn-primary" onClick={() => {
                setLoad('loading')
                setAttempt((a) => a + 1)
              }}>
                Try again
              </button>
            )}
            <Link to="/" className="btn">
              Go home
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar
        end={
          <>
            <span className={`save-status save-${save.status}`} role="status" aria-live="polite">
              {statusText}
            </span>
            {load === 'ready' && (
              <Menu
                label="Page actions"
                trigger={<DotsIcon />}
                triggerClassName="icon-btn"
                align="end"
                items={[{ label: 'Move to trash', icon: <TrashIcon />, onSelect: () => void trashPage(pageId), danger: true }]}
              />
            )}
          </>
        }
      >
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            {crumbs.map((p) => (
              <li key={p.id} className="crumb crumb-ancestor">
                <Link to={`/p/${p.id}`}>
                  {p.icon && <span aria-hidden="true">{p.icon} </span>}
                  {displayTitle(p.title)}
                </Link>
              </li>
            ))}
            <li className="crumb" aria-current="page">
              {load === 'ready' ? (
                <>
                  {icon && <span aria-hidden="true">{icon} </span>}
                  {displayTitle(title)}
                </>
              ) : (
                ' '
              )}
            </li>
          </ol>
        </nav>
      </TopBar>

      {load === 'loading' ? (
        <div className="page page-loading" aria-busy="true">
          <div className="skeleton skeleton-title" />
          <div className="skeleton" />
          <div className="skeleton skeleton-short" />
        </div>
      ) : (
        <article className="page">
          <div className={`page-header ${icon ? 'has-icon' : ''}`}>
            <div className="page-icon-row">
              {icon ? (
                <button
                  type="button"
                  className="page-icon"
                  aria-label="Change icon"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  {icon}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-small add-icon"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  <SmileIcon /> Add icon
                </button>
              )}
              {pickerOpen && (
                <EmojiPicker
                  hasIcon={!!icon}
                  onSelect={onIconChange}
                  onRemove={() => onIconChange('')}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
            <AutoTextarea
              ref={titleRef}
              className="page-title"
              aria-label="Page title"
              placeholder="Untitled"
              maxLength={LIMITS.titleMax}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                const el = e.currentTarget
                if (e.key === 'Enter' || (e.key === 'ArrowDown' && el.selectionStart === el.value.length)) {
                  e.preventDefault()
                  editorRef.current?.focusFirst()
                }
              }}
            />
          </div>
          <BlockEditor ref={editorRef} blocks={blocks} onChange={onBlocksChange} onExitTop={focusTitleEnd} />
        </article>
      )}
    </>
  )
}

