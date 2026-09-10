# OpenCode Context Shunt (OCS)
## Engineering Specification for a Deterministic Context, Cost, and Model-Routing Layer

**Status:** Draft v1.0  
**Target:** OpenCode V2 plugin architecture  
**Primary implementation language:** TypeScript  
**Package name:** `opencode-context-shunt`  
**Intended consumer:** Autonomous coding harness / software engineering agent  
**Date:** 2026-09-09  

---

# 1. Executive Summary

OpenCode Context Shunt (OCS) is a policy-driven context virtualization layer for OpenCode.

Its purpose is to prevent expensive frontier models from consuming large volumes of low-value context or performing mechanical work that can be completed by deterministic code, a local small language model (SLM), or a lower-cost language model.

OCS intercepts tool calls and tool results, evaluates their expected context cost and reasoning requirement, routes low-value work to cheaper execution tiers, compresses or structures the results, caches reusable understanding, and returns only the minimum useful context to the primary OpenCode reasoning agent.

The system mirrors the architectural pattern used by Spotify to reduce frontier-model token consumption in Claude Code, but generalizes the approach across:

- file reads
- repository search
- shell output
- Git output
- logs
- CI/CD output
- Kubernetes
- MCP servers
- databases
- APIs
- observability systems
- generated code
- RAG
- long-running agent sessions

The primary design principle is:

> **The frontier model should reason over information, not transport, parse, summarize, or repeatedly ingest information that a cheaper execution tier can handle.**

OCS should be implemented as a reusable core plus a thin OpenCode adapter so the routing engine can later support other agent harnesses.

---

# 2. Objectives

## 2.1 Primary objectives

OCS MUST:

1. Reduce frontier-model input token consumption.
2. Reduce total inference cost.
3. Preserve or improve task quality.
4. Avoid unnecessary context accumulation in OpenCode sessions.
5. deterministically intercept high-volume context operations.
6. Support multiple execution tiers.
7. Support local, private, and external model endpoints.
8. Cache reusable intermediate understanding.
9. provide measurable token, cost, latency, and routing telemetry.
10. Permit enterprise policy controls such as sovereignty, data classification, RBAC, and approved model lists.
11. Fail safely and permit escalation to the frontier model.
12. avoid requiring the primary LLM to voluntarily follow optimization instructions.

## 2.2 Secondary objectives

OCS SHOULD:

- support domain-specific reducers for infrastructure and operations tools.
- support code generation directly to disk without returning generated source into the primary context.
- support adaptive routing thresholds based on observed workloads.
- support OpenTelemetry-compatible metrics and traces.
- support Prometheus metrics.
- support multiple cache backends.
- support policy configuration without code changes.
- expose a dry-run mode.
- expose a verbose debug mode suitable for development.

---

# 3. Non-Goals

Version 1 is NOT intended to:

- replace OpenCode.
- replace the user's configured primary model.
- build a general-purpose multi-agent orchestration framework.
- provide a full enterprise AI gateway.
- perform training or fine-tuning.
- maintain an independent long-term user memory system.
- automatically send sensitive data to external providers.
- silently modify files unless the invoked workflow explicitly authorizes write operations.
- guarantee lower latency for every routed operation.
- optimize workloads where delegation overhead exceeds expected savings.

---

# 4. Key Concepts

## 4.1 Reasoning plane

The primary OpenCode model and any intentionally selected frontier models.

Typical workloads:

- architecture
- debugging
- security analysis
- ambiguous requirements
- complex edits
- difficult refactoring
- synthesis
- planning
- root-cause analysis

## 4.2 Context data plane

The subsystem that retrieves, filters, summarizes, structures, caches, and delivers context to the reasoning plane.

## 4.3 Execution data plane

The subsystem that performs mechanical or low-reasoning tasks such as:

- file parsing
- search
- JSON extraction
- YAML filtering
- log reduction
- boilerplate generation
- test scaffolding
- low-risk code transformation
- metadata collection

## 4.4 Context shunt

A decision point that diverts large or low-value context away from the frontier model.

## 4.5 Reducer

A component that converts large raw output into smaller structured output.

Example:

```text
47,000-token Kubernetes YAML
        ↓
Kubernetes reducer
        ↓
900-token anomaly summary
```

## 4.6 Semantic map

A compact representation of a large artifact containing purpose, major symbols, dependencies, risks, and relevant ranges.

## 4.7 Escalation

A deliberate handoff from a lower execution tier to a more capable model when confidence, complexity, or policy requires it.

---

# 5. Target Architecture

