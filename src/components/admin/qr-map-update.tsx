"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import QrScanner from "qr-scanner"
import { CheckCircle2, MapPin, ScanLine, Search, Upload } from "lucide-react"

import { QrCodeCamera } from "@/components/qr-code-camera"
import { rpcClient } from "@/orpc-client"
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
import { dateInputToExpiry, expiryToDateInput, getErrorMessage } from "@/lib/utils"

type DialogStep = "scan" | "edit" | "success"
type UpdateKind = "map" | "expiration"
type PlaceCandidate = Awaited<ReturnType<typeof rpcClient.qr.resolvePlace>>["candidates"][number]
type UpdatedQr = Awaited<ReturnType<typeof rpcClient.qr.updateMapBySlug>>
type FormErrors = { googleMapsUrl?: string; place?: string; expiresOn?: string }

export function QrMapUpdate() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>("scan")
  const [manualSlug, setManualSlug] = useState("")
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [slug, setSlug] = useState("")
  const [googleMapsUrl, setGoogleMapsUrl] = useState("")
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState("")
  const [expiresOn, setExpiresOn] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAction, setPendingAction] = useState<UpdateKind | null>(null)
  const [updatedQr, setUpdatedQr] = useState<UpdatedQr | null>(null)
  const [updateKind, setUpdateKind] = useState<UpdateKind>("map")
  const resolveRequestRef = useRef(0)
  const verifyRequestRef = useRef(0)
  const verifyInFlightRef = useRef(false)
  const updateRequestRef = useRef(0)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    updateRequestRef.current += 1
    verifyRequestRef.current += 1
    verifyInFlightRef.current = false
    resolveRequestRef.current += 1
    setStep("scan")
    setManualSlug("")
    setScanError(null)
    setCameraError(null)
    setIsVerifying(false)
    setIsUploading(false)
    setSlug("")
    setGoogleMapsUrl("")
    setCandidates([])
    setSelectedPlaceId("")
    setExpiresOn("")
    setErrors({})
    setResolveError(null)
    setRequestError(null)
    setIsResolving(false)
    setIsSubmitting(false)
    setPendingAction(null)
    setUpdatedQr(null)
    setUpdateKind("map")
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

  async function handleScan(value: string) {
    if (verifyInFlightRef.current) return
    const nextSlug = getSlugFromQrValue(value)
    if (!nextSlug) {
      setScanError(
        "That QR code is not a valid QR code from this app. Scan a code with a /r/{slug} link.",
      )
      return
    }

    setSlug(nextSlug)
    setScanError(null)
    setCameraError(null)
    setIsVerifying(true)
    verifyInFlightRef.current = true
    const requestId = verifyRequestRef.current + 1
    verifyRequestRef.current = requestId

    try {
      const verified = await rpcClient.qr.verifyBySlug({ slug: nextSlug })
      if (requestId !== verifyRequestRef.current) return

      setIsVerifying(false)
      setGoogleMapsUrl("")
      setCandidates([])
      setSelectedPlaceId("")
      setExpiresOn(expiryToDateInput(verified.expiresAt))
      setErrors({})
      setResolveError(null)
      setRequestError(null)
      setStep("edit")
    } catch (error) {
      if (requestId !== verifyRequestRef.current) return
      setScanError(
        getErrorMessage(error, "This QR code was not found. Scan an active QR code from this app."),
      )
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
      setScanError("Enter a valid 10-character slug or the QR code URL, such as /r/abc123def4.")
      return
    }
    void handleScan(nextSlug)
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
      await handleScan(result.data)
    } catch (error) {
      setScanError(getErrorMessage(error, "Could not read a QR code from that image."))
    } finally {
      setIsUploading(false)
    }
  }

  function updateMapUrl(value: string) {
    resolveRequestRef.current += 1
    setGoogleMapsUrl(value)
    setErrors((current) => ({ ...current, googleMapsUrl: undefined, place: undefined }))
    setResolveError(null)
    setRequestError(null)
    setCandidates([])
    setSelectedPlaceId("")
    setIsResolving(false)
  }

  async function resolvePlace() {
    const trimmedUrl = googleMapsUrl.trim()
    if (!trimmedUrl) {
      setErrors((current) => ({ ...current, googleMapsUrl: "Google Maps URL is required" }))
      return
    }

    const requestId = resolveRequestRef.current + 1
    resolveRequestRef.current = requestId
    setIsResolving(true)
    setResolveError(null)
    setRequestError(null)
    setCandidates([])
    setSelectedPlaceId("")

    try {
      const result = await rpcClient.qr.resolvePlace({ googleMapsUrl: trimmedUrl })
      if (requestId !== resolveRequestRef.current) return
      setCandidates(result.candidates)
      setErrors((current) => ({ ...current, googleMapsUrl: undefined, place: undefined }))
      if (result.candidates.length === 1) setSelectedPlaceId(result.candidates[0]!.placeId)
    } catch (error) {
      if (requestId !== resolveRequestRef.current) return
      setResolveError(
        getErrorMessage(error, "Could not find that place. Check the URL and try again."),
      )
    } finally {
      if (requestId === resolveRequestRef.current) setIsResolving(false)
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FormErrors = {}
    if (!googleMapsUrl.trim()) nextErrors.googleMapsUrl = "Google Maps URL is required"
    if (!selectedPlaceId) {
      nextErrors.place = "Find and select a Google place before updating this QR code"
    }
    setErrors(nextErrors)
    setRequestError(null)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setPendingAction("map")
    const requestId = updateRequestRef.current + 1
    updateRequestRef.current = requestId
    try {
      const result = await rpcClient.qr.updateMapBySlug({
        slug,
        googleMapsUrl: googleMapsUrl.trim(),
        googlePlaceId: selectedPlaceId,
      })
      if (requestId !== updateRequestRef.current) return
      setUpdatedQr(result)
      setUpdateKind("map")
      setStep("success")
    } catch (error) {
      if (requestId !== updateRequestRef.current) return
      setRequestError(getErrorMessage(error, "Could not update this QR code. Please try again."))
    } finally {
      if (requestId === updateRequestRef.current) {
        setIsSubmitting(false)
        setPendingAction(null)
      }
    }
  }

  async function submitExpiration() {
    const nextErrors: FormErrors = {}
    const expiration = dateInputToExpiry(expiresOn)
    if (expiresOn && !expiration) nextErrors.expiresOn = "Enter a valid expiry date"
    setErrors((current) => ({ ...current, expiresOn: nextErrors.expiresOn }))
    setRequestError(null)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setPendingAction("expiration")
    const requestId = updateRequestRef.current + 1
    updateRequestRef.current = requestId
    try {
      const result = await rpcClient.qr.setExpirationBySlug({ slug, expiresAt: expiration })
      if (requestId !== updateRequestRef.current) return
      setUpdatedQr(result)
      setUpdateKind("expiration")
      setStep("success")
    } catch (error) {
      if (requestId !== updateRequestRef.current) return
      setRequestError(getErrorMessage(error, "Could not update this QR code. Please try again."))
    } finally {
      if (requestId === updateRequestRef.current) {
        setIsSubmitting(false)
        setPendingAction(null)
      }
    }
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
        aria-label="Upload a QR code image"
      />
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="size-4 text-primary" aria-hidden="true" />
            Update a QR code
          </CardTitle>
          <CardDescription>
            Scan a printed QR code to replace its Google Maps destination or expiry date. This tool
            is available to global admins only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">Change where or how long a code works</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The QR image and slug stay the same.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" onClick={openScanner} className="w-full sm:w-auto">
              <ScanLine aria-hidden="true" />
              Use camera
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openUploader}
              className="w-full sm:w-auto"
            >
              <Upload aria-hidden="true" />
              Upload QR image
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg overflow-y-auto">
          {step === "scan" && (
            <>
              <DialogHeader>
                <DialogTitle>Scan a QR code</DialogTitle>
                <DialogDescription>
                  Scan the QR code printed for this app. Once the slug is recognized, you can update
                  its map destination or expiry date.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <QrCodeCamera
                  active={open && !isVerifying}
                  onScan={(value) => void handleScan(value)}
                  onError={setCameraError}
                />
                {isVerifying && (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    <Spinner />
                    Checking QR code...
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
                  {isUploading ? "Reading QR image..." : "Upload a QR image instead"}
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>or enter the slug</span>
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
                    aria-label="QR code slug"
                  />
                  <Button type="submit" variant="outline" className="sm:w-auto">
                    Use slug
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">
                  Camera access requires a secure connection and browser permission.
                </p>
              </div>
            </>
          )}

          {step === "edit" && (
            <>
              <DialogHeader>
                <DialogTitle>Update QR code</DialogTitle>
                <DialogDescription>
                  QR code <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{slug}</code> is
                  ready. Change its destination or expiry date.
                </DialogDescription>
              </DialogHeader>
              <form className="flex flex-col gap-5" onSubmit={(event) => void submitUpdate(event)}>
                <FieldGroup>
                  <Field data-invalid={Boolean(errors.googleMapsUrl)}>
                    <FieldLabel htmlFor="update-google-maps-url">Google Maps URL</FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="update-google-maps-url"
                        type="url"
                        value={googleMapsUrl}
                        onChange={(event) => updateMapUrl(event.target.value)}
                        placeholder="https://www.google.com/maps/search/?api=1&query=..."
                        aria-invalid={Boolean(errors.googleMapsUrl)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void resolvePlace()}
                        disabled={isResolving}
                      >
                        {isResolving ? <Spinner /> : <Search />}
                        {isResolving ? "Finding place..." : "Find place"}
                      </Button>
                    </div>
                    {errors.googleMapsUrl && <FieldError>{errors.googleMapsUrl}</FieldError>}
                    <FieldDescription>
                      Google Places will find the Place ID for you. If there are multiple matches,
                      choose the correct place below.
                    </FieldDescription>
                    {resolveError && <FieldError>{resolveError}</FieldError>}
                  </Field>

                  {candidates.length > 0 && (
                    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
                      <legend className="px-1 text-sm font-medium">Select a Google place</legend>
                      {candidates.map((candidate) => (
                        <label
                          key={candidate.placeId}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition-colors hover:bg-muted has-checked:border-primary/30 has-checked:bg-primary/5"
                        >
                          <input
                            type="radio"
                            name="update-google-place"
                            value={candidate.placeId}
                            checked={selectedPlaceId === candidate.placeId}
                            onChange={() => {
                              setSelectedPlaceId(candidate.placeId)
                              setErrors((current) => ({ ...current, place: undefined }))
                            }}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <MapPin className="size-4 text-primary" aria-hidden="true" />
                              {candidate.name}
                            </span>
                            {candidate.address && (
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {candidate.address}
                              </span>
                            )}
                            <code className="mt-1 block truncate text-xs text-muted-foreground">
                              {candidate.placeId}
                            </code>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {errors.place && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.place}
                    </p>
                  )}
                  <Field data-invalid={Boolean(errors.expiresOn)}>
                    <FieldLabel htmlFor="update-expires-on">Expiry date</FieldLabel>
                    <Input
                      id="update-expires-on"
                      type="date"
                      value={expiresOn}
                      onChange={(event) => {
                        setExpiresOn(event.target.value)
                        setErrors((current) => ({ ...current, expiresOn: undefined }))
                        setRequestError(null)
                      }}
                      aria-invalid={Boolean(errors.expiresOn)}
                    />
                    {errors.expiresOn ? (
                      <FieldError>{errors.expiresOn}</FieldError>
                    ) : (
                      <FieldDescription>
                        Leave blank for a QR code that never expires. Expiry begins at the start of
                        the next UTC day.
                      </FieldDescription>
                    )}
                  </Field>
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
                    disabled={isSubmitting || isResolving}
                  >
                    Scan a different code
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void submitExpiration()}
                      disabled={isSubmitting || isResolving}
                    >
                      {pendingAction === "expiration" ? <Spinner /> : <CheckCircle2 />}
                      {pendingAction === "expiration" ? "Saving..." : "Save expiry"}
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isResolving}>
                      {pendingAction === "map" ? <Spinner /> : <MapPin />}
                      {pendingAction === "map" ? "Updating..." : "Update map destination"}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}

          {step === "success" && updatedQr && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </div>
                <DialogTitle>
                  {updateKind === "expiration" ? "Expiry updated" : "Map destination updated"}
                </DialogTitle>
                <DialogDescription>
                  QR code{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{updatedQr.slug}</code>{" "}
                  {updateKind === "expiration"
                    ? " now has the updated expiry setting."
                    : " now points to the selected Google place. The printed QR code does not need to be replaced."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                {updateKind === "map" && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Place ID</span>
                      <code className="max-w-[65%] truncate text-xs">
                        {updatedQr.googlePlaceId}
                      </code>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Maps URL</span>
                      <span className="max-w-[65%] truncate text-right text-xs">
                        {updatedQr.rawGoogleMapsUrl}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Expiry date</span>
                  <span>{expiryToDateInput(updatedQr.expiresAt) || "Never"}</span>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={openScanner}>
                  <ScanLine aria-hidden="true" />
                  Scan another QR code
                </Button>
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
