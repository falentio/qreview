import { healthContract } from "@/orpc-contract/resource/health"
import { qrContract } from "@/orpc-contract/resource/qr"
import { sessionContract } from "@/orpc-contract/resource/session"

export const apiContract = {
  health: healthContract,
  qr: qrContract,
  session: sessionContract,
}

export type ApiContract = typeof apiContract
