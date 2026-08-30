"use client"

import { useEffect, useRef, useState } from "react"
import {
  Archive,
  Download,
  ExternalLink,
  FileImage,
  MapPin,
  QrCode,
  RefreshCw,
  RotateCcw,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { renderGoogleReviewTemplate } from "@/lib/qr-template"
import { getErrorMessage } from "@/lib/utils"
import { rpcClient } from "@/orpc-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type QrItem = Awaited<ReturnType<typeof rpcClient.qr.list>>["items"][number]
type TemplateState = { slug: string } | null
type ArchiveTarget = { item: QrItem; organizationId: string } | null
type RestoreTarget = { item: QrItem; organizationId: string } | null

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function formatExpiry(value: string | null) {
  if (!value) return "Never"
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() - 1)
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date)
}

export function QrCodeList({ view = "active" }: { view?: "active" | "archived" }) {
  const isArchivedView = view === "archived"
  const {
    data: organizations,
    error: organizationsError,
    isPending: isOrganizationsPending,
  } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const selectedOrganization = activeOrganization ?? organizations?.[0]
  const organizationId = selectedOrganization?.id
  const [items, setItems] = useState<QrItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [templateState, setTemplateState] = useState<TemplateState>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const requestRef = useRef(0)

  function redirectUrl(slug: string) {
    return new URL(`/r/${slug}`, window.location.origin).toString()
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function createTemplate(slug: string) {
    setTemplateState({ slug })
    setTemplateError(null)

    try {
      const png = await renderGoogleReviewTemplate(redirectUrl(slug))
      downloadBlob(new Blob([png], { type: "image/png" }), `google-review-card-${slug}.png`)
    } catch (error) {
      setTemplateError(getErrorMessage(error, "Could not create the review card template."))
    } finally {
      setTemplateState(null)
    }
  }

  function openArchiveDialog(item: QrItem) {
    if (!organizationId) return
    setArchiveError(null)
    setArchiveTarget({ item, organizationId })
  }

  function handleArchiveDialogChange(open: boolean) {
    if (open || isArchiving) return
    setArchiveTarget(null)
    setArchiveError(null)
  }

  async function archiveQr() {
    if (!archiveTarget) return

    setIsArchiving(true)
    setArchiveError(null)
    try {
      await rpcClient.qr.archive({
        organizationId: archiveTarget.organizationId,
        id: archiveTarget.item.id,
      })
      setItems((current) => current.filter((item) => item.id !== archiveTarget.item.id))
      setArchiveTarget(null)
    } catch (error) {
      setArchiveError(getErrorMessage(error, "Could not archive this QR code. Please try again."))
    } finally {
      setIsArchiving(false)
    }
  }

  function openRestoreDialog(item: QrItem) {
    if (!organizationId) return
    setRestoreError(null)
    setRestoreTarget({ item, organizationId })
  }

  function handleRestoreDialogChange(open: boolean) {
    if (open || isRestoring) return
    setRestoreTarget(null)
    setRestoreError(null)
  }

  async function restoreQr() {
    if (!restoreTarget) return

    setIsRestoring(true)
    setRestoreError(null)
    try {
      await rpcClient.qr.restore({
        organizationId: restoreTarget.organizationId,
        id: restoreTarget.item.id,
      })
      setItems((current) => current.filter((item) => item.id !== restoreTarget.item.id))
      setRestoreTarget(null)
    } catch (error) {
      setRestoreError(getErrorMessage(error, "Could not restore this QR code. Please try again."))
    } finally {
      setIsRestoring(false)
    }
  }

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    let disposed = false

    if (!organizationId) {
      setItems([])
      setRequestError(
        organizationsError
          ? getErrorMessage(organizationsError, "Could not load your businesses.")
          : null,
      )
      setIsLoading(isOrganizationsPending)
      return () => {
        disposed = true
      }
    }

    setIsLoading(true)
    setRequestError(null)

    void rpcClient.qr
      .list({ organizationId, includeArchived: isArchivedView })
      .then((result) => {
        if (!disposed && requestId === requestRef.current) {
          setItems(
            result.items.filter((item) =>
              isArchivedView ? item.deletedAt !== null : item.deletedAt === null,
            ),
          )
        }
      })
      .catch((error: unknown) => {
        if (!disposed && requestId === requestRef.current) {
          setItems([])
          setRequestError(getErrorMessage(error, "Could not load QR codes. Please try again."))
        }
      })
      .finally(() => {
        if (!disposed && requestId === requestRef.current) setIsLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [isArchivedView, isOrganizationsPending, organizationId, organizationsError, reloadToken])

  const showOrganizationLoading = isOrganizationsPending && !selectedOrganization
  const showEmpty =
    !isLoading && !requestError && items.length === 0 && Boolean(selectedOrganization)

  return (
    <>
      <Card>
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{isArchivedView ? "Archived QR codes" : "Your QR codes"}</CardTitle>
            <CardDescription>
              {selectedOrganization
                ? isArchivedView
                  ? `Archived QR codes from ${selectedOrganization.name}.`
                  : `QR codes assigned to ${selectedOrganization.name}.`
                : "Select a business to load its QR codes."}
            </CardDescription>
          </div>
          {isArchivedView ? (
            <a
              href="/app/qr-codes"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              View active QR codes
            </a>
          ) : (
            <a
              href="/app/qr-codes/adopt"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <QrCode className="mr-2 size-4" aria-hidden="true" />
              Adopt a QR code
            </a>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {showOrganizationLoading || isLoading ? (
            <div className="flex flex-col divide-y" aria-label="Loading QR codes">
              {["first", "second", "third"].map((row) => (
                <div key={row} className="flex animate-pulse items-center gap-4 px-4 py-5 md:px-6">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                  <div className="ml-auto h-4 w-24 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : requestError ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p role="alert" className="text-sm text-destructive">
                {requestError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            </div>
          ) : showEmpty ? (
            <Empty className="min-h-64 rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <QrCode aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {isArchivedView ? "No archived QR codes" : "No QR codes yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {isArchivedView
                    ? "Archived QR codes will appear here until they are restored."
                    : "Adopt a QR code from your business kit to make it available in this workspace."}
                </EmptyDescription>
              </EmptyHeader>
              {!isArchivedView && (
                <a
                  href="/app/qr-codes/adopt"
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  Adopt a QR code
                </a>
              )}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56 px-4 md:px-6">QR code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-64">Destination</TableHead>
                  <TableHead>{isArchivedView ? "Archived" : "Added"}</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isExpired =
                    item.expiresAt !== null && Date.now() >= new Date(item.expiresAt).getTime()
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="px-4 md:px-6">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <QrCode className="size-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.alias}</p>
                            <code className="text-xs text-muted-foreground">{item.slug}</code>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isArchivedView ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : (
                          <Badge
                            variant={
                              isExpired
                                ? "destructive"
                                : item.configurationState === "active"
                                  ? "default"
                                  : "outline"
                            }
                          >
                            {isExpired
                              ? "Expired"
                              : item.configurationState === "active"
                                ? "Active"
                                : "Needs setup"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal">
                        {item.rawGoogleMapsUrl ? (
                          <a
                            href={item.rawGoogleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-2 text-sm hover:text-primary"
                          >
                            <MapPin
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                              aria-hidden="true"
                            />
                            <span className="line-clamp-2 break-all">{item.rawGoogleMapsUrl}</span>
                            <ExternalLink
                              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(isArchivedView ? item.deletedAt! : item.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatExpiry(item.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isArchivedView ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openRestoreDialog(item)}
                            disabled={isRestoring}
                          >
                            <RotateCcw />
                            Restore
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void createTemplate(item.slug)}
                              disabled={templateState !== null}
                            >
                              {templateState?.slug === item.slug ? (
                                <Download className="animate-pulse" />
                              ) : (
                                <FileImage />
                              )}
                              {templateState?.slug === item.slug
                                ? "Creating..."
                                : "Create template"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openArchiveDialog(item)}
                              disabled={templateState !== null}
                              className="text-destructive hover:text-destructive"
                            >
                              <Archive />
                              Archive
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {templateError && (
            <p role="alert" className="px-4 pb-4 text-sm text-destructive md:px-6">
              {templateError}
            </p>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={archiveTarget !== null} onOpenChange={handleArchiveDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Archive aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Archive this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{archiveTarget?.item.alias}</strong> from the active QR list
              and stop its public redirect. The printed QR image and slug will be kept so an
              organization admin can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveTarget && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Slug</span>{" "}
              <code>{archiveTarget.item.slug}</code>
            </div>
          )}
          {archiveError && (
            <p role="alert" className="text-sm text-destructive">
              {archiveError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void archiveQr()}
              disabled={isArchiving}
            >
              {isArchiving ? <RefreshCw className="animate-spin" /> : <Archive />}
              {isArchiving ? "Archiving..." : "Archive QR code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restoreTarget !== null} onOpenChange={handleRestoreDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <RotateCcw aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Restore this QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return <strong>{restoreTarget?.item.alias}</strong> to the active QR list.
              Its existing destination and slug will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreTarget && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Slug</span>{" "}
              <code>{restoreTarget.item.slug}</code>
            </div>
          )}
          {restoreError && (
            <p role="alert" className="text-sm text-destructive">
              {restoreError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restoreQr()} disabled={isRestoring}>
              {isRestoring ? <RefreshCw className="animate-spin" /> : <RotateCcw />}
              {isRestoring ? "Restoring..." : "Restore QR code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
