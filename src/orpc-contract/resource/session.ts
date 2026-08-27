import { oc } from "@orpc/contract"
import * as v from "valibot"

const user = v.object({
  id: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
})

export const sessionContract = {
  current: oc.input(v.object({})).output(
    v.object({
      user,
      expiresAt: v.string(),
    }),
  ),
}
