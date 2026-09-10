export interface OcsPolicy {
  version: number
  mode: "dry-run" | "enforce"
}

export function loadPolicy(_path?: string): OcsPolicy {
  return { version: 1, mode: "dry-run" }
}
