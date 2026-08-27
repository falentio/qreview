import { healthContract } from "@/orpc-contract/resource/health"
import { sessionContract } from "@/orpc-contract/resource/session"

export const apiContract = {
  health: healthContract,
  session: sessionContract,
}

export type ApiContract = typeof apiContract