```text
                          User
                           │
                           ▼
                    OpenCode Session
                           │
                           ▼
                 Primary Reasoning Model
                           │
                       Tool Request
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  OpenCode Context Shunt                     │
│                                                             │
│  L1  OpenCode Adapter / Tool Interception                   │
│                        │                                    │
│  L2  Policy Engine + Workload Classifier                    │
│                        │                                    │
│         ┌──────────────┼───────────────┐                    │
│         │              │               │                    │
│       PASS          COMPRESS         OFFLOAD                │
│         │              │               │                    │
│         │              │      L3 Worker Router              │
│         │              │               │                    │
│         │              │   ┌───────────┼──────────┐         │
│         │              │   │           │          │         │
│         │              │  T0          T1         T2         │
│         │              │ Determ.     SLM      Cheap LLM     │
│         │              │                                   │
│         └──────────────┼───────────────┘                    │
│                        │                                    │
│                L4 Context Transformers                      │
│                        │                                    │
│                L5 Context Governor                          │
│                        │                                    │
│                L6 Cache / Fingerprints                      │
│                        │                                    │
│                L7 Telemetry / FinOps                        │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
                Minimal Useful Context
                         │
                         ▼
                 Primary Reasoner
```

---

# 6. Execution Tiers

OCS MUST support four execution tiers.

| Tier | Name | Typical implementation | Workload |
|---|---|---|---|
| T0 | Deterministic | ripgrep, jq, parsers, AST, scripts | filtering, extraction, counting |
| T1 | Local/Small | local SLM or private endpoint | summarization, classification |
| T2 | Cheap capable model | economical hosted or local model | code generation, transformation |
| T3 | Frontier | primary or designated frontier model | difficult reasoning |

Example routing:

```text
Repository search     -> T0
Large file map        -> T1
Boilerplate tests     -> T2
Concurrency bug       -> T3
Security review       -> T3
```

---

# 7. OpenCode Integration Requirements

## 7.1 Current OpenCode API assumptions

As of 2026-09-09, OpenCode V2 exposes:

- `ctx.tool.hook("execute.before", ...)`
- `ctx.tool.hook("execute.after", ...)`
- `ctx.session.hook("context", ...)`
- `ctx.permission.hook("evaluate", ...)`
- `ctx.shell.hook("create.before", ...)`
- `ctx.generate.text(...)`
- custom tools
- agent configuration
- provider configuration

The OpenCode V2 plugin API is currently beta.

Therefore:

**The OCS core MUST NOT directly depend on OpenCode-specific event types.**

Implement an adapter boundary:

```text
OpenCode Plugin
      │
      ▼
OpenCodeAdapter
      │
      ▼
OCS Core
```

This protects the project from OpenCode API changes.

## 7.2 Tool interception

OCS MUST register `execute.before` and `execute.after` hooks.

Use `execute.before` to:

- inspect invocation metadata.
- classify operations.
- normalize inputs.
- apply hard policy.
- attach internal routing metadata where possible.

Use `execute.after` to:

- inspect successful results.
- intercept excessive output.
- reduce or transform results.
- emit telemetry.
- return modified results to the primary model.

## 7.3 Custom tool replacement

OpenCode supports same-name custom tools taking precedence over built-in tools.

OCS SHOULD replace high-value built-ins where deterministic control is required.

Initial candidates:

- `read`
- optionally `bash`

The first MVP SHOULD override `read`.

Do not override all built-ins initially.

## 7.4 Transient worker generation

Workers SHOULD use:

```typescript
ctx.generate.text({
  model: {
    providerID: "...",
    id: "..."
  },
  prompt: "..."
})
```

This is preferred because OpenCode can generate text with a selected model without creating a normal session, invoking tools, or adding that worker interaction to the primary session history.

This is central to context isolation.

---

# 8. Request Processing Pipeline

Every intercepted operation SHOULD pass through the following pipeline.

```text
1. Capture
2. Normalize
3. Estimate raw token cost
4. Classify workload
5. Evaluate policy
6. Check cache
7. Select execution tier
8. Execute
9. Transform/reduce
10. Validate result
11. Apply context budget
12. Emit telemetry
13. Return result
```

Pseudo-interface:

```typescript
interface ShuntRequest {
  sessionId: string
  tool: string
  operation: string
  input: unknown
  agent?: string
  model?: ModelIdentity
  directory?: string
  metadata?: Record<string, unknown>
}

interface ShuntDecision {
  action:
    | "pass"
    | "compress"
    | "offload"
    | "cache"
    | "block"
    | "escalate"

  tier?: "T0" | "T1" | "T2" | "T3"
  reducer?: string
  reason: string
  estimatedRawTokens?: number
  maximumReturnTokens?: number
}
```

---

# 9. Workload Classification

## 9.1 Inputs

