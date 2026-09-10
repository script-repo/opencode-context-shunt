import { applyOutputFirewall } from "../reducers/firewall.js"
import { boundedReduce } from "../reducers/generic.js"
import { estimateTokens } from "../core/tokenizer.js"
import type { WorkerOutcome, WorkerRequest } from "./base.js"

const ESCALATE_HINT =
  /\b(security|exploit|concurrent|race|deadlock|destructive|production.?delete|architecture|design trade-?off)\b/i

/** T0 deterministic worker (SPEC §6 / §13) — no LLM. */
export async function runDeterministic(
  task: string,
  request?: Partial<WorkerRequest>,
): Promise<WorkerOutcome> {
  const input = request?.input ?? ""
  const lower = task.toLowerCase()

  if (ESCALATE_HINT.test(task) && !/\b(reduce|summarize|fingerprint|cache)\b/i.test(task)) {
    return {
      status: "escalate",
      reason: "Task appears to require non-deterministic reasoning",
      confidence: 0.35,
      recommended_tier: "T3",
    }
  }

  if (/\b(reduce|firewall|compress|summarize output)\b/i.test(lower)) {
    const tool =
      typeof request?.metadata?.tool === "string" ? request.metadata.tool : "shell"
    const fw = await applyOutputFirewall({ tool, output: input || task })
    return { status: "ok", result: { tier: "T0", output: fw.text, confidence: 0.92 } }
  }

  if (/\b(count|stats|measure|tokens?)\b/i.test(lower)) {
    const text = input || task
    return {
      status: "ok",
      result: {
        tier: "T0",
        output: JSON.stringify({
          lines: text.split(/\r?\n/).length,
          tokens: estimateTokens(text),
          bytes: text.length,
        }),
        confidence: 0.99,
      },
    }
  }

  const payload = input || task
  if (estimateTokens(payload) > 400) {
    const reduced = boundedReduce(payload)
    return { status: "ok", result: { tier: "T0", output: reduced.summary, confidence: 0.85 } }
  }

  if (/\b(echo|ack|ping|noop)\b/i.test(lower)) {
    return {
      status: "ok",
      result: { tier: "T0", output: payload.slice(0, 500), confidence: 0.95 },
    }
  }

  if (estimateTokens(payload) < 80 && !input) {
    return {
      status: "escalate",
      reason: "Deterministic worker cannot safely interpret unstructured reasoning task",
      confidence: 0.4,
      recommended_tier: "T1",
    }
  }

  const reduced = boundedReduce(payload, 2000)
  return { status: "ok", result: { tier: "T0", output: reduced.summary, confidence: 0.75 } }
}
