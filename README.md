# OpenCode Context Shunt (OCS)

Policy-driven context virtualization layer for OpenCode.

**Package:** `opencode-context-shunt`  
**Spec:** [`docs/SPEC.md`](docs/SPEC.md)

## Goal

Keep frontier models on reasoning. Divert large or low-value context (reads, shell, git, k8s, CI, logs, MCP, …) through cheaper tiers: deterministic (T0), local SLM (T1), cheap LLM (T2), escalate to frontier (T3) only when needed.

## Layout

Matches the engineering spec (§23):

- `src/adapters/opencode` — thin OpenCode V2 plugin adapter
- `src/core` — engine, classifier, policy, governor, tokenizer
- `src/tools` — Smart Read, Code Writer
- `src/reducers`, `src/workers`, `src/cache`, `src/security`, `src/telemetry`

## Local workspace (lab-hp)

```text
/home/lab/code/github.com/script-repo/opencode-context-shunt
```

## Status

Scaffold only — Phase 1 core stubs. Implement against `docs/SPEC.md` MVP phases.

```bash
npm install
npm run typecheck
npm test
```
