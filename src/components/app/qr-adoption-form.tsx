"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import QrScanner from "qr-scanner"
import { CheckCircle2, QrCode, ScanLine, Upload } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { getSlugFromQrValue } from "@/lib/qr-code"
import { getErrorMessage } from "@/lib/utils"
import { rpcClient } from "@/orpc-client"
import { QrCodeCamera } from "@/components/qr-code-camera"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type DialogStep = "scan" | "success"
type ClaimedQr = Awaited<ReturnType<typeof rpcClient.qr.claim>>

export function QrAdoptionForm() {
  const { data: organizations } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const selectedOrganization = activeOrganization ?? organizations?.[0]
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>("scan")
  const [manualSlug, setManualSlug] = useState("")
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimedQr, setClaimedQr] = useState<ClaimedQr | null>(null)
  const claimRequestRef = useRef(0)
  const claimInFlightRef = useRef(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    claimRequestRef.current += 1
    claimInFlightRef.current = false
    setStep("scan")
    setManualSlug("")
    setScanError(null)
    setCameraError(null)
    setIsUploading(false)
    setIsClaiming(false)
    setClaimedQr(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetState()
  }

  function openScanner() {
    resetState()
    setOpen(true)
  }

  function openUploader() {
    resetState()
    setOpen(true)
    uploadInputRef.current?.click()
  }

  async function adoptFromQrValue(value: string) {
    if (claimInFlightRef.current) return

    const nextSlug = getSlugFromQrValue(value)
    if (!nextSlug) {
      setScanError(
        "Kode QR tersebut tidak valid untuk aplikasi ini. Pindai kode dengan tautan /r/{slug} atau masukkan slug di bawah.",
      )
      return
    }

    if (!selectedOrganization) {
      setScanError("Pilih bisnis di sidebar sebelum mengklaim kode QR.")
      return
    }

    setScanError(null)
    setCameraError(null)
    setIsClaiming(true)
    claimInFlightRef.current = true
    const requestId = claimRequestRef.current + 1
    claimRequestRef.current = requestId

    try {
      const result = await rpcClient.qr.claim({
        organizationId: selectedOrganization.id,
        slug: nextSlug,
      })
      if (requestId !== claimRequestRef.current) return

      setClaimedQr(result)
      setStep("success")
    } catch (error) {
      if (requestId !== claimRequestRef.current) return
      setScanError(getErrorMessage(error, "Kode QR ini tidak dapat diklaim. Silakan coba lagi."))
    } finally {
      if (requestId === claimRequestRef.current) {
        claimInFlightRef.current = false
        setIsClaiming(false)
      }
    }
  }

  function submitManualSlug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void adoptFromQrValue(manualSlug)
  }

  async function uploadQrImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setScanError(null)
    setCameraError(null)
    setIsUploading(true)
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      await adoptFromQrValue(result.data)
    } catch (error) {
      setScanError(getErrorMessage(error, "Kode QR tidak dapat dibaca dari gambar tersebut."))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void uploadQrImage(event)}
        aria-label="Unggah gambar kode QR"
      />
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-4 text-primary" aria-hidden="true" />
            Klaim kode QR
          </CardTitle>
          <CardDescription>
            Pindai kode QR tercetak atau unggah gambarnya untuk menetapkannya ke bisnis yang
            dipilih. Pemilik dan admin bisnis dapat mengklaim kode yang belum diklaim.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {selectedOrganization
                  ? `Tetapkan kode ke ${selectedOrganization.name}`
                  : "Pilih bisnis terlebih dahulu"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kode akan tersedia di ruang kerja bisnis ini.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              onClick={openScanner}
              disabled={!selectedOrganization}
              className="w-full sm:w-auto"
            >
              <ScanLine aria-hidden="true" />
              Gunakan kamera
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openUploader}
              disabled={!selectedOrganization}
              className="w-full sm:w-auto"
            >
              <Upload aria-hidden="true" />
              Unggah gambar QR
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg overflow-y-auto">
          {step === "scan" && (
            <>
              <DialogHeader>
                <DialogTitle>Klaim kode QR</DialogTitle>
                <DialogDescription>
                  Pindai kode QR yang dicetak untuk aplikasi ini. Kode harus belum diklaim sebelum
                  dapat ditetapkan ke bisnis Anda.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <QrCodeCamera
                  active={open && !isClaiming && Boolean(selectedOrganization)}
                  onScan={(value) => void adoptFromQrValue(value)}
                  onError={setCameraError}
                />
                {isClaiming && (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    <Spinner />
                    Mengklaim kode QR...
                  </p>
                )}
                {!selectedOrganization && (
                  <p role="alert" className="text-sm text-destructive">
                    Pilih bisnis di sidebar sebelum mengklaim kode QR.
                  </p>
                )}
                {cameraError && (
                  <p role="alert" className="text-sm text-destructive">
                    {cameraError}
                  </p>
                )}
                {scanError && (
                  <p role="alert" className="text-sm text-destructive">
                    {scanError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading || isClaiming || !selectedOrganization}
                  className="w-full"
                >
                  {isUploading ? <Spinner /> : <Upload />}
                  {isUploading ? "Membaca gambar QR..." : "Unggah gambar QR sebagai gantinya"}
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>atau masukkan slug</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitManualSlug}>
                  <Input
                    value={manualSlug}
                    onChange={(event) => {
                      setManualSlug(event.target.value)
                      setScanError(null)
                    }}
                    placeholder="abc123def4"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Slug kode QR"
                    disabled={isClaiming || !selectedOrganization}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="sm:w-auto"
                    disabled={isClaiming || !selectedOrganization}
                  >
                    Klaim dengan slug
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">
                  Akses kamera memerlukan koneksi aman dan izin browser.
                </p>
              </div>
            </>
          )}

          {step === "success" && claimedQr && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </div>
                <DialogTitle>Kode QR berhasil diklaim</DialogTitle>
                <DialogDescription>
                  Kode QR{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{claimedQr.slug}</code>{" "}
                  kini ditetapkan ke {selectedOrganization?.name ?? "bisnis Anda"}.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Slug</span>
                  <code>{claimedQr.slug}</code>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Konfigurasi</span>
                  <span>
                    {claimedQr.configurationState === "active" ? "Aktif" : "Belum lengkap"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={openScanner}>
                  <ScanLine aria-hidden="true" />
                  Klaim kode QR lain
                </Button>
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  Selesai
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
