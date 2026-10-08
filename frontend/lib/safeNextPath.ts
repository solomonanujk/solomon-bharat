/**
 * Validates a `next` redirect target so post-auth redirects can only go to a
 * same-origin relative path. Rejects absolute URLs, protocol-relative `//host`,
 * backslash tricks (`/\host`), and the auth pages themselves (to avoid loops).
 * Returns null when the value is unsafe or missing.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  // Control characters (incl. tab/newline, which browsers strip) are never valid here.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return null
  }
  if (value === '/signup' || value.startsWith('/signup?') || value.startsWith('/signup/')) return null
  if (value.startsWith('/reset-password')) return null
  try {
    const url = new URL(value, 'http://sb.local')
    if (url.origin !== 'http://sb.local') return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
