import type { WorkerResult } from "./base.js"

export async function runTransientModel(_task: string): Promise<WorkerResult> {
  throw new Error("transient-model worker: not implemented")
}