The classifier SHOULD consider:

- tool name
- operation type
- estimated input size
- estimated result size
- file type
- line count
- token count
- user request
- active agent
- current model
- remaining context
- data classification
- cache availability
- historical routing accuracy
- latency budget
- configured model costs
- project-specific policy

## 9.2 Decision classes

The classifier MUST return one of:

```text
PASS
COMPRESS
OFFLOAD
CACHE
BLOCK
ESCALATE
```

## 9.3 Initial heuristic algorithm

Version 1 SHOULD be deterministic and rule-based.

Do not use an LLM to make every routing decision.

Example:

```typescript
if (cacheHit) return CACHE

if (tool === "read" && targetedRange && estimatedTokens < directReadLimit)
  return PASS

if (tool === "read" && estimatedTokens > largeReadThreshold)
  return OFFLOAD

if (tool === "bash" && resultTokens > shellOutputThreshold)
  return COMPRESS

if (riskClass === "security" || complexity === "high")
  return ESCALATE

return PASS
```

## 9.4 Future adaptive classifier

A future release MAY calculate:

```text
ContextCost =
  estimatedTokens
  × frontierInputCost
  × probabilityContextPersists

DelegationCost =
  workerInputCost
  + workerOutputCost
  + latencyPenalty

ExpectedValue =
  contextRelevance
  × reasoningRequirement

Offload when:
  ContextCost - DelegationCost > configured minimum savings
```

---

# 10. Smart Read

Smart Read is the highest-priority MVP feature.

## 10.1 Behavior

```text
read(file)
    │
    ├── small file
    │      └── native/full read
    │
    ├── explicit small range
    │      └── targeted native read
    │
    ├── large file
    │      └── semantic map
    │
    └── very large/generated artifact
           └── index/extract only
```

## 10.2 Default thresholds

Initial defaults:

```yaml
read:
  direct_max_lines: 250
  direct_max_tokens: 4000
  semantic_map_min_lines: 251
  huge_file_min_tokens: 20000
  targeted_range_max_tokens: 6000
  maximum_summary_tokens: 1500
```

These values MUST be configurable.

## 10.3 Semantic map output

```json
{
  "type": "semantic_file_map",
  "path": "src/auth/service.ts",
  "fingerprint": "sha256:...",
  "lines": 1842,
  "estimated_tokens": 16428,
  "language": "typescript",
  "purpose": "Authentication and session lifecycle service",
  "symbols": [
    {
      "name": "authenticate",
      "kind": "function",
      "range": "221-287"
    }
  ],
  "dependencies": [
    "TokenProvider",
    "UserRepository"
  ],
  "material_findings": [
    {
      "severity": "medium",
      "summary": "Shared refresh-token cache mutation",
      "range": "612-701"
    }
  ],
  "recommended_ranges": [
    "221-287",
    "612-701"
  ]
}
```

## 10.4 Follow-up behavior

The primary model SHOULD receive enough information to issue a targeted read.

Example:

```text
read src/auth/service.ts lines 612-701
```

Targeted reads MUST normally bypass summarization if within budget.

---

# 11. Output Firewall

OCS MUST implement a post-tool output firewall.

Initial tool classes:

- `bash`
- `grep`
- `glob`
- Git commands
- test runners
- build systems
- package managers
- Kubernetes CLI
- Docker
- Terraform
- Helm

## 11.1 Output logic

```text
Tool executes
     │
     ▼
Measure result size
     │
     ├── below threshold -> return raw
     │
     └── above threshold
              │
              ▼
         select reducer
              │
              ▼
        compact result
              │
              ▼
         return summary
```

## 11.2 Generic shell reducer output

```json
{
  "command": "npm test",
  "exit_code": 1,
  "status": "failed",
  "summary": "3 test suites failed.",
  "material_errors": [
    {
      "suite": "auth.test.ts",
      "message": "Expected 200, received 401",
      "location": "tests/auth.test.ts:144"
    }
  ],
  "omitted_lines": 4832,
  "raw_output_ref": ".ocs/results/..."
}
```

---

# 12. Domain-Specific Reducers

Reducers SHOULD be pluggable.

```typescript
interface Reducer {
  id: string
  supports(context: ReducerContext): boolean
  reduce(input: ReducerInput): Promise<ReducerOutput>
}
```

## 12.1 Kubernetes reducer

Input examples:

- `kubectl get pods -A`
- `kubectl get events -A`
- `kubectl describe`
- Kubernetes MCP output

Output SHOULD emphasize:

- unhealthy resources
- CrashLoopBackOff
- ImagePullBackOff
- Pending
- OOMKilled
- scheduling failures
- failing readiness/liveness probes
- failed mounts
- PVC issues
- resource pressure
- recent event correlation
- affected namespaces
- likely next diagnostic step

