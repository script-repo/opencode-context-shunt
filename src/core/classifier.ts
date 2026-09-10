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

function toolOutputTokens(input: unknown): number | undefined {
  if (!input || typeof input !== "object") {
    return typeof input === "string" ? estimateTokens(input) : undefined
  }
  const o = input as Record<string, unknown>
  if (typeof o.estimated_tokens === "number") return o.estimated_tokens
  if (typeof o.output === "string") return estimateTokens(o.output)
  if (typeof o.stdout === "string") {
    const err = typeof o.stderr === "string" ? o.stderr : ""
    return estimateTokens(err ? `${o.stdout}\n${err}` : o.stdout)
  }
  if (typeof o.content === "string") return estimateTokens(o.content)
  return undefined
}

/**
 * Rule-based workload classifier (SPEC section 9).
 * Read operations are routed onto the Smart Read path (SPEC section 10).
 * Shell/grep/test outputs are marked for Phase 3 firewall reducers.
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

  if (/(bash|shell|sh|zsh)/i.test(tool)) {
    const tokens = toolOutputTokens(request.input)
    return {
      action: "compress",
      tier: "T0",
      reducer: "shell",
      reason: "shell/bash output -> shell reducer firewall",
      estimatedRawTokens: tokens,
      maximumReturnTokens: 3000,
    }
  }

  if (/(test|vitest|jest|mocha|pytest)/i.test(tool)) {
    const tokens = toolOutputTokens(request.input)
    return {
      action: "compress",
      tier: "T0",
      reducer: "tests",
      reason: "test runner output -> tests reducer firewall",
      estimatedRawTokens: tokens,
      maximumReturnTokens: 3000,
    }
  }

  if (/(grep|rg|ripgrep)/i.test(tool)) {
    const tokens = toolOutputTokens(request.input)
    return {
      action: "compress",
      tier: "T0",
      reducer: "grep",
      reason: "grep/rg output -> grep reducer firewall",
      estimatedRawTokens: tokens,
      maximumReturnTokens: 3000,
    }
  }

  if (tool === "git" || tool.startsWith("git-") || tool.startsWith("git ")) {
    return {
      action: "compress",
      tier: "T0",
      reducer: "git",
      reason: "git output -> git reducer",
      estimatedRawTokens: toolOutputTokens(request.input),
      maximumReturnTokens: 3000,
    }
  }

  return {
    action: "pass",
    tier: "T3",
    reason: `classifier default pass for ${request.tool}/${request.operation}`,
  }
}

export { DEFAULT_READ_THRESHOLDS }
