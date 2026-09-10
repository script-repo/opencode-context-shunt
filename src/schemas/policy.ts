/** Policy / config schema fragments used by the MVP. */

export type ReadThresholds = {
  direct_max_lines: number
  direct_max_tokens: number
  semantic_map_min_lines: number
  huge_file_min_tokens: number
  targeted_range_max_tokens: number
  maximum_summary_tokens: number
}

export const DEFAULT_READ_THRESHOLDS: ReadThresholds = {
  direct_max_lines: 250,
  direct_max_tokens: 4000,
  semantic_map_min_lines: 251,
  huge_file_min_tokens: 20000,
  targeted_range_max_tokens: 6000,
  maximum_summary_tokens: 1500,
}

export type PolicySchema = {
  version: number
  mode: "dry-run" | "enforce"
  thresholds?: Partial<{
    directReadTokens: number
    largeReadTokens: number
    shellOutputTokens: number
    maxReturnTokens: number
  }>
  tools?: {
    read?: Partial<ReadThresholds> & {
      enabled?: boolean
      override_builtin?: boolean
      /** aliases from example YAML / SPEC section 18 */
      targeted_max_tokens?: number
      maximum_return_tokens?: number
    }
  }
  read?: Partial<ReadThresholds>
}
