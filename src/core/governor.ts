/** Context budget governor (SPEC §16). */
import { estimateTokens } from "./tokenizer.js"

const TRUNCATION_MARKER = "\n…[ocs: truncated by governor]"

export type GovernorBudgets = {
  max_tool_result_tokens: number
  max_single_read_tokens: number
  max_shell_result_tokens: number
  target_total_utilization_percent?: number
  reserve_reasoning_tokens?: number
}

export const DEFAULT_GOVERNOR_BUDGETS: GovernorBudgets = {
  max_tool_result_tokens: 5000,
  max_single_read_tokens: 6000,
  max_shell_result_tokens: 3000,
}

/** Map a tool name to the budget field that governs its result size. */
const TOOL_BUDGET_KEY: Record<string, keyof GovernorBudgets> = {
  read: "max_single_read_tokens",
  bash: "max_shell_result_tokens",
  shell: "max_shell_result_tokens",
}

/** Resolve the applicable token budget for a given tool. */
export function resolveToolBudget(tool: string, budgets?: Partial<GovernorBudgets>): number {
  const merged = { ...DEFAULT_GOVERNOR_BUDGETS, ...budgets }
  const key = TOOL_BUDGET_KEY[tool] ?? "max_tool_result_tokens"
  return merged[key] as number
}

/**
 * Truncate text to fit within maxTokens, preferring to cut on a newline
 * boundary near the budget so output stays well-formed. Always appends a
 * truncation marker when the input exceeds budget; never returns the full
 * text unmodified in that case.
 */
export function applyBudget(text: string, maxTokens: number): string {
  if (!text) return text
  if (estimateTokens(text) <= maxTokens) return text

  const approxChars = Math.max(32, maxTokens * 4)
  let cut = text.slice(0, approxChars)

  // Prefer to cut on a newline boundary if one exists reasonably close to
  // the target cut point, so we don't sever mid-line.
  const lastNewline = cut.lastIndexOf("\n")
  const minAcceptable = approxChars * 0.5
  if (lastNewline >= minAcceptable) {
    cut = cut.slice(0, lastNewline)
  }

  return cut + TRUNCATION_MARKER
}

export type GovernResultInput = {
  tool: string
  text: string
  budgets?: Partial<GovernorBudgets>
}

export type GovernResultOutput = {
  text: string
  truncated: boolean
  tokensIn: number
  tokensOut: number
  budget: number
}

/** Apply the resolved per-tool budget to a tool result and report the outcome. */
export function governResult(input: GovernResultInput): GovernResultOutput {
  const budget = resolveToolBudget(input.tool, input.budgets)
  const tokensIn = estimateTokens(input.text)
  const text = applyBudget(input.text, budget)
  const tokensOut = estimateTokens(text)
  return {
    text,
    truncated: text !== input.text,
    tokensIn,
    tokensOut,
    budget,
  }
}
