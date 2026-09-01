"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import QrScanner from "qr-scanner"
import { Activity, CheckCircle2, DatabaseZap, ScanLine, Upload } from "lucide-react"

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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getSlugFromQrValue } from "@/lib/qr-code"
import { getErrorMessage } from "@/lib/utils"
import { rpcClient } from "@/orpc-client"

type Step = "scan" | "edit" | "success"
type VerifiedQr = Awaited<ReturnType<typeof rpcClient.qr.verifyBySlug>>
type FilledAnalytics = Awaited<ReturnType<typeof rpcClient.analytics.qr.fill>>

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_FILL_RANGE_MS = 30 * DAY_MS
const MAX_REDIRECT_ATTEMPTS = 1_000_000

function utcDateInput(offsetDays: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export function QrAnalyticsFillForm() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("scan")
  const [manualSlug, setManualSlug] = useState("")
  const [slug, setSlug] = useState("")
  const [verifiedQr, setVerifiedQr] = useState<VerifiedQr | null>(null)
  const [fromDate, setFromDate] = useState(() => utcDateInput(-7))
  const [toDate, setToDate] = useState(() => utcDateInput(-1))
  const [redirectAttempts, setRedirectAttempts] = useState("10")
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filledAnalytics, setFilledAnalytics] = useState<FilledAnalytics | null>(null)
  const verifyRequestRef = useRef(0)
  const fillRequestRef = useRef(0)
  const verifyInFlightRef = useRef(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    verifyRequestRef.current += 1
    fillRequestRef.current += 1
    verifyInFlightRef.current = false
    setStep("scan")
    setManualSlug("")
    setSlug("")
    setVerifiedQr(null)
    setFromDate(utcDateInput(-7))
    setToDate(utcDateInput(-1))
    setRedirectAttempts("10")
    setScanError(null)
    setCameraError(null)
    setRequestError(null)
    setValidationError(null)
    setIsVerifying(false)
    setIsUploading(false)
    setIsSubmitting(false)
    setFilledAnalytics(null)
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

  async function verifySlug(nextSlug: string) {
    if (verifyInFlightRef.current) return
    verifyInFlightRef.current = true
    const requestId = verifyRequestRef.current + 1
    verifyRequestRef.current = requestId
    setSlug(nextSlug)
    setScanError(null)
    setCameraError(null)
    setIsVerifying(true)
    setRequestError(null)

    try {
      const result = await rpcClient.qr.verifyBySlug({ slug: nextSlug })
      if (requestId !== verifyRequestRef.current) return
      setVerifiedQr(result)
      setStep("edit")
    } catch (error) {
      if (requestId !== verifyRequestRef.current) return
      setScanError(getErrorMessage(error, "Kode QR ini tidak ditemukan atau tidak aktif."))
    } finally {
      if (requestId === verifyRequestRef.current) {
        verifyInFlightRef.current = false
        setIsVerifying(false)
      }
    }
  }

  function submitManualSlug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSlug = getSlugFromQrValue(manualSlug)
    if (!nextSlug) {
      setScanError("Masukkan slug 10 karakter yang valid atau URL kode QR, seperti /r/abc123def4.")
      return
    }
    void verifySlug(nextSlug)
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
      const nextSlug = getSlugFromQrValue(result.data)
      if (!nextSlug) {
        setScanError("Gambar tersebut tidak berisi kode QR dari aplikasi ini.")
        return
      }
      await verifySlug(nextSlug)
    } catch (error) {
      setScanError(getErrorMessage(error, "Kode QR tidak dapat dibaca dari gambar tersebut."))
    } finally {
      setIsUploading(false)
    }
  }

  function submitFill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const from = new Date(`${fromDate}T00:00:00.000Z`)
    const to = new Date(`${toDate}T00:00:00.000Z`)
    const now = new Date()
    const currentHour = new Date(now)
    currentHour.setUTCMinutes(0, 0, 0)
    to.setUTCDate(to.getUTCDate() + 1)
    const count = Number(redirectAttempts)

    let error: string | null = null
    if (
      !fromDate ||
      !toDate ||
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime())
    ) {
      error = "Pilih tanggal mulai dan tanggal akhir yang valid."
    } else if (from >= to) {
      error = "Tanggal akhir harus sama dengan atau setelah tanggal mulai."
    } else if (to > currentHour) {
      error = "Isi data hanya sampai hari UTC yang telah selesai."
    } else if (to.getTime() - from.getTime() > MAX_FILL_RANGE_MS) {
      error = "Rentang pengisian tidak boleh lebih dari 30 hari."
    } else if (!Number.isInteger(count) || count < 0 || count > MAX_REDIRECT_ATTEMPTS) {
      error = "Upaya per jam harus berupa bilangan bulat antara 0 dan 1.000.000."
    }
    setValidationError(error)
    setRequestError(null)
    if (error || !verifiedQr) return

    setIsSubmitting(true)
    const requestId = fillRequestRef.current + 1
    fillRequestRef.current = requestId
    void rpcClient.analytics.qr
      .fill({
        slug,
        from: from.toISOString(),
        to: to.toISOString(),
        redirectAttempts: count,
      })
      .then((result) => {
        if (requestId !== fillRequestRef.current) return
        setFilledAnalytics(result)
        setStep("success")
      })
      .catch((error: unknown) => {
        if (requestId === fillRequestRef.current) {
          setRequestError(
            getErrorMessage(error, "Data analitik tidak dapat diisi. Silakan coba lagi."),
          )
        }
      })
      .finally(() => {
        if (requestId === fillRequestRef.current) setIsSubmitting(false)
      })
  }

  function backToScanner() {
    resetState()
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
            <DatabaseZap className="size-4 text-primary" aria-hidden="true" />
            Isi analitik QR
          </CardTitle>
          <CardDescription>
            Tambahkan data pengalihan per jam yang konsisten untuk kode QR saat menyiapkan atau
            menguji dasbor analitik. Alat ini hanya tersedia untuk admin global.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">Isi jam UTC yang telah selesai</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nilai per jam yang ada akan diganti.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" onClick={openScanner} className="w-full sm:w-auto">
              <ScanLine aria-hidden="true" />
              Gunakan kamera
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openUploader}
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
                <DialogTitle>Pilih kode QR</DialogTitle>
                <DialogDescription>
                  Pindai kode QR tercetak atau masukkan slug-nya. Kode harus sudah ada sebelum data
                  analitik dapat diisi.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <QrCodeCamera
                  active={open && !isVerifying}
                  onScan={(value) => {
                    const nextSlug = getSlugFromQrValue(value)
                    if (!nextSlug) {
                      setScanError("Kode QR tersebut tidak valid untuk aplikasi ini.")
                      return
                    }
                    void verifySlug(nextSlug)
                  }}
                  onError={setCameraError}
                />
                {isVerifying && (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    <Spinner />
                    Memeriksa kode QR...
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
                  disabled={isUploading || isVerifying}
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
                    disabled={isVerifying}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="sm:w-auto"
                    disabled={isVerifying}
                  >
                    Gunakan slug
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">
                  Akses kamera memerlukan koneksi aman dan izin browser.
                </p>
              </div>
            </>
          )}

          {step === "edit" && verifiedQr && (
            <>
              <DialogHeader>
                <DialogTitle>Isi data analitik</DialogTitle>
                <DialogDescription>
                  Kode QR{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{verifiedQr.slug}</code>{" "}
                  siap. Tetapkan satu nilai untuk setiap jam UTC yang telah selesai dalam rentang
                  ini.
                </DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-5" onSubmit={submitFill}>
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="analytics-fill-from">Tanggal mulai (UTC)</FieldLabel>
                      <Input
                        id="analytics-fill-from"
                        type="date"
                        value={fromDate}
                        max={utcDateInput(-1)}
                        onChange={(event) => setFromDate(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="analytics-fill-to">Tanggal akhir (UTC)</FieldLabel>
                      <Input
                        id="analytics-fill-to"
                        type="date"
                        value={toDate}
                        max={utcDateInput(-1)}
                        onChange={(event) => setToDate(event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="analytics-fill-attempts">
                      Upaya pengalihan per jam
                    </FieldLabel>
                    <Input
                      id="analytics-fill-attempts"
                      type="number"
                      min="0"
                      max={MAX_REDIRECT_ATTEMPTS}
                      step="1"
                      value={redirectAttempts}
                      onChange={(event) => setRedirectAttempts(event.target.value)}
                    />
                    <FieldDescription>
                      Setiap slot dalam rentang yang dipilih akan menerima nilai ini. Gunakan 0
                      untuk mengosongkan rentang.
                    </FieldDescription>
                  </Field>
                  {validationError && <FieldError>{validationError}</FieldError>}
                  {requestError && (
                    <p role="alert" className="text-sm text-destructive">
                      {requestError}
                    </p>
                  )}
                </FieldGroup>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={backToScanner}
                    disabled={isSubmitting}
                  >
                    Pilih QR lain
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner /> : <DatabaseZap />}
                    {isSubmitting ? "Mengisi analitik..." : "Isi analitik"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === "success" && filledAnalytics && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </div>
                <DialogTitle>Data analitik berhasil diisi</DialogTitle>
                <DialogDescription>
                  QR yang dipilih kini memiliki data yang konsisten untuk jam UTC yang telah
                  selesai.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">QR code</span>
                  <code>{slug}</code>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Slot terisi</span>
                  <span>{filledAnalytics.bucketsFilled.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Upaya per jam</span>
                  <span>{redirectAttempts}</span>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={openScanner}>
                  <ScanLine aria-hidden="true" />
                  Isi QR lain
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
