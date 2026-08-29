import { oc } from "@orpc/contract"
import * as v from "valibot"

const identifier = v.pipe(v.string(), v.minLength(1))
const utcTimestamp = v.pipe(v.string(), v.minLength(1), v.regex(/(?:Z|[+-]00:00)$/))

export const qrHourlyInput = v.object({
  organizationId: v.nullable(identifier),
  qrCodeId: identifier,
  from: utcTimestamp,
  to: utcTimestamp,
})

export const qrHourlyOutput = v.object({
  items: v.array(
    v.object({
      hour: v.string(),
      redirectAttempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  ),
})

export const cleanupInput = v.object({})
export const cleanupOutput = v.object({
  deletedBuckets: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export const analyticsContract = {
  qr: {
    hourly: oc.input(qrHourlyInput).output(qrHourlyOutput),
  },
  cleanup: oc.input(cleanupInput).output(cleanupOutput),
}

export type AnalyticsContract = typeof analyticsContract
