import { createHash } from "node:crypto"

export function fingerprint(parts: string[]): string {
  const h = createHash("sha256")
  for (const p of parts) h.update(p)
  h.update("\0")
  return h.digest("hex")
}
