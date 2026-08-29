"use client"

import { useEffect, useRef } from "react"
import QrScanner from "qr-scanner"

import { getErrorMessage } from "@/lib/utils"

type QrCodeCameraProps = {
  active: boolean
  onScan: (value: string) => void
  onError: (message: string) => void
}

export function QrCodeCamera({ active, onScan, onError }: QrCodeCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onScanRef.current = onScan
    onErrorRef.current = onError
  }, [onError, onScan])

  useEffect(() => {
    const video = videoRef.current
    if (!active || !video) return

    let disposed = false
    const scanner = new QrScanner(video, (result) => onScanRef.current(result.data), {
      preferredCamera: "environment",
      maxScansPerSecond: 10,
      returnDetailedScanResult: true,
      onDecodeError: () => undefined,
    })

    void scanner.start().catch((error: unknown) => {
      if (!disposed) {
        onErrorRef.current(
          getErrorMessage(
            error,
            "Could not access the camera. Check browser permissions or enter the slug below.",
          ),
        )
      }
    })

    return () => {
      disposed = true
      scanner.destroy()
    }
  }, [active])

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950">
      <video
        ref={videoRef}
        className="size-full object-cover"
        muted
        playsInline
        aria-label="QR code camera preview"
      />
      <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgb(2_6_23/0.45)]" />
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white drop-shadow">
        Align the QR code inside the frame
      </p>
    </div>
  )
}
