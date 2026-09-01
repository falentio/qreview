import { getAppLogger, type AppLogger } from "@/lib/logging"

export const PLACES_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60

export type CacheKind = "search" | "details"
export type WaitUntil = (promise: Promise<unknown>) => void

export type KvStore = {
  get(key: string, type: "text"): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}
type CacheLogger = Pick<AppLogger, "warn">

export class CloudflareKvJsonCache {
  private readonly namespace: KvStore
  private readonly expirationTtl: number
  private readonly logger: CacheLogger
  private readonly waitUntil: WaitUntil

  constructor({
    namespace,
    waitUntil,
    expirationTtl = PLACES_CACHE_TTL_SECONDS,
    logger = getAppLogger(["qr", "cache"]),
  }: {
    namespace: KvStore
    waitUntil: WaitUntil
    expirationTtl?: number
    logger?: CacheLogger
  }) {
    this.namespace = namespace
    this.expirationTtl = expirationTtl
    this.logger = logger
    this.waitUntil = waitUntil
  }

  async get<T>({ key, kind }: { key: string; kind: CacheKind }): Promise<T | null> {
    try {
      const value = await this.namespace.get(key, "text")
      return value === null ? null : (JSON.parse(value) as T)
    } catch (error) {
      this.logger.warn("Places cache read failed.", { kind, error })
      return null
    }
  }

  set<T>({ key, kind, value }: { key: string; kind: CacheKind; value: T }): void {
    try {
      this.waitUntil(this.write({ key, kind, value }))
    } catch (error) {
      this.logger.warn("Places cache write scheduling failed.", { kind, error })
    }
  }

  private async write<T>({
    key,
    kind,
    value,
  }: {
    key: string
    kind: CacheKind
    value: T
  }): Promise<void> {
    try {
      await this.namespace.put(key, JSON.stringify(value), {
        expirationTtl: this.expirationTtl,
      })
    } catch (error) {
      this.logger.warn("Places cache write failed.", { kind, error })
    }
  }
}
