import { applyBudget, resolveToolBudget } from "../core/governor.js"
import { estimateTokens } from "../core/tokenizer.js"
import type { Reducer, ReducerResult } from "./base.js"
import { boundedReduce, genericReducer } from "./generic.js"
import { shellReducer } from "./shell.js"
import { testsReducer } from "./tests.js"
import { grepReducer } from "./grep.js"
import { gitReducer } from "./git.js"
import { kubernetesReducer } from "./kubernetes.js"
import { observabilityReducer } from "./observability.js"
import { codeMapReducer } from "./code-map.js"

export const DEFAULT_MAX_RAW_TOKENS = 1500
export const DEFAULT_RETURN_TOKENS = 3000

const REGISTRY: Record<string, Reducer> = {
  generic: genericReducer,
  shell: shellReducer,
  bash: shellReducer,
  sh: shellReducer,
  tests: testsReducer,
  test: testsReducer,
  grep: grepReducer,
  rg: grepReducer,
  git: gitReducer,
  kubernetes: kubernetesReducer,
  kubectl: kubernetesReducer,
  observability: observabilityReducer,
  "code-map": codeMapReducer,
}

export function selectReducer(tool: string, hint?: string): Reducer {
  const h = (hint ?? "").toLowerCase()
  if (h && REGISTRY[h]) return REGISTRY[h]!
  const t = tool.toLowerCase()
  if (REGISTRY[t]) return REGISTRY[t]!
  if (/(test|vitest|jest|mocha|pytest)/i.test(t)) return testsReducer
  if (/(bash|shell|sh|zsh|cmd|powershell)/i.test(t)) return shellReducer
  if (/(grep|rg|ripgrep)/i.test(t)) return grepReducer
  if (t === "git" || t.startsWith("git-")) return gitReducer
  if (/(kubectl|kubernetes|k8s)/i.test(t)) return kubernetesReducer
  return genericReducer
}

export function coerceOutputText(output: unknown): string {
  if (output == null) return ""
  if (typeof output === "string") return output
  if (typeof output === "object") {
    const o = output as Record<string, unknown>
    if (typeof o.text === "string") return o.text
    if (typeof o.output === "string") return o.output
    if (typeof o.stdout === "string") {
      const err = typeof o.stderr === "string" ? o.stderr : ""
      return err ? `${o.stdout}\n${err}` : o.stdout
    }
    try {
      return JSON.stringify(output, null, 2)
    } catch {
      return String(output)
    }
  }
  return String(output)
}

export type FirewallResult = {
  text: string
  reduced: boolean
  reducer?: string
  tokensIn: number
  tokensOut: number
  detail?: ReducerResult
}

/** Phase 3 output firewall (SPEC §11). */
export async function applyOutputFirewall(args: {
  tool: string
  output: unknown
  reducerHint?: string
  maxRawTokens?: number
  maxReturnTokens?: number
}): Promise<FirewallResult> {
  const text = coerceOutputText(args.output)
  const tokensIn = estimateTokens(text)
  const maxRaw = args.maxRawTokens ?? DEFAULT_MAX_RAW_TOKENS
  const returnBudget = args.maxReturnTokens ?? resolveToolBudget(args.tool)

  if (tokensIn <= maxRaw) {
    const budgeted = applyBudget(text, returnBudget)
    if (budgeted !== text) {
      return {
        text: budgeted,
        reduced: true,
        reducer: "governor",
        tokensIn,
        tokensOut: estimateTokens(budgeted),
      }
    }
    return { text, reduced: false, tokensIn, tokensOut: tokensIn }
  }

  const reducer = selectReducer(args.tool, args.reducerHint)
  let detail: ReducerResult
  try {
    detail = await reducer.reduce(text)
  } catch {
    // SPEC §27: reducer failure -> bounded raw fallback
    detail = {
      ...boundedReduce(text, returnBudget * 4),
      metadata: { reducer: reducer.name, bounded_fallback: true },
    }
  }

  const budgeted = applyBudget(detail.summary, returnBudget)
  return {
    text: budgeted,
    reduced: true,
    reducer: reducer.name,
    tokensIn,
    tokensOut: estimateTokens(budgeted),
    detail: budgeted === detail.summary ? detail : { ...detail, summary: budgeted },
  }
}
