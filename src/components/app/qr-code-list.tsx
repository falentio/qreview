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
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value))
}

function formatExpiry(value: string | null) {
  if (!value) return "Tidak pernah"
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() - 1)
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(date)
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
      setTemplateError(getErrorMessage(error, "Template kartu ulasan tidak dapat dibuat."))
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
      setArchiveError(
        getErrorMessage(error, "Kode QR ini tidak dapat diarsipkan. Silakan coba lagi."),
      )
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
      setRestoreError(
        getErrorMessage(error, "Kode QR ini tidak dapat dipulihkan. Silakan coba lagi."),
      )
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
          ? getErrorMessage(organizationsError, "Bisnis Anda tidak dapat dimuat.")
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
          setRequestError(getErrorMessage(error, "Kode QR tidak dapat dimuat. Silakan coba lagi."))
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
            <CardTitle>{isArchivedView ? "Kode QR yang diarsipkan" : "Kode QR Anda"}</CardTitle>
            <CardDescription>
              {selectedOrganization
                ? isArchivedView
                  ? `Kode QR yang diarsipkan dari ${selectedOrganization.name}.`
                  : `Kode QR yang ditetapkan ke ${selectedOrganization.name}.`
                : "Pilih bisnis untuk memuat kode QR-nya."}
            </CardDescription>
          </div>
          {isArchivedView ? (
            <a
              href="/app/qr-codes"
              data-astro-prefetch="viewport"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Lihat kode QR aktif
            </a>
          ) : (
            <a
              href="/app/qr-codes/adopt"
              data-astro-prefetch="viewport"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <QrCode className="mr-2 size-4" aria-hidden="true" />
              Klaim kode QR
            </a>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {showOrganizationLoading || isLoading ? (
            <div className="flex flex-col divide-y" aria-label="Memuat kode QR">
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
                Coba lagi
              </Button>
            </div>
          ) : showEmpty ? (
            <Empty className="min-h-64 rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <QrCode aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {isArchivedView ? "Tidak ada kode QR yang diarsipkan" : "Belum ada kode QR"}
                </EmptyTitle>
                <EmptyDescription>
                  {isArchivedView
                    ? "Kode QR yang diarsipkan akan muncul di sini sampai dipulihkan."
                    : "Klaim kode QR dari kit bisnis Anda agar tersedia di ruang kerja ini."}
                </EmptyDescription>
              </EmptyHeader>
              {!isArchivedView && (
                <a
                  href="/app/qr-codes/adopt"
                  data-astro-prefetch="viewport"
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  Klaim kode QR
                </a>
              )}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56 px-4 md:px-6">Kode QR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-64">Tujuan</TableHead>
                  <TableHead>{isArchivedView ? "Diarsipkan" : "Ditambahkan"}</TableHead>
                  <TableHead>Kedaluwarsa</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
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
                          <Badge variant="outline">Diarsipkan</Badge>
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
                              ? "Kedaluwarsa"
                              : item.configurationState === "active"
                                ? "Aktif"
                                : "Perlu disiapkan"}
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
                          <span className="text-sm text-muted-foreground">Belum dikonfigurasi</span>
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
                            Pulihkan
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
                              {templateState?.slug === item.slug ? "Membuat..." : "Buat template"}
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
                              Arsipkan
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
            <AlertDialogTitle>Arsipkan kode QR ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Ini akan menghapus <strong>{archiveTarget?.item.alias}</strong> dari daftar QR aktif
              dan menghentikan pengalihannya secara publik. Gambar QR yang dicetak dan slug akan
              tetap disimpan agar admin organisasi dapat memulihkannya nanti.
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
            <AlertDialogCancel disabled={isArchiving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void archiveQr()}
              disabled={isArchiving}
            >
              {isArchiving ? <RefreshCw className="animate-spin" /> : <Archive />}
              {isArchiving ? "Mengarsipkan..." : "Arsipkan kode QR"}
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
            <AlertDialogTitle>Pulihkan kode QR ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Ini akan mengembalikan <strong>{restoreTarget?.item.alias}</strong> ke daftar QR
              aktif. Tujuan dan slug yang ada akan tetap digunakan.
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
            <AlertDialogCancel disabled={isRestoring}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restoreQr()} disabled={isRestoring}>
              {isRestoring ? <RefreshCw className="animate-spin" /> : <RotateCcw />}
              {isRestoring ? "Memulihkan..." : "Pulihkan kode QR"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
