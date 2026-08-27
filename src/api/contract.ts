import { oc } from "@orpc/contract"
import { z } from "zod"

const user = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
})

export const apiContract = {
  health: {
    check: oc
      .input(z.object({}))
      .output(z.object({ ok: z.literal(true) })),
  },
  session: {
    current: oc
      .input(z.object({}))
      .output(
        z.object({
          user,
          expiresAt: z.string(),
        }),
      ),
  },
}
