"use client"

import { useState } from "react"
import { ExternalLink, MapPin, QrCode, Search } from "lucide-react"

import { rpcClient } from "@/orpc-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type FormValues = {
  alias: string
  googleMapsUrl: string
  count: string
}

type FormErrors = Partial<Record<keyof FormValues, string>> & { place?: string }
type PlaceCandidate = Awaited<ReturnType<typeof rpcClient.qr.resolvePlace>>["candidates"][number]
type CreatedQr = Awaited<ReturnType<typeof rpcClient.qr.batchCreateOrphan>>["items"][number]

const initialValues: FormValues = {
  alias: "QR code",
  googleMapsUrl: "",
  count: "1",
}

function validate(values: FormValues, selectedPlaceId: string): FormErrors {
  const errors: FormErrors = {}

  const alias = values.alias.trim()
  if (!alias) {
    errors.alias = "Alias is required"
  } else if (alias.length > 120) {
    errors.alias = "Alias must be at most 120 characters"
  }

  if (!values.googleMapsUrl.trim()) errors.googleMapsUrl = "Google Maps URL is required"
  if (!selectedPlaceId) errors.place = "Find and select a Google place before creating QR codes"

  const count = Number(values.count)
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    errors.count = "Batch size must be a whole number between 1 and 100"
  }

  return errors
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function QrBatchCreateForm() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const [createdItems, setCreatedItems] = useState<CreatedQr[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateValue(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, place: undefined }))
    setRequestError(null)
    if (name === "googleMapsUrl") {
      setResolveError(null)
      setCandidates([])
      setSelectedPlaceId("")
    }
  }

  async function resolvePlace() {
    const googleMapsUrl = values.googleMapsUrl.trim()
    if (!googleMapsUrl) {
      setErrors((current) => ({ ...current, googleMapsUrl: "Google Maps URL is required" }))
      return
    }

    setIsResolving(true)
    setResolveError(null)
    setCandidates([])
    setSelectedPlaceId("")

    try {
      const result = await rpcClient.qr.resolvePlace({ googleMapsUrl })
      setCandidates(result.candidates)
      setErrors((current) => ({ ...current, googleMapsUrl: undefined, place: undefined }))
      if (result.candidates.length === 1) setSelectedPlaceId(result.candidates[0]!.placeId)
    } catch (error) {
      setResolveError(
        getErrorMessage(error, "Could not find that place. Check the URL and try again."),
      )
    } finally {
      setIsResolving(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validate(values, selectedPlaceId)
    setErrors(nextErrors)
    setRequestError(null)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setCreatedItems([])

    try {
      const result = await rpcClient.qr.batchCreateOrphan({
        alias: values.alias.trim(),
        googleMapsUrl: values.googleMapsUrl.trim(),
        googlePlaceId: selectedPlaceId,
        count: Number(values.count),
      })
      setCreatedItems(result.items)
    } catch (error) {
      setRequestError(getErrorMessage(error, "Could not create the QR codes. Please try again."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch details</CardTitle>
          <CardDescription>
            Create up to 100 unclaimed QR records. An organization can claim them later. Image
            generation happens after the server returns the records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void submit(event)}>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.alias)}>
                <FieldLabel htmlFor="alias">Alias</FieldLabel>
                <Input
                  id="alias"
                  name="alias"
                  value={values.alias}
                  onChange={(event) => updateValue("alias", event.target.value)}
                  placeholder="Table tent"
                  aria-invalid={Boolean(errors.alias)}
                />
                {errors.alias && <FieldError>{errors.alias}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.googleMapsUrl)}>
                <FieldLabel htmlFor="googleMapsUrl">Google Maps URL</FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="googleMapsUrl"
                    name="googleMapsUrl"
                    type="url"
                    value={values.googleMapsUrl}
                    onChange={(event) => updateValue("googleMapsUrl", event.target.value)}
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
                  Paste a Google Maps URL. Google Places will find the Place ID for you; if there
                  are multiple matches, choose the correct place below.
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
                        name="googlePlace"
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
                          <MapPin className="size-4 text-primary" />
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

              <Field data-invalid={Boolean(errors.count)} className="sm:max-w-40 sm:self-end">
                <FieldLabel htmlFor="count">Batch size</FieldLabel>
                <Input
                  id="count"
                  name="count"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={values.count}
                  onChange={(event) => updateValue("count", event.target.value)}
                  aria-invalid={Boolean(errors.count)}
                />
                {errors.count && <FieldError>{errors.count}</FieldError>}
              </Field>

              {requestError && (
                <p role="alert" className="text-sm text-destructive">
                  {requestError}
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner /> : <QrCode />}
                  {isSubmitting ? "Creating QR codes..." : "Create QR codes"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {createdItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>QR records created</CardTitle>
            <CardDescription>
              {createdItems.length} unclaimed QR{" "}
              {createdItems.length === 1 ? "record is" : "records are"} ready for client-side image
              generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {createdItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">QR code {index + 1}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.alias}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <code className="rounded bg-muted px-2 py-1 text-xs">{item.slug}</code>
                    <a
                      href={`/r/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Open redirect
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              QR image generation is intentionally left for the client-side follow-up step.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
