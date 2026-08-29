import { describe, expect, it } from "vite-plus/test"

import { createUncompressedTar } from "@/lib/utils"

const decoder = new TextDecoder()

function readOctal(bytes: Uint8Array, offset: number, length: number) {
  return Number.parseInt(
    decoder
      .decode(bytes.slice(offset, offset + length))
      .replace(/\0.*$/, "")
      .trim(),
    8,
  )
}

describe("createUncompressedTar", () => {
  it("writes binary files as uncompressed USTAR records", () => {
    const archive = createUncompressedTar([
      { name: "first.png", data: new Uint8Array([1, 2, 3]) },
      { name: "second.png", data: new Uint8Array([4, 5]) },
    ])

    expect(archive.byteLength).toBe(3 * 1024)
    expect(decoder.decode(archive.slice(0, 9))).toBe("first.png")
    expect(decoder.decode(archive.slice(257, 263))).toBe("ustar\0")
    expect(readOctal(archive, 124, 12)).toBe(3)
    expect(archive.slice(512, 515)).toEqual(new Uint8Array([1, 2, 3]))

    const secondHeaderOffset = 1024
    expect(decoder.decode(archive.slice(secondHeaderOffset, secondHeaderOffset + 10))).toBe(
      "second.png",
    )
    expect(readOctal(archive, secondHeaderOffset + 124, 12)).toBe(2)
    expect(archive.slice(secondHeaderOffset + 512, secondHeaderOffset + 514)).toEqual(
      new Uint8Array([4, 5]),
    )
    expect(archive.slice(archive.byteLength - 1024).every((byte) => byte === 0)).toBe(true)
  })
})
