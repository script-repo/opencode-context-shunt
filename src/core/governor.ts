/** Context budget governor (SPEC §16). */
export function applyBudget(text: string, maxTokens: number): string {
  // Token-accurate truncation arrives with tokenizer; stub is char-based.
  const approxChars = Math.max(32, maxTokens * 4)
  if (text.length <= approxChars) return text
  return text.slice(0, approxChars) + "\n…[ocs: truncated by governor]"
}
