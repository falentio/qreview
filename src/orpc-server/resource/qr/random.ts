const slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

export function generateQrId(): string {
  return crypto.randomUUID()
}

export function generateQrSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let slug = ""
  for (const byte of bytes) slug += slugAlphabet[byte % slugAlphabet.length]
  return slug
}
