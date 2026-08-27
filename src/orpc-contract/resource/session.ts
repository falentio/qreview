import { oc } from "@orpc/contract"
import { z } from "zod"

const user = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
})

export const sessionContract = {
  current: oc
    .input(z.object({}))
    .output(
      z.object({
        user,
        expiresAt: z.string(),
      }),
    ),
}
