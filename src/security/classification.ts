export type DataClass = "public" | "internal" | "confidential" | "restricted"

export function classifyPath(_path: string): DataClass {
  return "internal"
}
