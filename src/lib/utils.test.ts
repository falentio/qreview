import { describe, expect, it } from "vite-plus/test"

import {
  createUncompressedTar,
  dateInputToExpiry,
  expiryToDateInput,
  getErrorMessage,
} from "@/lib/utils"

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

describe("QR expiry date helpers", () => {
  it("expires at the start of the next UTC day", () => {
    expect(dateInputToExpiry("2030-01-01")).toBe("2030-01-02T00:00:00.000Z")
    expect(expiryToDateInput("2030-01-02T00:00:00.000Z")).toBe("2030-01-01")
  })

  it("treats an empty date as never expiring", () => {
    expect(dateInputToExpiry("")).toBeNull()
    expect(expiryToDateInput(null)).toBe("")
  })
})

describe("getErrorMessage", () => {
  it("returns messages from known client-safe errors", () => {
    const error = Object.assign(new Error("Akses ditolak."), { code: "FORBIDDEN" })

    expect(getErrorMessage(error, "Coba lagi.")).toBe("Akses ditolak.")
  })

  it("supports structured client errors returned by Better Auth", () => {
    expect(
      getErrorMessage(
        { code: "INVALID_EMAIL_OR_PASSWORD", message: "Email atau kata sandi salah." },
        "Coba lagi.",
      ),
    ).toBe("Email atau kata sandi salah.")
  })

  it("hides messages from unknown errors", () => {
    expect(getErrorMessage(new Error("database password leaked"), "Coba lagi.")).toBe("Coba lagi.")
  })
})
