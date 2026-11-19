/** This web app's own address with a code on it, so a phone camera opens it straight into "Bring in settings". */
export function moveLink(code: string): string {
  return `${location.origin}${location.pathname}#move=${code}`
}

/** A code carried in on the link (#move=...), read once when the app opens. */
export function takeMoveFromLink(): string | null {
  const m = /[#&]move=([^&]+)/.exec(location.hash)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return decodeURIComponent(m[1])
}
