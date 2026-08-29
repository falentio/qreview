import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
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
