import {
  DEFAULT_READ_THRESHOLDS,
  type PolicySchema,
  type ReadThresholds,
} from "../schemas/policy.js"

export type { ReadThresholds }
export { DEFAULT_READ_THRESHOLDS }

export interface OcsPolicy {
  version: number
  mode: "dry-run" | "enforce"
  read: ReadThresholds
  raw?: PolicySchema
}

function mergeReadThresholds(
  overrides?: Partial<ReadThresholds> & {
    targeted_max_tokens?: number
    maximum_return_tokens?: number
  },
): ReadThresholds {
  const base = { ...DEFAULT_READ_THRESHOLDS }
  if (!overrides) return base
  if (overrides.direct_max_lines != null) base.direct_max_lines = overrides.direct_max_lines
  if (overrides.direct_max_tokens != null) base.direct_max_tokens = overrides.direct_max_tokens
  if (overrides.semantic_map_min_lines != null)
    base.semantic_map_min_lines = overrides.semantic_map_min_lines
  if (overrides.huge_file_min_tokens != null)
    base.huge_file_min_tokens = overrides.huge_file_min_tokens
  if (overrides.targeted_range_max_tokens != null)
    base.targeted_range_max_tokens = overrides.targeted_range_max_tokens
  else if (overrides.targeted_max_tokens != null)
    base.targeted_range_max_tokens = overrides.targeted_max_tokens
  if (overrides.maximum_summary_tokens != null)
    base.maximum_summary_tokens = overrides.maximum_summary_tokens
  else if (overrides.maximum_return_tokens != null)
    base.maximum_summary_tokens = overrides.maximum_return_tokens
  return base
}

/** Resolve Smart Read thresholds from a policy object / override bag. */
export function resolveReadThresholds(
  policyOrOverrides?: PolicySchema | Partial<ReadThresholds> | null,
): ReadThresholds {
  if (!policyOrOverrides) return { ...DEFAULT_READ_THRESHOLDS }
  const p = policyOrOverrides as PolicySchema & Partial<ReadThresholds>
  // Prefer tools.read / read sections when present (ocs.example.yaml / SPEC)
  if (p.tools?.read || p.read) {
    return mergeReadThresholds({ ...(p.read ?? {}), ...(p.tools?.read ?? {}) })
  }
  // Flat override object
  if (
    "direct_max_lines" in p ||
    "direct_max_tokens" in p ||
    "semantic_map_min_lines" in p ||
    "huge_file_min_tokens" in p ||
    "targeted_range_max_tokens" in p ||
    "maximum_summary_tokens" in p
  ) {
    return mergeReadThresholds(p)
  }
  return { ...DEFAULT_READ_THRESHOLDS }
}

/**
 * Load policy. MVP: returns defaults; optional override object may be passed
 * instead of a filesystem path. YAML path loading can be wired later.
 */
export function loadPolicy(pathOrOverrides?: string | PolicySchema | Partial<ReadThresholds>): OcsPolicy {
  if (pathOrOverrides && typeof pathOrOverrides === "object") {
    const raw = pathOrOverrides as PolicySchema
    return {
      version: typeof raw.version === "number" ? raw.version : 1,
      mode: raw.mode === "enforce" ? "enforce" : "dry-run",
      read: resolveReadThresholds(raw),
      raw: "version" in raw ? raw : undefined,
    }
  }
  // Path string ignored for MVP filesystem YAML parse - hardcode defaults
  void pathOrOverrides
  return {
    version: 1,
    mode: "dry-run",
    read: { ...DEFAULT_READ_THRESHOLDS },
  }
}
