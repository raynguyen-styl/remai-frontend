import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../api/client'
import type { Page } from '../api/types'
import { flushAllSaves } from '../lib/saveRegistry'
import { subtreeIds } from '../lib/tree'
import { useApi } from '../session/session'
import { PagesContext, type LoadStatus } from './pages'

export function PagesProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const navigate = useNavigate()
  const location = useLocation()
  const [pages, setPages] = useState<Page[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const pathRef = useRef(location.pathname)
  const pagesRef = useRef(pages)

  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])
  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  const reload = useCallback(async () => {
    try {
      const list = await api.listPages()
      setPages(list)
      setStatus('ready')
    } catch (err) {
      setStatus((s) => (s === 'ready' ? s : 'error'))
      setNotice(errorMessage(err, "Couldn't load your pages."))
    }
  }, [api])

  useEffect(() => {
    let cancelled = false
    api.listPages().then(
      (list) => {
        if (cancelled) return
        setPages(list)
        setStatus('ready')
      },
      () => {
        if (!cancelled) setStatus('error')
      },
    )
    return () => {
      cancelled = true
    }
  }, [api])

  const createPage = useCallback(
    async (parentId: string | null = null) => {
      try {
        const page = await api.createPage(parentId ? { parentId } : {})
        setPages((list) => [...list, page])
        navigate(`/p/${page.id}`)
        return page
      } catch (err) {
        setNotice(errorMessage(err, "Couldn't create the page."))
        return null
      }
    },
    [api, navigate],
  )

  const trashPage = useCallback(
    async (id: string) => {
      // Save pending edits first so a restored page has its latest content.
      await flushAllSaves()
      try {
        await api.trashPage(id)
      } catch (err) {
        setNotice(errorMessage(err, "Couldn't move the page to the trash."))
        return
      }
      const removed = subtreeIds(pagesRef.current, id)
      setPages((list) => list.filter((p) => !removed.has(p.id)))
      const openId = matchPath('/p/:pageId', pathRef.current)?.params.pageId
      if (openId && (removed.has(openId) || openId === id)) navigate('/', { replace: true })
      setNotice('Moved to trash')
    },
    [api, navigate],
  )

  const patchLocal = useCallback((id: string, patch: Partial<Pick<Page, 'title' | 'icon' | 'updatedAt'>>) => {
    setPages((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const value = useMemo(
    () => ({ pages, status, reload, createPage, trashPage, patchLocal, notice, showNotice: setNotice, dismissNotice }),
    [pages, status, reload, createPage, trashPage, patchLocal, notice, dismissNotice],
  )
  return <PagesContext value={value}>{children}</PagesContext>
}
