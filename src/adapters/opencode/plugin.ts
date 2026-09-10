import { createDefaultEngine } from "../../core/engine.js"
import { smartRead, type SmartReadOptions } from "../../tools/smart-read.js"
import { registerHooks } from "./hooks.js"
import type { OpenCodePluginContext, OpenCodeToolDefinition } from "./types.js"

function parseReadArgs(args: Record<string, unknown>): {
  path: string
  options: SmartReadOptions
} {
  const path =
    (typeof args.path === "string" && args.path) ||
    (typeof args.filePath === "string" && args.filePath) ||
    (typeof args.file === "string" && args.file) ||
    ""
  if (!path) throw new Error("read: path is required")

  const options: SmartReadOptions = {}
  if (typeof args.offset === "number") options.offset = args.offset
  if (typeof args.limit === "number") options.limit = args.limit
  if (typeof args.startLine === "number" && typeof args.endLine === "number") {
    options.range = { startLine: args.startLine, endLine: args.endLine }
  } else if (typeof args.lines === "string") {
    const m = args.lines.match(/^(\d+)-(\d+)$/)
    if (m) options.range = { startLine: Number(m[1]), endLine: Number(m[2]) }
  } else if (args.range && typeof args.range === "object") {
    const r = args.range as Record<string, unknown>
    if (typeof r.startLine === "number" && typeof r.endLine === "number") {
      options.range = { startLine: r.startLine, endLine: r.endLine }
    }
  }
  return { path, options }
}

/** Custom `read` tool that takes precedence over the built-in (SPEC section 7.3 / section 10). */
export function createSmartReadTool(): OpenCodeToolDefinition {
  return {
    name: "read",
    description:
      "Smart Read (OCS): returns file content for small/targeted reads, or a semantic_file_map for large files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        offset: { type: "number", description: "0-based line offset" },
        limit: { type: "number", description: "Max lines to return" },
        startLine: { type: "number" },
        endLine: { type: "number" },
        lines: { type: "string", description: "Inclusive range like 10-40" },
      },
      required: ["path"],
    },
    async execute(args: Record<string, unknown>) {
      const { path, options } = parseReadArgs(args)
      return smartRead(path, options)
    },
  }
}

/**
 * OpenCode V2 plugin entry (SPEC section 7).
 * Core must not depend on OpenCode types - keep them here.
 */
export function createOpenCodePlugin() {
  const engine = createDefaultEngine()
  const readTool = createSmartReadTool()

  return {
    id: "opencode-context-shunt",
    /** Expose for tests / hosts that register tools manually */
    tools: [readTool],
    engine,
    async register(ctx: OpenCodePluginContext) {
      const toolApi = ctx.tool
      if (toolApi?.register) toolApi.register(readTool)
      else if (toolApi?.add) toolApi.add(readTool)
      registerHooks(ctx, engine)
    },
  }
}
