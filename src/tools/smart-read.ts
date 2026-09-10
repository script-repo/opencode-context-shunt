/**
 * Smart Read - highest-priority MVP feature (SPEC section 10).
 * Deterministic T0 heuristics only - no LLM required.
 */
import { basename, extname } from "node:path"
import { fingerprint } from "../cache/fingerprint.js"
import type { CacheStore } from "../cache/base.js"
import { smartReadCacheKey } from "../cache/filesystem.js"
import { estimateTokens } from "../core/tokenizer.js"
import {
  DEFAULT_READ_THRESHOLDS,
  resolveReadThresholds,
  type ReadThresholds,
} from "../core/policy.js"
import { readText } from "../util/files.js"

export type SmartReadRange = {
  /** 1-indexed inclusive start line */
  startLine: number
  /** 1-indexed inclusive end line */
  endLine: number
}

export type SmartReadOptions = {
  range?: SmartReadRange
  /** Offset/limit style (0-indexed offset, count of lines) - OpenCode-friendly */
  offset?: number
  limit?: number
  thresholds?: Partial<ReadThresholds>
  /** Pre-loaded content (tests / adapters); skips filesystem when set */
  content?: string
  /** Optional cache store for semantic_file_map hit/miss (SPEC §17) */
  cache?: CacheStore
  /** Schema/reducer version for cache keying */
  cacheSchemaVersion?: string
}

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "const"
  | "type"
  | "interface"
  | "enum"
  | "export"
  | "other"

export type FileSymbol = {
  name: string
  kind: SymbolKind
  range: string
}

export type MaterialFinding = {
  severity: "low" | "medium" | "high"
  summary: string
  range: string
}

export type SemanticFileMap = {
  type: "semantic_file_map"
  path: string
  fingerprint: string
  lines: number
  estimated_tokens: number
  language: string
  purpose: string
  symbols: FileSymbol[]
  dependencies: string[]
  material_findings?: MaterialFinding[]
  recommended_ranges: string[]
  /** Present for huge/generated index-only maps */
  mode?: "full_map" | "index_extract"
  /** True when served from filesystem cache */
  cache_hit?: boolean
}

export type SmartReadContentResult = {
  type: "content"
  path: string
  fingerprint: string
  lines: number
  estimated_tokens: number
  range?: string
  content: string
}

export type SmartReadResult = SmartReadContentResult | SemanticFileMap

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".md": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".sh": "shell",
  ".bash": "shell",
  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".vue": "vue",
  ".svelte": "svelte",
}

function detectLanguage(path: string): string {
  return EXT_LANG[extname(path).toLowerCase()] ?? "text"
}

function formatRange(start: number, end: number): string {
  return start === end ? `${start}` : `${start}-${end}`
}

function resolveRange(
  opts: SmartReadOptions | undefined,
  totalLines: number,
): SmartReadRange | undefined {
  if (!opts) return undefined
  if (opts.range) {
    const startLine = Math.max(1, opts.range.startLine)
    const endLine = Math.min(totalLines, Math.max(startLine, opts.range.endLine))
    return { startLine, endLine }
  }
  if (opts.offset != null || opts.limit != null) {
    const offset = Math.max(0, opts.offset ?? 0)
    const startLine = offset + 1
    // Past EOF: preserve requested offset and return an empty slice (not last line).
    if (totalLines === 0 || startLine > totalLines) {
      return { startLine, endLine: startLine - 1 }
    }
    const endLine =
      opts.limit != null
        ? Math.min(totalLines, offset + opts.limit)
        : totalLines
    return { startLine, endLine: Math.max(startLine, endLine) }
  }
  return undefined
}

function sliceLines(lines: string[], range: SmartReadRange): string {
  return lines.slice(range.startLine - 1, range.endLine).join("\n")
}

