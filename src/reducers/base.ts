export interface ReducerResult {
  summary: string
  tokensIn: number
  tokensOut: number
  metadata?: Record<string, unknown>
}

export interface Reducer {
  name: string
  reduce(input: string): Promise<ReducerResult>
}
