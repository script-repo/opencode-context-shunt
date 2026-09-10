export interface ModelIdentity {
  providerID: string
  id: string
}

export interface ShuntRequest {
  sessionId: string
  tool: string
  operation: string
  input: unknown
  agent?: string
  model?: ModelIdentity
  directory?: string
  metadata?: Record<string, unknown>
}

export interface ShuntDecision {
  action: "pass" | "compress" | "offload" | "cache" | "block" | "escalate"
  tier?: "T0" | "T1" | "T2" | "T3"
  reducer?: string
  reason: string
  estimatedRawTokens?: number
  maximumReturnTokens?: number
}

export interface ContextShuntEngine {
  decide(request: ShuntRequest): Promise<ShuntDecision>
}

export function createDefaultEngine(): ContextShuntEngine {
  return {
    async decide(request) {
      // MVP placeholder: pass-through. Classifier/policy land in Phase 1.
      return {
        action: "pass",
        tier: "T3",
        reason: `scaffold pass-through for ${request.tool}/${request.operation}`,
      }
    },
  }
}
