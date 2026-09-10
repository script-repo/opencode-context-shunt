/** Approximate token estimator for MVP (SPEC §26). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
