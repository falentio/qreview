import { oc } from "@orpc/contract"
import * as v from "valibot"

export const qrCode = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  alias: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  slug: v.pipe(v.string(), v.regex(/^[a-z0-9]{10}$/)),
  claimable: v.boolean(),
  ownershipState: v.picklist(["orphan", "not-orphan"]),
  configurationState: v.picklist(["incomplete", "active"]),
  rawGoogleMapsUrl: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  googlePlaceId: v.nullable(v.pipe(v.string(), v.minLength(1))),
  canonicalReviewUrl: v.nullable(v.string()),
  organizationId: v.nullable(v.pipe(v.string(), v.minLength(1))),
  createdById: v.string(),
  claimedById: v.nullable(v.string()),
  claimedAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
  deletedAt: v.nullable(v.string()),
})

const qrTargetFields = v.pick(qrCode, ["rawGoogleMapsUrl", "googlePlaceId"])

export const organizationInput = v.object({
  organizationId: v.nonNullable(v.pick(qrCode, ["organizationId"]).entries.organizationId),
})

export const targetInput = v.object({
  googleMapsUrl: v.nonNullable(qrTargetFields.entries.rawGoogleMapsUrl),
  googlePlaceId: v.nonNullable(qrTargetFields.entries.googlePlaceId),
})

export const placeCandidate = v.object({
  placeId: v.string(),
  name: v.string(),
  address: v.nullable(v.string()),
})

export const resolveInput = v.object(
  v.entriesFromObjects([organizationInput, v.pick(targetInput, ["googleMapsUrl"])]),
)
export const resolveOutput = v.object({
  candidates: v.array(placeCandidate),
})
export const createInput = v.object(
  v.entriesFromObjects([organizationInput, v.pick(qrCode, ["alias"]), targetInput]),
)
export const createOutput = qrCode
export const batchCreateInput = v.object(
  v.entriesFromObjects([
    createInput,
    v.object({ count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)) }),
  ]),
)
export const batchCreateOutput = v.object({ items: v.array(qrCode) })
export const createOrphanInput = v.object(
  v.entriesFromObjects([v.pick(qrCode, ["alias"]), v.partial(targetInput)]),
)
export const createOrphanOutput = qrCode
export const claimInput = v.object(
  v.entriesFromObjects([organizationInput, v.pick(qrCode, ["slug"])]),
)
export const claimOutput = qrCode
export const listInput = v.object(
  v.entriesFromObjects([organizationInput, v.object({ includeArchived: v.optional(v.boolean()) })]),
)
export const listOutput = v.object({ items: v.array(qrCode) })
export const getInput = v.object(
  v.entriesFromObjects([organizationInput, v.partial(v.pick(qrCode, ["id", "slug"]))]),
)
export const getOutput = qrCode
export const updateInput = v.object(
  v.entriesFromObjects([
    organizationInput,
    v.pick(qrCode, ["id"]),
    v.partial(v.object(v.entriesFromObjects([v.pick(qrCode, ["alias"]), targetInput]))),
  ]),
)
export const updateOutput = qrCode
export const updateMapBySlugInput = v.object(
  v.entriesFromObjects([v.pick(qrCode, ["slug"]), targetInput]),
)
export const updateMapBySlugOutput = qrCode
export const archiveInput = v.object(
  v.entriesFromObjects([organizationInput, v.pick(qrCode, ["id"])]),
)
export const archiveOutput = qrCode
export const restoreInput = v.object(
  v.entriesFromObjects([organizationInput, v.pick(qrCode, ["id"])]),
)
export const restoreOutput = qrCode

export const qrContract = {
  resolve: oc.input(resolveInput).output(resolveOutput),
  create: oc.input(createInput).output(createOutput),
  batchCreate: oc.input(batchCreateInput).output(batchCreateOutput),
  createOrphan: oc.input(createOrphanInput).output(createOrphanOutput),
  claim: oc.input(claimInput).output(claimOutput),
  list: oc.input(listInput).output(listOutput),
  get: oc.input(getInput).output(getOutput),
  update: oc.input(updateInput).output(updateOutput),
  updateMapBySlug: oc.input(updateMapBySlugInput).output(updateMapBySlugOutput),
  archive: oc.input(archiveInput).output(archiveOutput),
  restore: oc.input(restoreInput).output(restoreOutput),
}

export type QrContract = typeof qrContract
