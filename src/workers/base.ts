export type Tier = "T0" | "T1" | "T2" | "T3"

export interface WorkerResult {
  tier: Tier
  output: string
  confidence?: number
}

export type EscalationResult = {
  status: "escalate"
  reason: string
  confidence: number
  recommended_tier: Tier
  required_context?: Array<{ path: string; range?: string }>
}

export type WorkerOutcome =
  | { status: "ok"; result: WorkerResult }
  | EscalationResult

export interface WorkerRequest {
  task: string
  input?: string
  tier?: Tier
  metadata?: Record<string, unknown>
}
