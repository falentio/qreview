import { oc } from "@orpc/contract"
import { z } from "zod"

export const healthContract = {
  check: oc
    .input(z.object({}))
    .output(z.object({ ok: z.literal(true) })),
}
