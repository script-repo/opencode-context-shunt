/** Minimal adapter-facing OpenCode types — keep OpenCode SDK out of core. */
export interface OpenCodePluginContext {
  // Populated when OpenCode V2 plugin API is wired.
  [key: string]: unknown
}
