import type { Reducer } from "./base.js"
import { estimateTokens } from "../core/tokenizer.js"
import { boundedReduce } from "./generic.js"

const ERROR_RE =
  /\b(error|failed|failure|fatal|exception|traceback|panic|denied|refused|ENOENT|EACCES)\b/i
const EXIT_RE = /(?:exit(?:_code|ed)?|code)\s*[:=]?\s*(-?\d+)/i

function extractMaterialErrors(
  lines: string[],
  limit = 12,
): Array<{ message: string; location?: string }> {
  const out: Array<{ message: string; location?: string }> = []
  for (let i = 0; i < lines.length && out.length < limit; i++) {
    const line = lines[i]!
    if (!ERROR_RE.test(line)) continue
    const loc = line.match(/([\w./-]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?/)
    out.push({
      message: line.trim().slice(0, 400),
      location: loc ? `${loc[1]}:${loc[2]}` : undefined,
    })
  }
  return out
}

function inferExitCode(input: string): number | undefined {
  const m = input.match(EXIT_RE)
  if (m) return Number(m[1])
  if (/\b(failed|failure|error)\b/i.test(input) && !/\b0 failures\b/i.test(input)) return 1
  return undefined
}

export const shellReducer: Reducer = {
  name: "shell",
  async reduce(input) {
    const tokensIn = estimateTokens(input)
    if (tokensIn <= 800) {
      return { summary: input, tokensIn, tokensOut: tokensIn, metadata: { passthrough: true } }
    }
    const lines = input.split(/\r?\n/)
    const exit = inferExitCode(input)
    const material_errors = extractMaterialErrors(lines)
    const status = exit === 0 ? "ok" : exit == null ? "unknown" : "failed"
    const head = lines.slice(0, 20).join("\n")
    const payload = {
      type: "shell_reduced",
      exit_code: exit ?? null,
      status,
      summary:
        status === "failed"
          ? `${material_errors.length || "some"} material error line(s); output reduced`
          : `shell output reduced from ${lines.length} lines`,
      material_errors,
      head,
      omitted_lines: Math.max(0, lines.length - 20),
      tokens_in: tokensIn,
    }
    const summary = JSON.stringify(payload, null, 2)
    if (estimateTokens(summary) > 2000) {
      const fallback = boundedReduce(summary, 6000)
      return {
        ...fallback,
        metadata: { ...(fallback.metadata ?? {}), reducer: "shell", nested_bound: true },
      }
    }
    return {
      summary,
      tokensIn,
      tokensOut: estimateTokens(summary),
      metadata: { reducer: "shell", exit_code: exit, status },
    }
  },
}
