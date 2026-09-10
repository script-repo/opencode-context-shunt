import { createDefaultEngine } from "../../core/engine.js"
import type { OpenCodePluginContext } from "./types.js"

/**
 * OpenCode V2 plugin entry (SPEC §7).
 * Core must not depend on OpenCode types — keep them here.
 */
export function createOpenCodePlugin() {
  const engine = createDefaultEngine()
  return {
    id: "opencode-context-shunt",
    async register(ctx: OpenCodePluginContext) {
      void engine
      void ctx
      // Hooks wired in hooks.ts once OpenCode beta types stabilize.
    },
  }
}
