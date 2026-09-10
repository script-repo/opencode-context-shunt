/** Transient worker generation via ctx.generate.text (SPEC §7.4). */
export async function generateWithModel(_args: {
  providerID: string
  id: string
  prompt: string
}): Promise<string> {
  throw new Error("generateWithModel: not implemented (needs OpenCode ctx)")
}
