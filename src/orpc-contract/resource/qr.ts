import { oc } from "@orpc/contract"
import * as v from "valibot"

const alias = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))

const qrCode = v.object({
  id: v.string(),
  alias: v.string(),
  slug: v.string(),
  ownershipState: v.picklist(["orphan", "not-orphan"]),
  configurationState: v.picklist(["incomplete", "active"]),
  rawGoogleMapsUrl: v.nullable(v.string()),
  googlePlaceId: v.nullable(v.string()),
  canonicalReviewUrl: v.nullable(v.string()),
  organizationId: v.nullable(v.string()),
  createdById: v.string(),
  claimedById: v.nullable(v.string()),
  claimedAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.nullable(v.string()),
})

const organizationInput = v.object({
  organizationId: v.pipe(v.string(), v.minLength(1)),
})

const targetInput = v.object({
  googleMapsUrl: v.pipe(v.string(), v.minLength(1)),
  googlePlaceId: v.pipe(v.string(), v.minLength(1)),
})

export const qrContract = {
  resolve: oc
    .input(v.intersect([organizationInput, v.object({ googleMapsUrl: v.string() })]))
    .output(
      v.object({
        candidates: v.array(
          v.object({
            placeId: v.string(),
            name: v.string(),
            address: v.nullable(v.string()),
          }),
        ),
      }),
    ),
  create: oc
    .input(v.intersect([organizationInput, v.object({ alias }), targetInput]))
    .output(qrCode),
  createOrphan: oc
    .input(
      v.object({
        alias,
        googleMapsUrl: v.optional(v.pipe(v.string(), v.minLength(1))),
        googlePlaceId: v.optional(v.pipe(v.string(), v.minLength(1))),
      }),
    )
    .output(qrCode),
  claim: oc
    .input(
      v.intersect([
        organizationInput,
        v.object({ slug: v.pipe(v.string(), v.regex(/^[a-z0-9]{10}$/)) }),
      ]),
    )
    .output(qrCode),
  list: oc
    .input(v.intersect([organizationInput, v.object({ includeArchived: v.optional(v.boolean()) })]))
    .output(v.object({ items: v.array(qrCode) })),
  get: oc
    .input(
      v.intersect([
        organizationInput,
        v.object({ id: v.optional(v.string()), slug: v.optional(v.string()) }),
      ]),
    )
    .output(qrCode),
  update: oc
    .input(
      v.intersect([
        organizationInput,
        v.object({
          id: v.string(),
          alias: v.optional(alias),
          googleMapsUrl: v.optional(v.pipe(v.string(), v.minLength(1))),
          googlePlaceId: v.optional(v.pipe(v.string(), v.minLength(1))),
        }),
      ]),
    )
    .output(qrCode),
  archive: oc.input(v.intersect([organizationInput, v.object({ id: v.string() })])).output(qrCode),
  restore: oc.input(v.intersect([organizationInput, v.object({ id: v.string() })])).output(qrCode),
}

export type QrContract = typeof qrContract
