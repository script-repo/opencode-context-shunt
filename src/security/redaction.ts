const SECRET = /(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^\s"']+/gi

export function redactSecrets(text: string): string {
  return text.replace(SECRET, "$1=[REDACTED]")
}
