import type { Reducer } from "./base.js"
import { estimateTokens } from "../core/tokenizer.js"
import { boundedReduce } from "./generic.js"

const FAIL_LINE = /\b(FAIL|failed|×|✖|AssertionError|Error:|expected|Received|●)\b/i
const SUITE_RE = /(?:FAIL|PASS|✓|✔|×|✖)\s+(\S+\.(?:test|spec)\.[a-zA-Z0-9]+)/i

export const testsReducer: Reducer = {
  name: "tests",
  async reduce(input) {
    const tokensIn = estimateTokens(input)
    if (tokensIn <= 1000) {
      return { summary: input, tokensIn, tokensOut: tokensIn, metadata: { passthrough: true } }
    }
    const lines = input.split(/\r?\n/)
    const material_errors: Array<{ suite?: string; message: string; location?: string }> = []
    let currentSuite: string | undefined
    for (const line of lines) {
      const suite = line.match(SUITE_RE)
      if (suite) currentSuite = suite[1]
      if (!FAIL_LINE.test(line) && !/Error|Expected|Received|at\s+/.test(line)) continue
      if (material_errors.length >= 20) continue
      const loc = line.match(/([\w./-]+\.[a-zA-Z0-9]+):(\d+)/)
      material_errors.push({
        suite: currentSuite,
        message: line.trim().slice(0, 400),
        location: loc ? `${loc[1]}:${loc[2]}` : undefined,
      })
    }
    const failedSuites = new Set(
      material_errors.map((e) => e.suite).filter((s): s is string => !!s),
    )
    const summaryObj = {
      type: "tests_reduced",
      status: material_errors.length ? "failed" : "ok_or_unknown",
      summary: material_errors.length
        ? `${failedSuites.size || "n"} suite(s) with ${material_errors.length} material error line(s)`
        : `test output reduced from ${lines.length} lines (no clear failures extracted)`,
      material_errors,
      omitted_lines: Math.max(0, lines.length - material_errors.length),
      tokens_in: tokensIn,
    }
    const summary = JSON.stringify(summaryObj, null, 2)
    if (estimateTokens(summary) > 2000) {
      return {
        ...boundedReduce(summary, 6000),
        metadata: { reducer: "tests", nested_bound: true },
      }
    }
    return {
      summary,
      tokensIn,
      tokensOut: estimateTokens(summary),
      metadata: { reducer: "tests", failures: material_errors.length },
    }
  },
}