/** Heuristic purpose from path + first comments / exports. */
function inferPurpose(path: string, content: string, language: string): string {
  const base = basename(path)
  const lower = path.toLowerCase()
  if (/test|spec|__tests__/i.test(lower)) return `Tests for ${base}`
  if (/config|settings/i.test(lower)) return `Configuration (${base})`
  if (/index\.(ts|js|tsx|jsx)$/i.test(base)) return `Module entry / barrel (${path})`
  if (/readme/i.test(base)) return "Project documentation"
  if (/migrat/i.test(lower)) return `Database / schema migration (${base})`
  if (/generated|dist\/|\.min\./i.test(lower)) return `Generated or bundled artifact (${base})`

  const comment =
    content.match(/^\s*\/\*\*?\s*([\s\S]*?)\*\//)?.[1] ??
    content.match(/^\s*\/\/\s*(.+)$/m)?.[1] ??
    content.match(/^\s*#\s*(.+)$/m)?.[1]
  if (comment) {
    const one = comment
      .replace(/\s*\*\s?/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120)
    if (one.length > 8) return one
  }

  if (language === "typescript" || language === "javascript") {
    if (/\b(express|fastify|koa|hono)\b/i.test(content)) return `HTTP / API module (${base})`
    if (/\breact|jsx|tsx\b/i.test(content) || extname(path) === ".tsx")
      return `UI / React module (${base})`
  }
  return `${language} source file (${base})`
}

type RawSymbol = { name: string; kind: SymbolKind; line: number }

/** Deterministic regex symbol extraction (T0). */
export function extractSymbols(content: string, language: string): FileSymbol[] {
  const lines = content.split(/\r?\n/)
  const found: RawSymbol[] = []
  const push = (name: string, kind: SymbolKind, line: number) => {
    if (!name || name === "default") return
    found.push({ name, kind, line })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const n = i + 1

    // JS/TS
    let m =
      line.match(
        /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/,
      ) ??
      line.match(
        /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
      )
    if (m) {
      push(m[1]!, m[0]!.includes("class") ? "class" : "function", n)
      continue
    }
    m = line.match(
      /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b)/,
    )
    if (m) {
      push(m[1]!, "function", n)
      continue
    }
    m = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/)
    if (m && /export/.test(line)) {
      push(m[1]!, "const", n)
      continue
    }
    m =
      line.match(/^\s*(?:export\s+)?(?:type)\s+([A-Za-z_$][\w$]*)\b/) ??
      line.match(/^\s*(?:export\s+)?(?:interface)\s+([A-Za-z_$][\w$]*)\b/) ??
      line.match(/^\s*(?:export\s+)?(?:enum)\s+([A-Za-z_$][\w$]*)\b/)
    if (m) {
      const kind: SymbolKind = line.includes("interface")
        ? "interface"
        : line.includes("enum")
          ? "enum"
          : "type"
      push(m[1]!, kind, n)
      continue
    }
    // class methods (simple indent heuristic)
    m = line.match(
      /^\s+(?:public|private|protected|static|async|readonly|\s)*\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*[:{]/,
    )
    if (m && !/^(if|for|while|switch|catch|return|function|class)$/.test(m[1]!)) {
      push(m[1]!, "method", n)
      continue
    }

    // Python
    if (language === "python") {
      m = line.match(/^\s*def\s+([A-Za-z_][\w]*)\s*\(/)
      if (m) {
        push(m[1]!, line.match(/^\s{0,3}def/) ? "function" : "method", n)
        continue
      }
      m = line.match(/^class\s+([A-Za-z_][\w]*)\s*[:(]/)
      if (m) {
        push(m[1]!, "class", n)
        continue
      }
    }

    // Go
    if (language === "go") {
      m = line.match(/^func\s+(?:\([^)]+\)\s*)?([A-Za-z_][\w]*)\s*\(/)
      if (m) {
        push(m[1]!, "function", n)
        continue
      }
      m = line.match(/^type\s+([A-Za-z_][\w]*)\s+(?:struct|interface)\b/)
      if (m) {
        push(m[1]!, "type", n)
        continue
      }
    }

    // Rust
    if (language === "rust") {
      m = line.match(/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)\s*[<(]/)
      if (m) {
        push(m[1]!, "function", n)
        continue
      }
      m = line.match(/^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_][\w]*)/)
      if (m) {
        push(m[1]!, line.includes("struct") || line.includes("enum") ? "class" : "type", n)
        continue
      }
    }
  }

  // Estimate end ranges: next symbol line - 1, or +40 lines cap
  const out: FileSymbol[] = []
  for (let i = 0; i < found.length; i++) {
    const cur = found[i]!
    const next = found[i + 1]
    const end = next ? Math.max(cur.line, next.line - 1) : Math.min(lines.length, cur.line + 40)
    out.push({ name: cur.name, kind: cur.kind, range: formatRange(cur.line, end) })
  }
  return dedupeSymbols(out)
}

function dedupeSymbols(symbols: FileSymbol[]): FileSymbol[] {
  const seen = new Set<string>()
  const out: FileSymbol[] = []
  for (const s of symbols) {
    const key = `${s.kind}:${s.name}:${s.range}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/** Extract import / dependency names. */
export function extractDependencies(content: string, language: string): string[] {
  const deps = new Set<string>()
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    let m =
      line.match(/^\s*import\s+.+?\s+from\s+['"]([^'"]+)['"]/) ??
      line.match(/^\s*import\s+['"]([^'"]+)['"]/) ??
      line.match(/^\s*const\s+\w+\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/) ??
      line.match(/^\s*export\s+.+?\s+from\s+['"]([^'"]+)['"]/)
    if (m) {
      deps.add(m[1]!)
      continue
    }
    if (language === "python") {
      m = line.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/)
      if (m) {
        deps.add((m[1] ?? m[2])!)
        continue
      }
    }
    if (language === "go") {
      m = line.match(/^\s*"([^"]+)"\s*$/)
      if (m && /[./]/.test(m[1]!)) {
        deps.add(m[1]!)
        continue
      }
    }
    if (language === "rust") {
      m = line.match(/^\s*use\s+([\w:]+)/)
      if (m) {
        deps.add(m[1]!)
        continue
      }
    }
  }
  return [...deps]
}

function heuristicFindings(content: string, lines: string[]): MaterialFinding[] {
  const findings: MaterialFinding[] = []
  const patterns: Array<{ re: RegExp; severity: MaterialFinding["severity"]; summary: string }> = [
    { re: /\beval\s*\(/, severity: "high", summary: "Dynamic eval() usage" },
    { re: /\binnerHTML\s*=/, severity: "medium", summary: "innerHTML assignment (XSS risk)" },
    { re: /\bpassword\s*[:=]/i, severity: "medium", summary: "Hard-coded or inline password reference" },
    { re: /\bTODO\b|\bFIXME\b/, severity: "low", summary: "Outstanding TODO/FIXME" },
    { re: /\bany\b/, severity: "low", summary: "TypeScript any usage nearby" },
    {
      re: /\b(mutex|lock|shared|cache)\b/i,
      severity: "medium",
      summary: "Shared mutable state / cache mutation hint",
    },
  ]
  // Only scan a sample for huge files - caller may pass truncated content
  const limit = Math.min(lines.length, 5000)
  for (let i = 0; i < limit; i++) {
    const line = lines[i]!
    for (const p of patterns) {
      if (p.re.test(line)) {
        findings.push({
          severity: p.severity,
          summary: p.summary,
          range: formatRange(i + 1, i + 1),
        })
        break
      }
    }
    if (findings.length >= 12) break
  }
  void content
  return findings
}

function isHugeOrGenerated(path: string, tokens: number, thresholds: ReadThresholds): boolean {
  if (tokens >= thresholds.huge_file_min_tokens) return true
  const lower = path.toLowerCase()
  return (
    /\.(min|bundle|generated)\./i.test(lower) ||
    /\/(dist|build|generated|vendor)\//i.test(lower) ||
    /\.lock$/i.test(lower) ||
    lower.endsWith("package-lock.json") ||
    lower.endsWith("pnpm-lock.yaml") ||
    lower.endsWith("yarn.lock")
  )
}

function buildSemanticMap(
  path: string,
  content: string,
  lines: string[],
  fp: string,
  tokens: number,
  thresholds: ReadThresholds,
  indexOnly: boolean,
): SemanticFileMap {
  const language = detectLanguage(path)
  let symbols = extractSymbols(content, language)
  let dependencies = extractDependencies(content, language)
  let findings = heuristicFindings(content, lines)

  if (indexOnly) {
    symbols = symbols.slice(0, 25)
    dependencies = dependencies.slice(0, 20)
    findings = findings.filter((f) => f.severity !== "low").slice(0, 5)
  } else {
    symbols = symbols.slice(0, 80)
    dependencies = dependencies.slice(0, 40)
  }

  const recommended = [
    ...symbols.slice(0, indexOnly ? 5 : 8).map((s) => s.range),
    ...findings.slice(0, 3).map((f) => f.range),
  ]
  // unique preserve order
  const seen = new Set<string>()
  const recommended_ranges: string[] = []
  for (const r of recommended) {
    if (seen.has(r)) continue
    seen.add(r)
    recommended_ranges.push(r)
  }
  if (recommended_ranges.length === 0 && lines.length > 0) {
    const end = Math.min(lines.length, 40)
    recommended_ranges.push(formatRange(1, end))
  }

  const map: SemanticFileMap = {
    type: "semantic_file_map",
    path,
    fingerprint: `sha256:${fp}`,
    lines: lines.length,
    estimated_tokens: tokens,
    language,
    purpose: inferPurpose(path, content, language),
    symbols,
    dependencies,
    recommended_ranges,
    mode: indexOnly ? "index_extract" : "full_map",
  }
  if (findings.length) map.material_findings = findings
  return enforceSummaryBudget(map, thresholds.maximum_summary_tokens)
}

/** Trim optional map fields until JSON estimateTokens <= budget. */
function enforceSummaryBudget(map: SemanticFileMap, budget: number): SemanticFileMap {
  const measure = (m: SemanticFileMap) => estimateTokens(JSON.stringify(m))
  if (measure(map) <= budget) return map

  const next: SemanticFileMap = { ...map }
  // Drop optional / bulky fields first
  if (next.material_findings) {
    delete next.material_findings
    if (measure(next) <= budget) return next
  }
  while (next.dependencies.length > 0 && measure(next) > budget) {
    next.dependencies = next.dependencies.slice(0, -1)
  }
  if (measure(next) <= budget) return next
  while (next.symbols.length > 0 && measure(next) > budget) {
    next.symbols = next.symbols.slice(0, -1)
  }
  if (measure(next) <= budget) return next
  while (next.recommended_ranges.length > 1 && measure(next) > budget) {
    next.recommended_ranges = next.recommended_ranges.slice(0, -1)
  }
  if (measure(next) <= budget) return next
  // Last resort: shorten purpose
  while (next.purpose.length > 24 && measure(next) > budget) {
    next.purpose = next.purpose.slice(0, Math.max(24, Math.floor(next.purpose.length * 0.7))) + "…"
  }
  return next
}


async function loadOrBuildSemanticMap(
  path: string,
  content: string,
  lines: string[],
  fp: string,
  tokens: number,
  thresholds: ReadThresholds,
  indexOnly: boolean,
  cache?: CacheStore,
  schemaVersion?: string,
): Promise<SemanticFileMap> {
  const key = smartReadCacheKey({
    path,
    contentFingerprint: fp,
    reducerId: "smart-read",
    schemaVersion: schemaVersion ?? "1",
  })
  if (cache) {
    const hit = await cache.get(key)
    if (hit) {
      try {
        const parsed = JSON.parse(hit) as SemanticFileMap
        if (parsed && parsed.type === "semantic_file_map") {
          return { ...parsed, cache_hit: true }
        }
      } catch {
        // SPEC §27: discard corrupt cache entry
      }
    }
  }
  const map = buildSemanticMap(path, content, lines, fp, tokens, thresholds, indexOnly)
  if (cache) {
    try {
      // Persist without ephemeral cache_hit flag
      const { cache_hit: _omit, ...toStore } = map as SemanticFileMap & { cache_hit?: boolean }
      void _omit
      await cache.set(key, JSON.stringify(toStore))
    } catch {
      // cache write failures must not break reads
    }
  }
  return map
}

/**
 * Smart Read entry point.
 * - small file OR targeted small range -> full/ranged text content
 * - large file -> semantic_file_map
 * - huge/generated -> index/extract only (shorter map)
 */
export async function smartRead(
  path: string,
  options?: SmartReadOptions,
): Promise<SmartReadResult> {
  const thresholds = resolveReadThresholds(options?.thresholds ?? null)
  const content = options?.content ?? (await readText(path))
  const lines = content.length === 0 ? (content === "" ? [] : [""]) : content.split(/\r?\n/)
  // Preserve trailing semantics: split always yields at least one element for non-empty;
  // empty string -> 0 lines for token/line accounting of empty files.
  const lineCount = content === "" ? 0 : lines.length
  const normalizedLines = content === "" ? [] : lines
  const fp = fingerprint([path, content])
  const fullTokens = estimateTokens(content)
  const range = resolveRange(options, lineCount)

  // Targeted range path
  if (range) {
    // Empty / past-EOF range: do not invent content
    if (range.endLine < range.startLine || lineCount === 0) {
      return {
        type: "content",
        path,
        fingerprint: `sha256:${fp}`,
        lines: 0,
        estimated_tokens: 0,
        range: formatRange(range.startLine, Math.max(range.endLine, range.startLine - 1)),
        content: "",
      }
    }
    const ranged = sliceLines(normalizedLines, range)
    const rangedTokens = estimateTokens(ranged)
    const rangeLineCount = range.endLine - range.startLine + 1
    const withinBudget =
      rangedTokens <= thresholds.targeted_range_max_tokens &&
      (rangeLineCount <= thresholds.direct_max_lines ||
        rangedTokens <= thresholds.direct_max_tokens)
    if (withinBudget) {
      return {
        type: "content",
        path,
        fingerprint: `sha256:${fp}`,
        lines: rangeLineCount,
        estimated_tokens: rangedTokens,
        range: formatRange(range.startLine, range.endLine),
        content: ranged,
      }
    }
    // Large targeted range still returns content if under targeted_range_max_tokens
    if (rangedTokens <= thresholds.targeted_range_max_tokens) {
      return {
        type: "content",
        path,
        fingerprint: `sha256:${fp}`,
        lines: rangeLineCount,
        estimated_tokens: rangedTokens,
        range: formatRange(range.startLine, range.endLine),
        content: ranged,
      }
    }
    // Range itself is huge - map the file instead (caller should narrow)
    return loadOrBuildSemanticMap(
      path,
      content,
      normalizedLines,
      fp,
      fullTokens,
      thresholds,
      isHugeOrGenerated(path, fullTokens, thresholds),
      options?.cache,
      options?.cacheSchemaVersion,
    )
  }

  // Full-file path
  const isSmall =
    lineCount <= thresholds.direct_max_lines && fullTokens <= thresholds.direct_max_tokens

  if (isSmall) {
    return {
      type: "content",
      path,
      fingerprint: `sha256:${fp}`,
      lines: lineCount,
      estimated_tokens: fullTokens,
      content,
    }
  }

  const huge = isHugeOrGenerated(path, fullTokens, thresholds)
  // semantic_map_min_lines gate: at/above -> map (already not small)
  void thresholds.semantic_map_min_lines
  return loadOrBuildSemanticMap(
    path,
    content,
    normalizedLines,
    fp,
    fullTokens,
    thresholds,
    huge,
    options?.cache,
    options?.cacheSchemaVersion,
  )
}

export { DEFAULT_READ_THRESHOLDS }
