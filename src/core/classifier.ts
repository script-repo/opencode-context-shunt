import type { ShuntDecision, ShuntRequest } from "./engine.js"

/** Rule-based workload classifier (SPEC §9). */
export function classify(request: ShuntRequest): ShuntDecision {
  void request
  return {
    action: "pass",
    tier: "T3",
    reason: "classifier stub",
  }
}