## 12.2 Git reducer

Output SHOULD emphasize:

- files changed
- semantic change summary
- breaking changes
- dependency changes
- high-risk files
- large generated diffs
- test impact

## 12.3 CI/CD reducer

Output SHOULD emphasize:

- failing stage
- failing job
- first material error
- root cause candidate
- affected artifact
- retryability
- next action

## 12.4 Security reducer

Security output MUST NOT discard high-severity findings.

Output SHOULD include:

- CVE or advisory identifier
- severity
- affected component
- exploitability where known
- fix version
- reachable path where known

## 12.5 Observability reducer

Output SHOULD emphasize:

- anomaly
- baseline deviation
- start time
- impacted component
- correlated metrics
- likely cause
- recommended drill-down

---

# 13. Worker Router

## 13.1 Worker abstraction

```typescript
interface Worker {
  id: string
  tier: "T0" | "T1" | "T2" | "T3"
  capabilities: string[]
  execute(request: WorkerRequest): Promise<WorkerResult>
}
```

## 13.2 Model identity

```typescript
interface ModelIdentity {
  providerId: string
  modelId: string
  endpointClass?: "local" | "private" | "external"
  costClass?: number
  maxSensitivity?: DataClassification
}
```

## 13.3 Routing constraints

The router MUST enforce:

- capability
- context window
- data classification
- provider allow-list
- location/sovereignty
- cost ceiling
- latency ceiling
- model health

The router MUST NOT choose a disallowed external model solely because it is cheaper.

---

# 14. Code Writer

OCS SHOULD implement a direct-to-disk generation path.

Purpose:

Avoid returning large generated source files into primary session context.

Flow:

```text
Primary model
    │
    │ specification + reference
    ▼
OCS code-writer
    │
    ▼
T2 worker
    │
    ├── generate
    ├── write
    ├── format
    ├── lint
    └── test
          │
          ▼
Primary receives compact result
```

Example result:

```json
{
  "status": "created",
  "path": "tests/users.test.ts",
  "lines_written": 742,
  "tests_added": 14,
  "format": "passed",
  "lint": "passed",
  "tests": "passed",
  "semantic_summary": "Added CRUD coverage and authorization edge cases."
}
```

The primary model SHOULD NOT receive the full generated file unless explicitly requested.

---

# 15. Escalation

Lower-tier workers MUST support uncertainty.

Standard escalation result:

```json
{
  "status": "escalate",
  "reason": "Concurrent shared state mutation detected.",
  "confidence": 0.42,
  "recommended_tier": "T3",
  "required_context": [
    {
      "path": "src/cache.ts",
      "range": "421-477"
    }
  ]
}
```

Escalation SHOULD occur when:

- confidence falls below threshold.
- security-sensitive reasoning is required.
- concurrency semantics are involved.
- destructive actions are contemplated.
- worker result validation fails.
- policy explicitly requires T3.
- the user explicitly requests frontier analysis.

---

# 16. Context Governor

The Context Governor controls the amount of context admitted to the primary model.

## 16.1 Budget model

Example:

```yaml
context:
  max_tool_result_tokens: 5000
  max_single_read_tokens: 6000
  max_shell_result_tokens: 3000
  target_total_utilization_percent: 70
  reserve_reasoning_tokens: 30000
```

## 16.2 Actions

The Governor MAY:

- truncate
- summarize
- reject raw output
- demand a semantic map
- request targeted ranges
- remove duplicate context
- replace old raw results with cached summaries

## 16.3 OpenCode integration

Use the OpenCode model-context hook to inspect or modify assembled context immediately before model dispatch where appropriate.

Do not persist temporary context modifications as durable session history unless explicitly intended.

---

# 17. Cache and Fingerprinting

## 17.1 Goals

Avoid:

- repeated large-file summaries.
- repeated worker inference.
- repeated analysis of unchanged tool results.

## 17.2 Cache key

Recommended file cache key:

```text
SHA256(
  file_bytes
  + reducer_id
  + reducer_schema_version
  + worker_model_id
  + worker_prompt_version
)
```

## 17.3 Default storage

MVP:

```text
.ocs/
├── cache/
├── results/
├── telemetry/
└── state/
```

The project MUST support configuring a cache location outside the repository.

`.ocs/` SHOULD be added to `.gitignore` by default.

## 17.4 Cache backends

MVP:

- filesystem

Future:

- SQLite
- Redis
- object store
- distributed cache

## 17.5 Invalidation

Invalidate on:

- content fingerprint change
- reducer version change
- prompt version change
- policy version change where relevant
- explicit cache flush

