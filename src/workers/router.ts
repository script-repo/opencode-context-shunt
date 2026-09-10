import type { Tier } from "./base.js"
import type { ShuntDecision } from "../core/engine.js"

export function selectTier(decision: ShuntDecision): Tier {
  return decision.tier ?? "T3"
}
