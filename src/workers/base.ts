export type Tier = "T0" | "T1" | "T2" | "T3"

export interface WorkerResult {
  tier: Tier
  output: string
  confidence?: number
}
