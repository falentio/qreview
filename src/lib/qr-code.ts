const QR_SLUG_PATTERN = /^[a-z0-9]{10}$/

export function getSlugFromQrValue(value: string): string | null {
  const trimmed = value.trim()
  if (QR_SLUG_PATTERN.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    const match = url.pathname.match(/^\/r\/([a-z0-9]{10})\/?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}
