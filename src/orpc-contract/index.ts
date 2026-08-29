import { analyticsContract } from "@/orpc-contract/resource/analytics"
import { healthContract } from "@/orpc-contract/resource/health"
import { qrContract } from "@/orpc-contract/resource/qr"
import { sessionContract } from "@/orpc-contract/resource/session"

export const apiContract = {
  analytics: analyticsContract,
  health: healthContract,
  qr: qrContract,
  session: sessionContract,
}

export type ApiContract = typeof apiContract
