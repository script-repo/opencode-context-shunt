import type { ShuntDecision } from "../core/engine.js"
import type { Tier, WorkerOutcome, WorkerRequest } from "./base.js"
import { runDeterministic } from "./deterministic.js"
import { runTransientModel, type TransientGenerateFn } from "./transient-model.js"

export function selectTier(decision: ShuntDecision): Tier {
  return decision.tier ?? "T3"
}

export type RouteWorkerArgs = {
  decision: ShuntDecision
  task: string
  input?: string
  allowExternal?: boolean
  generate?: TransientGenerateFn
  model?: { providerID: string; id: string }
  metadata?: Record<string, unknown>
}

/** Worker router + escalation (SPEC §13 / §15). */
export async function routeWorker(args: RouteWorkerArgs): Promise<WorkerOutcome> {
  const tier = selectTier(args.decision)
  const req: Partial<WorkerRequest> = {
    task: args.task,
    input: args.input,
    tier,
    metadata: args.metadata,
  }

  if (tier === "T0" || args.decision.action === "compress" || args.decision.reducer) {
    const t0 = await runDeterministic(args.task, req)
    if (t0.status === "ok") return t0
    if (tier === "T0" && !args.generate) return t0
  }

  if (tier === "T1" || tier === "T2" || (tier === "T0" && args.generate)) {
    const transient = await runTransientModel(args.task, {
      generate: args.generate,
      model: args.model,
      allowExternal: args.allowExternal,
      input: args.input,
    })
    if (transient.status === "ok") return transient
    if (transient.status === "escalate") {
      return {
        ...transient,
        recommended_tier: "T3",
        reason: `${transient.reason} (router escalating to T3)`,
      }
    }
  }

  return {
    status: "escalate",
    reason: `Router selected ${tier}; frontier/primary handling required`,
    confidence: 0.5,
    recommended_tier: "T3",
  }
}
