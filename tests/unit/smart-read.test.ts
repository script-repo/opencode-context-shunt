import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  smartRead,
  extractSymbols,
  extractDependencies,
  DEFAULT_READ_THRESHOLDS,
} from "../../src/tools/smart-read.js"
import { resolveReadThresholds } from "../../src/core/policy.js"
import { createOpenCodePlugin, createSmartReadTool } from "../../src/adapters/opencode/plugin.js"
import { createDefaultEngine } from "../../src/core/engine.js"

function makeLines(n: number, prefix = "line"): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join("\n")
}

describe("smartRead", () => {
  it("small file pass-through returns content", async () => {
    const content = "export function hello() {\n  return 1\n}\n"
    const result = await smartRead("src/hello.ts", { content })
    expect(result.type).toBe("content")
    if (result.type !== "content") return
    expect(result.content).toBe(content)
    expect(result.path).toBe("src/hello.ts")
    expect(result.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(result.lines).toBeGreaterThan(0)
    expect(result.estimated_tokens).toBeGreaterThan(0)
  })

  it("large file returns semantic_file_map shape", async () => {
    const body = [
      "import { TokenProvider } from './tokens'",
      "import { UserRepository } from './users'",
      "",
      "/** Authentication and session lifecycle service */",
      "export class AuthService {",
      "  async authenticate(user: string) {",
      "    return user",
      "  }",
      "  refreshToken() {",
      "    // shared refresh-token cache mutation",
      "    return null",
      "  }",
      "}",
      "",
      "export function helper() { return 1 }",
      "export const FLAG = true",
      "export type AuthResult = { ok: boolean }",
      "export interface Session { id: string }",
    ]
    while (body.length < 300) body.push(`// pad ${body.length}`)
    const content = body.join("\n")
    const result = await smartRead("src/auth/service.ts", { content })
    expect(result.type).toBe("semantic_file_map")
    if (result.type !== "semantic_file_map") return
    expect(result.path).toBe("src/auth/service.ts")
    expect(result.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(result.lines).toBeGreaterThanOrEqual(251)
    expect(result.estimated_tokens).toBeGreaterThan(0)
    expect(result.language).toBe("typescript")
    expect(typeof result.purpose).toBe("string")
    expect(Array.isArray(result.symbols)).toBe(true)
    expect(result.symbols.some((s) => s.name === "AuthService" && s.kind === "class")).toBe(true)
    expect(result.symbols.some((s) => s.name === "helper")).toBe(true)
    expect(Array.isArray(result.dependencies)).toBe(true)
    expect(result.dependencies).toContain("./tokens")
    expect(Array.isArray(result.recommended_ranges)).toBe(true)
    expect(result.recommended_ranges.length).toBeGreaterThan(0)
  })

  it("threshold boundary: 250 lines -> content, 251 -> map", async () => {
    const small = makeLines(250)
    const atMinMap = makeLines(251)
    const r250 = await smartRead("a.ts", {
      content: small,
      thresholds: { ...DEFAULT_READ_THRESHOLDS, direct_max_tokens: 100_000 },
    })
    const r251 = await smartRead("a.ts", {
      content: atMinMap,
      thresholds: { ...DEFAULT_READ_THRESHOLDS, direct_max_tokens: 100_000 },
    })
    expect(r250.type).toBe("content")
    expect(r251.type).toBe("semantic_file_map")
  })

  it("targeted small range returns ranged content even for large files", async () => {
    const content = makeLines(500, "row")
    const result = await smartRead("big.ts", {
      content,
      range: { startLine: 10, endLine: 20 },
    })
    expect(result.type).toBe("content")
    if (result.type !== "content") return
    expect(result.range).toBe("10-20")
    expect(result.content.split("\n")).toHaveLength(11)
    expect(result.content).toContain("row 10")
    expect(result.content).toContain("row 20")
  })

  it("huge file uses index_extract mode", async () => {
    const content = "x".repeat(80_000) + "\n" + makeLines(100, "fn")
    const result = await smartRead("dist/bundle.min.js", {
      content,
      thresholds: { huge_file_min_tokens: 20000 },
    })
    expect(result.type).toBe("semantic_file_map")
    if (result.type !== "semantic_file_map") return
    expect(result.mode).toBe("index_extract")
  })

  it("respects threshold overrides", async () => {
    const content = makeLines(30)
    const result = await smartRead("tiny.ts", {
      content,
      thresholds: { direct_max_lines: 10, direct_max_tokens: 5 },
    })
    expect(result.type).toBe("semantic_file_map")
  })

  it("reads from filesystem when content not provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ocs-sr-"))
    const file = join(dir, "sample.ts")
    const body = "export const n = 1\n"
    await writeFile(file, body, "utf8")
    const result = await smartRead(file)
    expect(result.type).toBe("content")
    if (result.type === "content") expect(result.content).toBe(body)
  })
})

