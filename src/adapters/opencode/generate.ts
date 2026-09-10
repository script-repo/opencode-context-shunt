import type { OpenCodePluginContext } from "./types.js"

/** Transient worker generation via ctx.generate.text (SPEC §7.4). */
export async function generateWithModel(
  args: { providerID: string; id: string; prompt: string },
  ctx?: OpenCodePluginContext,
): Promise<string> {
  const generate = ctx?.generate?.text
  if (!generate) {
    throw new Error("generateWithModel: OpenCode generate ctx unavailable")
  }
  const result = await generate({
    model: { providerID: args.providerID, id: args.id },
    prompt: args.prompt,
  })
  if (typeof result === "string") return result
  if (result && typeof result === "object" && typeof result.text === "string") return result.text
  return ""
}

export function bindGenerate(ctx: OpenCodePluginContext) {
  return (args: { providerID: string; id: string; prompt: string }) =>
    generateWithModel(args, ctx)
}
