/** Minimal adapter-facing OpenCode types - keep OpenCode SDK out of core. */

export type ToolExecuteFn = (args: Record<string, unknown>) => Promise<unknown> | unknown

export interface OpenCodeToolDefinition {
  name: string
  description?: string
  parameters?: Record<string, unknown>
  execute: ToolExecuteFn
}

export interface OpenCodeToolApi {
  /** Register a custom tool; same-name tools take precedence over built-ins (SPEC section 7.3). */
  register?(tool: OpenCodeToolDefinition): void
  add?(tool: OpenCodeToolDefinition): void
  /** Hook registration surface (SPEC section 7.2). */
  hook?(
    event: "execute.before" | "execute.after",
    handler: (event: OpenCodeToolHookEvent) => Promise<void> | void,
  ): void
}

export interface OpenCodeToolHookEvent {
  tool?: string
  name?: string
  input?: unknown
  output?: unknown
  result?: unknown
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface OpenCodePluginContext {
  tool?: OpenCodeToolApi
  session?: {
    hook?(event: string, handler: (...args: unknown[]) => unknown): void
  }
  permission?: {
    hook?(event: string, handler: (...args: unknown[]) => unknown): void
  }
  generate?: {
    text?(args: { model: { providerID: string; id: string }; prompt: string }): Promise<{ text?: string } | string>
  }
  directory?: string
  [key: string]: unknown
}