---

# 18. Policy Schema

Create:

```text
ocs.yaml
```

Example:

```yaml
version: 1

mode: enforce

primary:
  preserve_user_selected_model: true

context:
  target_utilization_percent: 70
  reserve_reasoning_tokens: 30000

routing:
  default_action: pass

  tiers:
    T0:
      type: deterministic

    T1:
      provider: local
      model: small-instruct
      maximum_sensitivity: restricted

    T2:
      provider: economical
      model: coding-worker
      maximum_sensitivity: internal

    T3:
      inherit_primary_model: true

tools:
  read:
    enabled: true
    override_builtin: true
    direct_max_lines: 250
    direct_max_tokens: 4000
    targeted_max_tokens: 6000
    maximum_return_tokens: 1500
    worker_tier: T1

  bash:
    enabled: true
    maximum_raw_tokens: 3000
    reducer: shell
    worker_tier: T1

  grep:
    enabled: true
    maximum_results: 30

  kubernetes:
    enabled: true
    reducer: kubernetes
    maximum_return_tokens: 2000

code_writer:
  enabled: true
  worker_tier: T2
  validate:
    format: true
    lint: true
    test: true

cache:
  enabled: true
  backend: filesystem
  path: .ocs/cache
  ttl_seconds: 604800

security:
  external_models:
    default: deny

  classifications:
    public:
      external_allowed: true

    internal:
      external_allowed: false

    confidential:
      external_allowed: false

    restricted:
      external_allowed: false

telemetry:
  enabled: true
  format: jsonl
  path: .ocs/telemetry/events.jsonl
  prometheus: false

debug:
  dry_run: false
  log_decisions: true
```

---

# 19. Data Classification

Supported classifications:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
```

Policy evaluation MUST occur before any external worker call.

Classification MAY originate from:

- global policy
- repository policy
- directory policy
- file metadata
- user input
- explicit tool metadata

When classification is unknown, default to the configured safe classification.

Recommended default:

```text
INTERNAL
```

---

# 20. Security Requirements

OCS MUST:

1. not log secrets.
2. redact configured credential patterns.
3. not store API keys in telemetry.
4. respect OpenCode permission controls.
5. not bypass explicit OpenCode denies.
6. block external routing when policy disallows it.
7. maintain path-boundary validation.
8. avoid arbitrary shell interpolation.
9. treat worker output as untrusted.
10. validate structured worker output against schemas.
11. validate writes before commit where possible.
12. preserve raw artifacts only according to retention policy.

OCS SHOULD support configurable secret scanners.

---

# 21. Telemetry

Every routed operation SHOULD emit an event.

Example:

```json
{
  "timestamp": "2026-09-09T20:00:00Z",
  "session_id": "ses_123",
  "tool": "read",
  "operation": "file",
  "route": "offload",
  "tier": "T1",
  "reducer": "semantic-file-map",
  "raw_estimated_tokens": 16428,
  "worker_input_tokens": 15192,
  "worker_output_tokens": 821,
  "returned_tokens": 1174,
  "frontier_tokens_avoided": 15254,
  "latency_ms": 1180,
  "cache_hit": false,
  "model": "local/small-instruct",
  "confidence": 0.97
}
```

## 21.1 Required metrics

Track:

- raw context intercepted
- context returned
- gross frontier tokens avoided
- worker input tokens
- worker output tokens
- net tokens avoided
- estimated frontier cost avoided
- worker cost
- net dollar savings
- average compression ratio
- median added latency
- p95 added latency
- cache hit rate
- escalation rate
- routing decision count by type
- reducer failure rate
- worker failure rate

---

# 22. Cost Model

Create a configurable model-cost registry.

Example:

```yaml
costs:
  models:
    provider/model-a:
      input_per_million: 3.00
      output_per_million: 15.00

    local/model-b:
      input_per_million: 0
      output_per_million: 0
```

For local models, a future release MAY model infrastructure cost per GPU-hour.

Cost calculation:

```text
FrontierCostAvoided =
  avoided_input_tokens × frontier_input_rate

WorkerCost =
  worker_input_tokens × worker_input_rate
  +
  worker_output_tokens × worker_output_rate

NetSavings =
  FrontierCostAvoided - WorkerCost
