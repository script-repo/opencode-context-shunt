import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { codeWrite } from "../../src/tools/code-writer.js"

describe("codeWrite", () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it("writes file to disk and returns compact result without content", async () => {
    dir = await mkdtemp(join(tmpdir(), "ocs-cw-"))
    const path = join(dir, "nested", "out.ts")
    const content = "export const x = 1\n"

    const result = await codeWrite({ path, content })

    expect(result.path).toBe(path)
    expect(result.bytes).toBe(Buffer.byteLength(content, "utf8"))
    expect(result.lines_written).toBe(2)
    expect(result.status).toBe("created")
    expect(Object.keys(result).includes("content")).toBe(false)
    expect((result as { content?: string }).content).toBeUndefined()

    const onDisk = await readFile(path, "utf8")
    expect(onDisk).toBe(content)
  })

  it("creates parent directories as needed", async () => {
    dir = await mkdtemp(join(tmpdir(), "ocs-cw-"))
    const path = join(dir, "a", "b", "c.txt")
    await codeWrite({ path, content: "hi" })
    expect(await readFile(path, "utf8")).toBe("hi")
  })
})
