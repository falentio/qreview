export type QrRedirectedEvent = {
  type: "qr.redirected"
  qrCodeId: string
  occurredAt: Date
}

export type QrEventListener = (event: QrRedirectedEvent) => Promise<void> | void

export type WaitUntil = (promise: Promise<unknown>) => void