```

---

# 23. Repository Structure

Recommended repository:

```text
opencode-context-shunt/
│
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── ocs.example.yaml
│
├── src/
│   ├── index.ts
│   │
│   ├── adapters/
│   │   └── opencode/
│   │       ├── plugin.ts
│   │       ├── hooks.ts
│   │       ├── generate.ts
│   │       ├── permissions.ts
│   │       └── types.ts
│   │
│   ├── core/
│   │   ├── engine.ts
│   │   ├── classifier.ts
│   │   ├── policy.ts
│   │   ├── governor.ts
│   │   └── tokenizer.ts
│   │
│   ├── tools/
│   │   ├── smart-read.ts
│   │   └── code-writer.ts
│   │
│   ├── reducers/
│   │   ├── base.ts
│   │   ├── generic.ts
│   │   ├── code-map.ts
│   │   ├── shell.ts
│   │   ├── git.ts
│   │   ├── tests.ts
│   │   ├── kubernetes.ts
│   │   └── observability.ts
│   │
│   ├── workers/
│   │   ├── base.ts
│   │   ├── deterministic.ts
│   │   ├── transient-model.ts
│   │   └── router.ts
│   │
│   ├── cache/
│   │   ├── base.ts
│   │   ├── filesystem.ts
│   │   └── fingerprint.ts
│   │
│   ├── security/
│   │   ├── classification.ts
│   │   ├── redaction.ts
│   │   └── policy.ts
│   │
│   ├── telemetry/
│   │   ├── events.ts
│   │   ├── metrics.ts
│   │   └── costs.ts
│   │
│   ├── schemas/
│   │   ├── policy.ts
│   │   ├── result.ts
│   │   └── telemetry.ts
│   │
│   └── util/
│       ├── hashing.ts
│       ├── files.ts
│       └── logging.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── benchmarks/
│
└── docs/
    ├── architecture.md
    ├── policy.md
    ├── reducers.md
    ├── security.md
    └── benchmarking.md
```

---

# 24. Core Interfaces

## 24.1 Engine

```typescript
export interface ContextShuntEngine {
  decide(request: ShuntRequest): Promise<ShuntDecision>

  process(
    request: ShuntRequest,
    executor: () => Promise<unknown>
  ): Promise<ShuntResult>
}
```

## 24.2 Reducer result

```typescript
export interface ReducerOutput {
  type: string
  summary: string
  structured?: unknown
  confidence?: number
  rawTokenEstimate: number
  returnedTokenEstimate: number
  escalation?: {
    required: boolean
    reason?: string
  }
}
```

## 24.3 Worker result

```typescript
export interface WorkerResult {
  status: "completed" | "escalate" | "failed"
  output?: unknown
  confidence?: number
  reason?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}
```

---

# 25. Prompt Contracts

Worker prompts MUST request structured output.

Do not depend on unconstrained prose.

Example semantic mapper prompt contract:

```text
SYSTEM:
You are a code context reducer.

OBJECTIVE:
Create a compact semantic map of the supplied source code.

REQUIREMENTS:
- Do not rewrite the source.
- Identify major symbols.
- Identify dependencies.
- Identify material risks.
- Identify exact relevant line ranges.
- Return JSON matching the provided schema.
- If the code cannot be summarized safely, set escalate=true.

