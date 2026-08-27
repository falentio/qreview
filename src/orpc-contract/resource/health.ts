import { oc } from "@orpc/contract"
import * as v from "valibot"

export const healthContract = {
  check: oc
    .input(v.object({}))
    .output(v.object({ ok: v.literal(true) })),
}
