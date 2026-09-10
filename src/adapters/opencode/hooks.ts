import type { ContextShuntEngine } from "../../core/engine.js"
import type { OpenCodePluginContext, OpenCodeToolHookEvent } from "./types.js"

/**
 * execute.before / execute.after registration (SPEC section 7.2).
 * Marks read invocations with Smart Read routing metadata.
 */
export function registerHooks(ctx: OpenCodePluginContext, engine?: ContextShuntEngine): void {
  const toolApi = ctx.tool
  if (!toolApi?.hook) return

  toolApi.hook("execute.before", async (event: OpenCodeToolHookEvent) => {
    const name = (event.tool ?? event.name ?? "").toLowerCase()
    if (name !== "read" || !engine) return
    const decision = await engine.decide({
      sessionId: String(event.metadata?.sessionId ?? "unknown"),
      tool: "read",
      operation: "execute",
      input: event.input,
      metadata: event.metadata,
    })
    event.metadata = {
      ...(event.metadata ?? {}),
      ocs: {
        decision,
        smartRead: decision.reducer === "smart-read",
      },
    }
  })
}