PRIORITY:
Preserve information required for downstream reasoning while minimizing output.
```

Worker output MUST be schema validated.

Invalid structured output SHOULD be retried once and then escalated or fall back according to policy.

---

# 26. Token Estimation

OCS SHOULD implement a tokenizer abstraction.

```typescript
interface TokenEstimator {
  estimate(text: string, model?: ModelIdentity): number
}
```

MVP MAY use an approximate estimator.

For example:

```text
estimated_tokens ≈ characters / 4
```

Production SHOULD use model-aware tokenization where practical.

The telemetry event MUST indicate whether token counts are:

```text
estimated
provider_reported
tokenizer_exact
```

---

# 27. Failure Modes

OCS MUST define behavior for:

| Failure | Default behavior |
|---|---|
| Worker unavailable | fall back or escalate |
| Worker timeout | fall back or escalate |
| Invalid structured output | retry once, then escalate |
| Cache corruption | discard cache entry |
| Policy parse error | fail closed for external routing |
| Token estimator failure | use conservative estimate |
| Reducer failure | return bounded raw output or escalate |
| Telemetry failure | continue execution unless compliance policy requires logging |
| External provider disallowed | route local or T3 |
| Unknown sensitivity | use safe default classification |

Never silently discard a material tool failure.

---

# 28. Dry-Run Mode

Dry-run mode MUST:

- execute original behavior.
- calculate what OCS would have done.
- emit routing decisions.
- not transform results.
- not send workloads to alternate worker models.

Example event:

```json
{
  "mode": "dry-run",
  "would_route": "T1",
  "would_reduce_tokens": 14822
}
```

This mode is essential for tuning thresholds before enforcement.

---

# 29. Benchmark Suite

Create reproducible benchmark fixtures.

## 29.1 File benchmarks

- 100-line TypeScript
- 500-line TypeScript
- 2,000-line TypeScript
- 10,000-line generated source
- monorepo config
- large JSON
- large YAML

## 29.2 Tool-output benchmarks

- 10-line shell output
- 5,000-line test failure
- Kubernetes events
- large `git diff`
- Terraform plan
- Docker build log

## 29.3 Metrics

For every benchmark capture:

```text
raw_tokens
returned_tokens
worker_tokens
net_tokens
latency
cost
quality_score
material_findings_preserved
```

---

# 30. Quality Evaluation

Token savings alone are insufficient.

Create an evaluation dataset where the frontier model must answer questions using:

1. raw context
2. OCS-reduced context

Compare:

- factual correctness
- bug detection
- required symbol preservation
- relevant line-range preservation
- root cause accuracy
- actionability
- hallucination rate

Target:

```text
Quality degradation <= 2%
```

for workloads that OCS automatically compresses.

Security-sensitive reducers SHOULD target no measurable loss of high-severity findings.

---

# 31. MVP Scope

The first production-capable MVP MUST include:

## Phase 1 — Core

- TypeScript project
- configuration loader
- policy validation
- logging
- token estimator
- telemetry schema
- OpenCode adapter

## Phase 2 — Smart Read

- custom `read` override
- direct reads
- targeted reads
- semantic maps
- file hashing
- filesystem cache

## Phase 3 — Output Firewall

- `execute.after`
- shell reducer
- grep reducer
- test-output reducer
- bounded raw fallback

## Phase 4 — Worker Router

- T0 deterministic worker
- transient OpenCode model worker
- T1/T2 configuration
- escalation

## Phase 5 — Context Governor

- per-tool budgets
- result budgets
- context-hook integration
- safe truncation

## Phase 6 — Code Writer

- specification input
- generated file write
- formatting
- lint
- test
- compact success result

## Phase 7 — Telemetry

- JSONL metrics
- cost calculation
- token savings
- cache hit ratio
- latency tracking

---

# 32. Acceptance Criteria

The MVP is complete when all of the following are true.

## Functional

- [ ] OpenCode loads the plugin successfully.
- [ ] Large `read` calls are intercepted.
- [ ] Small reads behave normally.
- [ ] Explicit targeted reads behave normally.
- [ ] Large files return semantic maps.
- [ ] Repeated unchanged reads use cache.
- [ ] Large shell output is reduced.
- [ ] Worker inference does not pollute normal session history.
- [ ] Worker failures safely fall back or escalate.
- [ ] Policy can prohibit external models.
- [ ] Telemetry records routing decisions.

## Performance

- [ ] Large-read benchmark reduces frontier input tokens by at least 70%.
- [ ] Shell-output benchmark reduces frontier input tokens by at least 70%.
- [ ] Cache hit reduces repeated worker inference to zero.
- [ ] Added median routing overhead for direct/pass operations is under 50 ms.
- [ ] No unbounded in-memory buffering for large tool outputs.

## Quality

- [ ] Relevant symbols are preserved in semantic maps.
- [ ] Relevant line ranges are preserved.
- [ ] Material test errors are preserved.
- [ ] High-severity Kubernetes failures are preserved.
- [ ] Quality evaluation degradation remains within configured target.

## Security

- [ ] External model policy is enforced.
- [ ] secrets are redacted from telemetry.
- [ ] path traversal tests pass.
- [ ] malformed worker output cannot bypass schema validation.
- [ ] explicit OpenCode permission denies remain final.

---

# 33. Test Strategy

## Unit tests

Test:

- policy parser
- classifier
- token estimator
- fingerprints
- cache
- routing
- reducers
- redaction
- cost model
- schema validation

## Integration tests

Test with OpenCode:

- plugin loading
- hook registration
- `read` override
- context hook
- tool after-hook
- transient model generation
- worker timeout
- provider failure

## Security tests

Test:

- secret strings
- path traversal
- symlink escape
- malicious worker JSON
- prompt injection inside files
- prompt injection inside tool output
- external-route denial
- telemetry leakage

## Regression tests

Every reducer MUST have frozen fixtures.

---

# 34. Development Rules for the Coding Harness

The implementation harness MUST follow these rules:

1. Build the reusable OCS core independently of OpenCode.
2. Keep OpenCode-specific types under `src/adapters/opencode`.
3. Use strict TypeScript.
4. Avoid `any` unless unavoidable at an external API boundary.
5. Validate all configuration with a schema.
6. Validate all worker structured output with a schema.
7. Make every threshold configurable.
8. Add tests with every reducer.
9. Do not depend on undocumented OpenCode internals unless there is no supported API.
10. If an undocumented API is required, isolate it behind one adapter and document the reason.
11. Never silently send source code to an external provider.
12. Never silently downgrade security policy for availability.
13. Preserve the user's selected primary model.
14. Do not make LLM-based routing mandatory for MVP.
15. Prefer deterministic filtering before model summarization.
16. Do not optimize by truncating away material errors.
17. Emit telemetry for every routing decision.
18. Include dry-run mode before enforcement mode.
19. Keep the system usable when OCS is disabled.
20. Add clear fallback behavior for every external dependency.

---

# 35. Recommended Build Order for Autonomous Coding Harness

Execute in this exact order unless blocked:

```text
1. Scaffold repository
2. Add TypeScript/Vitest/linting
3. Define schemas and interfaces
4. Implement config loader
5. Implement token estimator
6. Implement telemetry writer
7. Implement filesystem fingerprint/cache
8. Implement rule-based classifier
9. Implement reducer interface
10. Implement generic/shell/code-map reducers
11. Implement OpenCode adapter
12. Register tool hooks
13. Implement smart-read replacement
14. Implement transient worker
15. Add worker router
16. Add context governor
17. Add dry-run mode
18. Add integration tests
19. Add benchmark fixtures
20. Implement code-writer
21. Implement Kubernetes reducer
22. Create README and operator documentation
```

At the end of each step:

- run tests
- run lint
- run type checking
- record unresolved issues
- do not proceed with a broken main branch

---

# 36. Definition of Done

Version 1.0 is considered done when:

- it can be installed as an OpenCode plugin.
- the primary user workflow is unchanged.
- large file and shell output can be deterministically shunted.
- local or cheap workers can summarize large context.
- context returned to the frontier model is significantly reduced.
- cached understanding is reused.
- data-routing policy is enforced.
- all routing decisions are observable.
- worker interactions are isolated from the primary conversation.
- quality benchmarks demonstrate acceptable fidelity.
- the system can be disabled without affecting OpenCode.

---

# 37. Future Roadmap

## v1.1

- Git reducer
- Terraform reducer
- Helm reducer
- CI/CD reducer
- Prometheus metrics
- SQLite cache

## v1.2

- Kubernetes MCP reducer
- generic MCP output interceptor
- RAG reducer
- OpenTelemetry traces
- adaptive thresholds

## v1.3

- distributed Redis cache
- fleet policy
- shared organizational configuration
- central telemetry

## v2.0

Generalize OCS into a harness-independent context control plane supporting:

- OpenCode
- Claude Code
- OpenWork
- Hermes
- DSH-compatible harnesses
- custom agent frameworks

At that stage the architecture becomes:

```text
Agent Harnesses
      │
      ▼
