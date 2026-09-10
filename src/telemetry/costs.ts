/** Configurable model-cost registry and net-savings calculation (SPEC §22). */

export type ModelCostRates = {
  input_per_million: number
  output_per_million: number
}

/** Minimal default registry; callers SHOULD supply their own via ocs.yaml `costs.models`. */
export const DEFAULT_COST_REGISTRY: Record<string, ModelCostRates> = {
  "provider/model-a": { input_per_million: 3.0, output_per_million: 15.0 },
  "local/model-b": { input_per_million: 0, output_per_million: 0 },
}

export type CostRegistry = Record<string, ModelCostRates>

/** Estimate USD cost for a token count against a registered model's rates. */
export function estimateCostUsd(
  tokens: number,
  modelId: string,
  kind: "input" | "output" = "input",
  registry: CostRegistry = DEFAULT_COST_REGISTRY,
): number {
  const rates = registry[modelId]
  if (!rates || tokens <= 0) return 0
  const rate = kind === "input" ? rates.input_per_million : rates.output_per_million
  return (tokens / 1_000_000) * rate
}

export type NetSavingsInput = {
  avoidedInputTokens: number
  frontierModelId: string
  workerInputTokens: number
  workerOutputTokens: number
  workerModelId: string
  registry?: CostRegistry
}

export type NetSavingsResult = {
  frontierCostAvoidedUsd: number
  workerCostUsd: number
  netSavingsUsd: number
}

/**
 * FrontierCostAvoided = avoided_input_tokens * frontier_input_rate
 * WorkerCost = worker_input_tokens * worker_input_rate + worker_output_tokens * worker_output_rate
 * NetSavings = FrontierCostAvoided - WorkerCost
 */
export function calculateNetSavings(input: NetSavingsInput): NetSavingsResult {
  const registry = input.registry ?? DEFAULT_COST_REGISTRY
  const frontierCostAvoidedUsd = estimateCostUsd(
    input.avoidedInputTokens,
    input.frontierModelId,
    "input",
    registry,
  )
  const workerCostUsd =
    estimateCostUsd(input.workerInputTokens, input.workerModelId, "input", registry) +
    estimateCostUsd(input.workerOutputTokens, input.workerModelId, "output", registry)

  return {
    frontierCostAvoidedUsd,
    workerCostUsd,
    netSavingsUsd: frontierCostAvoidedUsd - workerCostUsd,
  }
}
