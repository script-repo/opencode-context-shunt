import type { WorkerOutcome } from "./base.js"

export type TransientGenerateFn = (args: {
  providerID: string
  id: string
  prompt: string
}) => Promise<string>

/**
 * Transient model worker wrapper (SPEC §7.4 / §13).
 * Fail-safes / escalates when OpenCode generate ctx is unavailable — never throws for missing ctx.
 */
export async function runTransientModel(
  task: string,
  opts?: {
    generate?: TransientGenerateFn
    model?: { providerID: string; id: string }
    allowExternal?: boolean
    input?: string
  },
): Promise<WorkerOutcome> {
  const model = opts?.model ?? { providerID: "local", id: "slm-default" }
  const external = model.providerID !== "local" && model.providerID !== "opencode"
  if (external && opts?.allowExternal === false) {
    return {
      status: "escalate",
      reason: "External model prohibited by policy; transient worker refusing route",
      confidence: 0.2,
      recommended_tier: "T0",
    }
  }

  if (!opts?.generate) {
    return {
      status: "escalate",
      reason: "No OpenCode generate ctx available; transient-model fail-safe escalate",
      confidence: 0.3,
      recommended_tier: "T3",
    }
  }

  const prompt = opts.input ? `${task}\n\n---\n${opts.input}` : task
  try {
    const text = await opts.generate({
      providerID: model.providerID,
      id: model.id,
      prompt,
    })
    if (!text || !String(text).trim()) {
      return {
        status: "escalate",
        reason: "Transient model returned empty output",
        confidence: 0.25,
        recommended_tier: "T3",
      }
    }
    return {
      status: "ok",
      result: {
        tier: model.providerID === "local" ? "T1" : "T2",
        output: String(text),
        confidence: 0.7,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: "escalate",
      reason: `Transient model failure: ${message}`,
      confidence: 0.2,
      recommended_tier: "T3",
    }
  }
}
