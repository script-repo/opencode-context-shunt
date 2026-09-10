import { describe, expect, it } from "vitest"
import { registerHooks } from "../../src/adapters/opencode/hooks.js"
import { createDefaultEngine } from "../../src/core/engine.js"
import type { OpenCodePluginContext, OpenCodeToolHookEvent } from "../../src/adapters/opencode/types.js"

describe("execute.after firewall hook", () => {
  it("reduces large bash output via execute.after", async () => {
    const handlers: Record<string, Array<(e: OpenCodeToolHookEvent) => Promise<void> | void>> = {}
    const ctx: OpenCodePluginContext = {
      tool: {
        hook(event, handler) {
          ;(handlers[event] ??= []).push(handler)
        },
      },
    }
    registerHooks(ctx, createDefaultEngine())
    expect(handlers["execute.after"]?.length).toBe(1)

    const huge = Array.from({ length: 4000 }, (_, i) => `line ${i}`).join("\n")
    const event: OpenCodeToolHookEvent = {
      tool: "bash",
      output: huge,
      metadata: {},
    }
    await handlers["execute.after"]![0]!(event)
    expect(typeof event.output).toBe("string")
    expect(String(event.output).length).toBeLessThan(huge.length)
    const ocs = event.metadata?.ocs as { firewall?: { reduced?: boolean } }
    expect(ocs?.firewall?.reduced).toBe(true)
  })
})
