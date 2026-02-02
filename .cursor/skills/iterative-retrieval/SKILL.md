---
name: iterative-retrieval
description: Pattern for progressively refining context retrieval so subagents get the right files without blowing context limits.
---

# Iterative Retrieval Pattern

Solves the "context problem" in multi-agent workflows where a subagent doesn't know what context it needs until it starts working.

## The Problem

Subagents are spawned with limited context. They don't know:
- Which files contain the relevant implementation
- What naming conventions and patterns exist in the repo
- What terminology the project uses

Standard approaches fail:
- **Send everything**: exceeds context limits
- **Send nothing**: agent lacks critical information
- **Guess what's needed**: often wrong

## The Solution: Iterative Retrieval

A 4-phase loop that progressively refines context.

```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌──────────┐      ┌──────────┐            │
│   │ DISPATCH │─────▶│ EVALUATE │            │
│   └──────────┘      └──────────┘            │
│        ▲                  │                 │
│        │                  ▼                 │
│   ┌──────────┐      ┌──────────┐            │
│   │   LOOP   │◀─────│  REFINE  │            │
│   └──────────┘      └──────────┘            │
│                                             │
│        Max 3 cycles, then proceed           │
└─────────────────────────────────────────────┘
```

### Phase 1: DISPATCH

Start broad: collect candidate files by patterns + keywords.

Python-flavored pseudocode:

```python
initial_query = {
  "patterns": [
    "src/**/*",
    "app/**/*",
    "**/*.py",
    "**/*.{js,ts,tsx}",
  ],
  "keywords": ["auth", "token", "session", "rate limit"],
  "excludes": ["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "**/.venv/**"],
}

candidates = retrieve_files(initial_query)
```

### Phase 2: EVALUATE

Score each candidate for relevance and identify what's missing.

```python
from dataclasses import dataclass

@dataclass
class Eval:
    path: str
    relevance: float  # 0.0-1.0
    reason: str
    missing_context: list[str]


def evaluate_relevance(files: list[dict], task: str) -> list[Eval]:
    out: list[Eval] = []
    for f in files:
        out.append(Eval(
            path=f["path"],
            relevance=score_relevance(f["content"], task),
            reason=explain_relevance(f["content"], task),
            missing_context=identify_gaps(f["content"], task),
        ))
    return out
```

Scoring rule of thumb:
- **High (0.8-1.0)**: directly implements the target behavior
- **Medium (0.5-0.7)**: related patterns / types / shared utilities
- **Low (0.2-0.4)**: tangentially related
- **None (0-0.2)**: not relevant → exclude

### Phase 3: REFINE

Update patterns/keywords based on what you learned in Phase 2.

```python
def refine_query(evals: list[Eval], prev: dict) -> dict:
    high = [e for e in evals if e.relevance >= 0.7]
    low = [e for e in evals if e.relevance < 0.2]

    return {
        "patterns": sorted(set(prev["patterns"] + extract_patterns(high))),
        "keywords": sorted(set(prev["keywords"] + extract_keywords(high))),
        "excludes": sorted(set(prev["excludes"] + [e.path for e in low])),
        "focus_areas": sorted(set(x for e in high for x in e.missing_context)),
    }
```

### Phase 4: LOOP

Repeat with refined criteria (max 3 cycles). Stop early once you have "enough" context.

```python
def iterative_retrieve(task: str, max_cycles: int = 3) -> list[Eval]:
    query = create_initial_query(task)
    best: list[Eval] = []

    for _ in range(max_cycles):
        candidates = retrieve_files(query)
        evals = evaluate_relevance(candidates, task)

        high = [e for e in evals if e.relevance >= 0.7]
        best = merge_context(best, high)

        if len(high) >= 3 and not has_critical_gaps(evals):
            return best

        query = refine_query(evals, query)

    return best
```

## Practical Examples

### Example 1: Bug Fix Context

```
Task: "Fix authentication token expiry bug"

Cycle 1:
  DISPATCH: search keywords ["token", "expiry", "auth"] in src/** and **/*.py
  EVALUATE: found auth.py (0.9), tokens.py (0.8), user.py (0.3)
  REFINE: add keywords ["refresh", "jwt"]; exclude user.py

Cycle 2:
  DISPATCH: refined search
  EVALUATE: found session_manager.py (0.95), jwt_utils.py (0.85)

Result: auth.py, tokens.py, session_manager.py, jwt_utils.py
```

### Example 2: Feature Implementation

```
Task: "Add rate limiting to API endpoints"

Cycle 1:
  DISPATCH: search ["rate", "limit", "throttle"] in api/**, app/**, **/*.py
  EVALUATE: no "rate" but found "throttle" middleware pattern
  REFINE: focus areas: middleware chain, router setup

Cycle 2:
  DISPATCH: refined search
  EVALUATE: found throttle_middleware.py (0.9), routes.py (0.8)

Result: throttle_middleware.py, routes.py
```

## Integration with Agents

Use in agent prompts:

```markdown
When retrieving context for this task:
1. Start with broad keyword search
2. Score each candidate file's relevance (0-1)
3. Explicitly list what's still missing
4. Refine patterns/keywords and repeat (max 3 cycles)
5. Return files with relevance >= 0.7 plus any "bridge" utilities
```

## Best Practices

1. **Start broad, narrow progressively**
2. **Learn repo terminology** (first cycle often reveals naming conventions)
3. **Track missing context explicitly**
4. **Stop at "good enough"** (3 high-relevance files beats 10 mediocre ones)
5. **Exclude confidently** (low relevance rarely becomes high)

## Related

- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - Subagent orchestration section
