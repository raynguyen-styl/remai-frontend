export const UNTITLED = 'Untitled'

/** Spec page-management "Untitled display": empty titles show as "Untitled" everywhere. */
export function displayTitle(title: string | null | undefined): string {
  return title && title.trim() ? title : UNTITLED
}
