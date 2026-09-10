export function logDebug(...args: unknown[]): void {
  if (process.env.OCS_DEBUG) console.error("[ocs]", ...args)
}
