import type { WorkerResult } from "./base.js"

export async function runDeterministic(_task: string): Promise<WorkerResult> {
  throw new Error("deterministic worker: not implemented")
}
