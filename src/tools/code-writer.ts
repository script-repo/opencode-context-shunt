/** Code Writer — write to disk without dumping source into primary context (SPEC §14). */
export async function codeWrite(_args: {
  path: string
  content: string
}): Promise<{ path: string; bytes: number }> {
  throw new Error("codeWrite: not implemented")
}