describe("extractSymbols / extractDependencies", () => {
  it("extracts JS/TS symbols and imports", () => {
    const src = `
import Foo from './foo'
export function bar() {}
export class Baz {}
export const qux = () => 1
export type T = string
export interface I { x: number }
`
    const symbols = extractSymbols(src, "typescript")
    const names = symbols.map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(["bar", "Baz", "qux", "T", "I"]))
    const deps = extractDependencies(src, "typescript")
    expect(deps).toContain("./foo")
  })
})

describe("resolveReadThresholds", () => {
  it("defaults match SPEC section 10.2", () => {
    const t = resolveReadThresholds()
    expect(t.direct_max_lines).toBe(250)
    expect(t.direct_max_tokens).toBe(4000)
    expect(t.semantic_map_min_lines).toBe(251)
    expect(t.huge_file_min_tokens).toBe(20000)
    expect(t.targeted_range_max_tokens).toBe(6000)
    expect(t.maximum_summary_tokens).toBe(1500)
  })

  it("merges tools.read aliases", () => {
    const t = resolveReadThresholds({
      version: 1,
      mode: "enforce",
      tools: { read: { targeted_max_tokens: 7000, maximum_return_tokens: 900 } },
    })
    expect(t.targeted_range_max_tokens).toBe(7000)
    expect(t.maximum_summary_tokens).toBe(900)
  })
})

describe("OpenCode read override", () => {
  it("plugin registers custom read that calls smartRead", async () => {
    const plugin = createOpenCodePlugin()
    expect(plugin.tools[0]?.name).toBe("read")
    const registered: { name: string }[] = []
    await plugin.register({
      tool: {
        register(tool) {
          registered.push(tool)
        },
      },
    })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.name).toBe("read")

    const dir = await mkdtemp(join(tmpdir(), "ocs-tool-"))
    const file = join(dir, "t.ts")
    await writeFile(file, "export const ok = true\n", "utf8")
    const tool = createSmartReadTool()
    const out = (await tool.execute({ path: file })) as { type: string; content?: string }
    expect(out.type).toBe("content")
    expect(out.content).toContain("ok")
  })

  it("engine routes read to smart-read reducer", async () => {
    const engine = createDefaultEngine()
    const small = await engine.decide({
      sessionId: "s",
      tool: "read",
      operation: "execute",
      input: { path: "a.ts", content: "hi" },
    })
    expect(small.reducer).toBe("smart-read")
    expect(small.action).toBe("pass")

    const large = await engine.decide({
      sessionId: "s",
      tool: "read",
      operation: "execute",
      input: { path: "big.ts", estimated_tokens: 50_000 },
    })
    expect(large.reducer).toBe("smart-read")
    expect(large.action).toBe("compress")
  })
})

describe("fingerprint stability", () => {
  it("content fingerprint is deterministic", async () => {
    const content = "abc"
    const a = await smartRead("p.ts", { content })
    const b = await smartRead("p.ts", { content })
    expect(a.fingerprint).toBe(b.fingerprint)
    const hex = a.fingerprint.replace(/^sha256:/, "")
    expect(hex).toHaveLength(64)
    expect(createHash("sha256").update("x").digest("hex")).toHaveLength(64)
  })
})
