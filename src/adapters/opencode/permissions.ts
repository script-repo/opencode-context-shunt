/** permission.hook evaluate bridge (SPEC §7.1). */
export function evaluatePermission(_input: unknown): "allow" | "deny" | "ask" {
  return "ask"
}
