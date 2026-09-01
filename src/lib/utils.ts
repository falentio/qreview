import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, fallback: string) {
  const message = getErrorText(error)
  const code = getErrorCode(error)
  return message && code && safeErrorCodes.has(code) ? message : fallback
}

const safeErrorCodes = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SERVICE_UNAVAILABLE",
  "VALIDATION_ERROR",
  "INVALID_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_PASSWORD",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "EMAIL_NOT_VERIFIED",
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "ACCOUNT_NOT_FOUND",
  "CREDENTIAL_ACCOUNT_NOT_FOUND",
  "SESSION_EXPIRED",
  "USER_NOT_FOUND",
  "MISSING_FIELD",
])

function getErrorText(error: unknown): string | null {
  if (error instanceof Error) return error.message || null
  if (typeof error !== "object" || error === null) return null

  return "message" in error && typeof error.message === "string" && error.message
    ? error.message
    : null
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null

  if ("code" in error && typeof error.code === "string") return error.code
  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data &&
    typeof error.data.code === "string"
  ) {
    return error.data.code
  }

  return null
}

export function dateInputToExpiry(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

export function expiryToDateInput(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export type TarFile = {
  name: string
  data: Uint8Array
}

const TAR_BLOCK_SIZE = 512

function writeTarString(target: Uint8Array, offset: number, value: string, length: number) {
  const bytes = new TextEncoder().encode(value)
  target.set(bytes.subarray(0, length), offset)
}

function writeTarOctal(target: Uint8Array, offset: number, value: number, length: number) {
  writeTarString(target, offset, `${value.toString(8).padStart(length - 1, "0")}\0`, length)
}

export function createUncompressedTar(files: TarFile[]) {
  const totalSize = files.reduce(
    (size, file) =>
      size + TAR_BLOCK_SIZE + Math.ceil(file.data.byteLength / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE,
    TAR_BLOCK_SIZE * 2,
  )
  const archive = new Uint8Array(totalSize)
  let offset = 0

  for (const file of files) {
    const header = new Uint8Array(TAR_BLOCK_SIZE)
    writeTarString(header, 0, file.name, 100)
    writeTarOctal(header, 100, 0o644, 8)
    writeTarOctal(header, 108, 0, 8)
    writeTarOctal(header, 116, 0, 8)
    writeTarOctal(header, 124, file.data.byteLength, 12)
    writeTarOctal(header, 136, Math.floor(Date.now() / 1000), 12)
    header.fill(0x20, 148, 156)
    header[156] = 0x30
    writeTarString(header, 257, "ustar\0", 6)
    writeTarString(header, 263, "00", 2)

    const checksum = header.reduce((sum, byte) => sum + byte, 0)
    writeTarString(header, 148, `${checksum.toString(8).padStart(6, "0")}\0 `, 8)

    archive.set(header, offset)
    offset += TAR_BLOCK_SIZE
    archive.set(file.data, offset)
    offset += Math.ceil(file.data.byteLength / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE
  }

  return archive
}
