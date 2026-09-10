/** Code Writer — write to disk without dumping source into primary context (SPEC §14). */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export type CodeWriteArgs = {
  path: string
  content: string
}

export type CodeWriteResult = {
  status: "created"
  path: string
  bytes: number
  lines_written: number
}

/**
 * Write generated content directly to disk. The primary model MUST NOT
 * receive the file content back — only a compact confirmation.
 */
export async function codeWrite(args: CodeWriteArgs): Promise<CodeWriteResult> {
  const { path, content } = args
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf8")

  return {
    status: "created",
    path,
    bytes: Buffer.byteLength(content, "utf8"),
    lines_written: content.length === 0 ? 0 : content.split("\n").length,
  }
}
