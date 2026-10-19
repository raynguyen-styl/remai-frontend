import { useCallback, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value: string
  ref?: Ref<HTMLTextAreaElement>
}

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// One observer for every auto-growing textarea: re-fit when its width changes
// (wrapping changes the height). Height changes caused by fit() are ignored.
const widths = new WeakMap<Element, number>()
let observer: ResizeObserver | null = null

function observe(el: HTMLTextAreaElement) {
  if (typeof ResizeObserver === 'undefined') return
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = Math.round(entry.contentRect.width)
      if (widths.get(entry.target) !== width) {
        widths.set(entry.target, width)
        fit(entry.target as HTMLTextAreaElement)
      }
    }
  })
  observer.observe(el)
}

/** A textarea that grows with its content (design D8: blocks are textareas, not contentEditable). */
export function AutoTextarea({ value, ref, rows = 1, ...rest }: Props) {
  const inner = useRef<HTMLTextAreaElement | null>(null)

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (inner.current && inner.current !== el) observer?.unobserve(inner.current)
      inner.current = el
      if (el) observe(el)
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  useLayoutEffect(() => {
    fit(inner.current)
  }, [value])

  return <textarea ref={setRef} value={value} rows={rows} {...rest} />
}
