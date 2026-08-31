"use client"

import { useEffect, useRef, useState } from "react"
import { Activity, CalendarDays, ChartNoAxesCombined, QrCode, RefreshCw } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { authClient } from "@/lib/auth-client"
import { getErrorMessage } from "@/lib/utils"
import { rpcClient } from "@/orpc-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

type QrItem = Awaited<ReturnType<typeof rpcClient.qr.list>>["items"][number]
type AnalyticsItem = Awaited<
  ReturnType<typeof rpcClient.analytics.organization.hourly>
>["items"][number]
type Scope = string
type Preset = "24h" | "7d" | "30d" | "60d"
type DateRange = { from: string; to: string }

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const RETENTION_MS = 60 * DAY_MS

const chartConfig = {
  redirectAttempts: {
    label: "Redirect attempts",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

function floorUtcHour(value: Date): Date {
  const result = new Date(value)
  result.setUTCMinutes(0, 0, 0)
  return result
}

function ceilUtcHour(value: Date): Date {
  const result = floorUtcHour(value)
  if (result.getTime() < value.getTime()) result.setTime(result.getTime() + HOUR_MS)
  return result
}

function rangeForPreset(preset: Preset, now = new Date()): DateRange {
  const to = floorUtcHour(now)
  const from = new Date(to)
  if (preset === "24h") {
    from.setTime(to.getTime() - 24 * HOUR_MS)
  } else {
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 60
    from.setTime(to.getTime() - days * DAY_MS)
    if (days === 60) from.setTime(ceilUtcHour(new Date(now.getTime() - RETENTION_MS)).getTime())
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
}

function formatHour(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value))
}

function formatRange(range: DateRange): string {
  const lastHour = new Date(new Date(range.to).getTime() - HOUR_MS)
  return `${formatDate(range.from)} - ${formatDate(lastHour)} UTC`
}

export function QrAnalyticsDashboard() {
  const {
    data: organizations,
    error: organizationsError,
    isPending: isOrganizationsPending,
  } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const selectedOrganization = activeOrganization ?? organizations?.[0]
  const organizationId = selectedOrganization?.id

  const [items, setItems] = useState<QrItem[]>([])
  const [scope, setScope] = useState<Scope>("all")
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("7d"))
  const [preset, setPreset] = useState<Preset>("7d")
  const [analyticsItems, setAnalyticsItems] = useState<AnalyticsItem[]>([])
  const [isQrLoading, setIsQrLoading] = useState(true)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true)
  const [qrRequestError, setQrRequestError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let disposed = false
    if (!organizationId) {
      setItems([])
      setQrRequestError(null)
      setIsQrLoading(isOrganizationsPending)
      return () => {
        disposed = true
      }
    }

    setIsQrLoading(true)
    setQrRequestError(null)
    void rpcClient.qr
      .list({ organizationId, includeArchived: true })
      .then((result) => {
        if (!disposed) setItems(result.items)
      })
      .catch(() => {
        if (!disposed) {
          setItems([])
          setQrRequestError("Could not load QR codes. Please try again.")
        }
      })
      .finally(() => {
        if (!disposed) setIsQrLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [isOrganizationsPending, organizationId, reloadToken])

  useEffect(() => {
    if (scope !== "all" && !items.some((item) => item.id === scope)) setScope("all")
  }, [items, scope])

  useEffect(() => {
    let disposed = false
    const currentRequestId = requestIdRef.current + 1
    requestIdRef.current = currentRequestId

    if (!organizationId || isQrLoading || items.length === 0) {
      setAnalyticsItems([])
      setRequestError(null)
      setIsAnalyticsLoading(false)
      return () => {
        disposed = true
      }
    }

    const selectedQr = scope === "all" ? null : items.find((item) => item.id === scope)
    if (scope !== "all" && !selectedQr) {
      setAnalyticsItems([])
      setIsAnalyticsLoading(false)
      return
    }

    setIsAnalyticsLoading(true)
    setRequestError(null)
    const request =
      scope === "all"
        ? rpcClient.analytics.organization.hourly({ organizationId, ...range })
        : rpcClient.analytics.qr.hourly({ organizationId, qrCodeId: scope, ...range })

    void request
      .then((result) => {
        if (!disposed && currentRequestId === requestIdRef.current) setAnalyticsItems(result.items)
      })
      .catch((error: unknown) => {
        if (!disposed && currentRequestId === requestIdRef.current) {
          setAnalyticsItems([])
          setRequestError(getErrorMessage(error, "Could not load analytics. Please try again."))
        }
      })
      .finally(() => {
        if (!disposed && currentRequestId === requestIdRef.current) setIsAnalyticsLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [isQrLoading, items, organizationId, range, scope])

  function changePreset(value: Preset) {
    setPreset(value)
    setRange(rangeForPreset(value))
  }

  const selectedQr = scope === "all" ? null : items.find((item) => item.id === scope)
  const totalAttempts = analyticsItems.reduce((total, item) => total + item.redirectAttempts, 0)
  const averageAttempts = analyticsItems.length > 0 ? totalAttempts / analyticsItems.length : 0
  const peak = analyticsItems.reduce<AnalyticsItem | null>(
    (current, item) =>
      !current || item.redirectAttempts > current.redirectAttempts ? item : current,
    null,
  )
  const showOrganizationLoading = isOrganizationsPending && !selectedOrganization
  const showQrEmpty =
    !isQrLoading &&
    !organizationsError &&
    !qrRequestError &&
    items.length === 0 &&
    Boolean(selectedOrganization)
  const showError = Boolean(organizationsError) || Boolean(qrRequestError) || Boolean(requestError)

  if (showOrganizationLoading) {
    return <DashboardSkeleton />
  }

  if (showQrEmpty) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <QrCode className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Add a QR code to see analytics</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Redirect attempts will appear here after a QR code is assigned to{" "}
            {selectedOrganization?.name}.
          </p>
          <a
            href="/app/qr-codes/adopt"
            data-astro-prefetch="viewport"
            className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Adopt a QR code
          </a>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChartNoAxesCombined className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Redirect activity</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {selectedQr ? selectedQr.alias : "All QR codes"} · {formatRange(range)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground sm:min-w-48">
            QR scope
            <Select
              value={scope}
              onValueChange={(value) => {
                if (value) setScope(value)
              }}
            >
              <SelectTrigger
                aria-label="QR analytics scope"
                className="w-full"
                disabled={isQrLoading}
              >
                <SelectValue>
                  {scope === "all"
                    ? "All QR codes"
                    : selectedQr
                      ? `${selectedQr.alias} (${selectedQr.slug})`
                      : "Select a QR code"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All QR codes</SelectItem>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.alias} ({item.slug}){item.deletedAt ? " (archived)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground sm:min-w-40">
            Date range
            <Select value={preset} onValueChange={(value) => changePreset(value as Preset)}>
              <SelectTrigger aria-label="Analytics date range" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="60d">Last 60 days</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {showError ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
            <p role="alert" className="text-sm text-destructive">
              {organizationsError
                ? getErrorMessage(organizationsError, "Could not load your businesses.")
                : (qrRequestError ?? requestError)}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Redirect attempts"
              value={totalAttempts.toLocaleString()}
              icon={Activity}
            />
            <MetricCard
              label="Average per hour"
              value={averageAttempts.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              icon={ChartNoAxesCombined}
            />
            <MetricCard
              label="Peak hour"
              value={peak ? peak.redirectAttempts.toLocaleString() : "0"}
              detail={peak ? formatHour(peak.hour) : "No activity yet"}
              icon={CalendarDays}
            />
          </div>

          <Card>
            <CardHeader className="gap-4 border-b sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Hourly redirect attempts</CardTitle>
                <CardDescription>
                  Data is recorded when an active QR redirects a request. The chart shows completed
                  UTC hours only.
                </CardDescription>
              </div>
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border bg-muted/30 px-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-chart-4" aria-hidden="true" />
                Hourly
              </span>
            </CardHeader>
            <CardContent className="pt-5">
              {isAnalyticsLoading ? (
                <div
                  className="flex h-80 items-center justify-center"
                  aria-label="Loading analytics"
                >
                  <Spinner className="size-5" />
                </div>
              ) : (
                <>
                  <ChartContainer
                    config={chartConfig}
                    className="h-80 w-full aspect-auto"
                    aria-label="Hourly redirect attempts chart"
                  >
                    <AreaChart
                      accessibilityLayer
                      data={analyticsItems}
                      margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        interval={Math.max(0, Math.ceil(analyticsItems.length / 8) - 1)}
                        tickFormatter={(value) => formatHour(String(value))}
                      />
                      <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(value) => formatHour(String(value))}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="redirectAttempts"
                        stroke="var(--color-redirectAttempts)"
                        fill="var(--color-redirectAttempts)"
                        fillOpacity={0.18}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                  {totalAttempts === 0 && (
                    <p className="pt-3 text-center text-sm text-muted-foreground">
                      No redirect attempts were recorded in this range.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
            <Activity className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>
              Analytics stores hourly aggregate counts only. It does not identify visitors or prove
              that every request came from a person scanning a printed QR code.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail?: string
  icon: typeof Activity
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading analytics dashboard">
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {["one", "two", "three"].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}
