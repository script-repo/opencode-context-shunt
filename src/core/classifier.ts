import type { ShuntDecision, ShuntRequest } from "./engine.js"
import { estimateTokens } from "./tokenizer.js"
import { DEFAULT_READ_THRESHOLDS, resolveReadThresholds } from "./policy.js"

function readInputMeta(input: unknown): {
  path?: string
  hasRange: boolean
  estimatedTokens?: number
} {
  if (!input || typeof input !== "object") return { hasRange: false }
  const o = input as Record<string, unknown>
  const path =
    typeof o.path === "string"
      ? o.path
      : typeof o.filePath === "string"
        ? o.filePath
        : undefined
  const hasRange =
    o.range != null ||
    o.offset != null ||
    o.limit != null ||
    o.startLine != null ||
    o.endLine != null ||
    (typeof o.lines === "string" && /^\d+-\d+$/.test(o.lines))
  let estimatedTokens: number | undefined
  if (typeof o.content === "string") estimatedTokens = estimateTokens(o.content)
  else if (typeof o.estimated_tokens === "number") estimatedTokens = o.estimated_tokens
  return { path, hasRange, estimatedTokens }
}

/**
 * Rule-based workload classifier (SPEC section 9).
 * Read operations are routed onto the Smart Read path (SPEC section 10).
 * Final small-vs-map decision is made inside smartRead; classifier only routes.
 */
export function classify(request: ShuntRequest): ShuntDecision {
  const tool = request.tool.toLowerCase()
  const thresholds = resolveReadThresholds(
    (request.metadata?.thresholds as Parameters<typeof resolveReadThresholds>[0]) ?? null,
  )

  if (tool === "read") {
    const meta = readInputMeta(request.input)

    if (meta.hasRange) {
      return {
        action: "pass",
        tier: "T0",
        reducer: "smart-read",
        reason: "targeted read -> Smart Read content path",
        estimatedRawTokens: meta.estimatedTokens,
        maximumReturnTokens: thresholds.targeted_range_max_tokens,
      }
    }

    if (
      meta.estimatedTokens != null &&
      meta.estimatedTokens > thresholds.direct_max_tokens
    ) {
      return {
        action: "compress",
        tier: "T0",
        reducer: "smart-read",
        reason: "large read -> Smart Read semantic map",
        estimatedRawTokens: meta.estimatedTokens,
        maximumReturnTokens: thresholds.maximum_summary_tokens,
      }
    }

    return {
      action: "pass",
      tier: "T0",
      reducer: "smart-read",
      reason: "read -> Smart Read path",
      estimatedRawTokens: meta.estimatedTokens,
      maximumReturnTokens: thresholds.direct_max_tokens,
    }
  }

  return {
    action: "pass",
    tier: "T3",
    reason: `classifier default pass for ${request.tool}/${request.operation}`,
  }
}

export { DEFAULT_READ_THRESHOLDS }
