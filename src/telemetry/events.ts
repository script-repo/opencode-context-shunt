export type OcsEvent =
  | { type: "route"; tool: string; action: string; tier?: string }
  | { type: "reduce"; reducer: string; tokensIn: number; tokensOut: number }

export function emit(event: OcsEvent): void {
  if (process.env.OCS_DEBUG) console.error("[ocs]", JSON.stringify(event))
}
