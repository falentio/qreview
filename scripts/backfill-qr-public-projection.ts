import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
if (!process.argv.includes("--remote")) {
  throw new Error("Alchemy backfills run as remote deploy-time actions; use --remote.")
}

const stage = getOption("--stage")
const args = ["exec", "alchemy", "deploy", "--yes", "--force"]
if (stage) args.push("--stage", stage)

const { stdout, stderr } = await execFileAsync("vp", args, {
  env: { ...process.env, BACKFILL_QR_PUBLIC_PROJECTION: "true" },
  maxBuffer: 100 * 1024 * 1024,
})
process.stdout.write(stdout)
if (stderr) process.stderr.write(stderr)

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}
