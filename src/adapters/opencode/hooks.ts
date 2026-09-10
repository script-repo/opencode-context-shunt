import type { ContextShuntEngine } from "../../core/engine.js"
import { applyOutputFirewall } from "../../reducers/firewall.js"
import type { OpenCodePluginContext, OpenCodeToolHookEvent } from "./types.js"

/**
 * execute.before / execute.after registration (SPEC section 7.2 / §11).
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

  toolApi.hook("execute.after", async (event: OpenCodeToolHookEvent) => {
    const name = (event.tool ?? event.name ?? "").toLowerCase()
    if (!name || name === "read") return

    let decisionReducer: string | undefined
    if (engine) {
      try {
        const decision = await engine.decide({
          sessionId: String(event.metadata?.sessionId ?? "unknown"),
          tool: name,
          operation: "execute.after",
          input: event.input,
          metadata: event.metadata,
        })
        decisionReducer = decision.reducer
        event.metadata = {
          ...(event.metadata ?? {}),
          ocs: {
            ...((event.metadata?.ocs as Record<string, unknown> | undefined) ?? {}),
            decision,
          },
        }
      } catch {
        // classifier failure must not break tool results
      }
    }

    const raw = event.output ?? event.result
    const maxRawTokens =
      typeof event.metadata?.maxRawTokens === "number" ? event.metadata.maxRawTokens : undefined
    const fw = await applyOutputFirewall({
      tool: name,
      output: raw,
      reducerHint: decisionReducer,
      maxRawTokens,
    })
    if (fw.reduced) {
      event.output = fw.text
      event.result = fw.text
      event.metadata = {
        ...(event.metadata ?? {}),
        ocs: {
          ...((event.metadata?.ocs as Record<string, unknown> | undefined) ?? {}),
          firewall: {
            reduced: true,
            reducer: fw.reducer,
            tokensIn: fw.tokensIn,
            tokensOut: fw.tokensOut,
          },
        },
      }
    }
  })
}
