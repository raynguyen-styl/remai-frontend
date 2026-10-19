import { useEffect } from 'react'

export const APP_NAME = 'remai'

/** Sets the browser tab title to "<title> – remai" while mounted. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} – ${APP_NAME}` : APP_NAME
  }, [title])
  useEffect(
    () => () => {
      document.title = APP_NAME
    },
    [],
  )
}