Universal Context Control Plane
      │
      ├── Policy
      ├── Routing
      ├── Cost
      ├── Sovereignty
      ├── Caching
      ├── Reducers
      └── Telemetry
              │
              ▼
   Models / Tools / MCP / Data
```

---

# 38. Strategic End State

OCS should ultimately provide three logical planes:

```text
Reasoning Control Plane
        +
Context Data Plane
        +
Execution Data Plane
```

The frontier model remains responsible for decisions that benefit from high-end reasoning.

The context data plane controls what information is allowed into that expensive reasoning environment.

The execution data plane performs mechanical work using the cheapest safe and capable execution mechanism.

This makes token optimization, model routing, AI governance, data sovereignty, and agent observability parts of the same architectural control point.

---

# 39. Current OpenCode References

The implementation harness should validate these references against the installed OpenCode version before coding because the V2 plugin API is beta.

- OpenCode V2 Plugins: https://opencode.ai/v2/docs/build/plugins/
- OpenCode Custom Tools: https://opencode.ai/docs/custom-tools/
- OpenCode Agents: https://opencode.ai/docs/agents
- OpenCode Providers: https://opencode.ai/docs/providers
- OpenCode Tools: https://opencode.ai/docs/tools
- OpenCode repository: https://github.com/anomalyco/opencode

Important verified behaviors as of 2026-09-09:

- tool pre/post hooks are supported.
- model context hooks are supported.
- permission hooks are supported.
- shell creation hooks are supported.
- transient generation using a selected model is supported.
- same-name custom tools can take precedence over built-in tools.
- provider configuration supports many hosted and local model backends.
- V2 remains beta; isolate the OpenCode adapter.

---

# 40. Final Implementation Directive

Build OCS as a deterministic optimization and governance layer, not as an advisory prompt.

The primary agent must not be required to decide whether to conserve tokens.

The system itself must enforce the policy.

The most important invariant is:

> **Large, repetitive, mechanical, or low-relevance context should not enter the frontier model's context unless doing so is necessary for correct reasoning.**

