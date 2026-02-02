# TDD Workflow (Python-first)

A lightweight, repeatable TDD loop that works well for Python projects (and still maps to JS/TS).

## Core loop

1. **RED** — write a failing test that expresses the smallest next behavior.
2. **GREEN** — implement the minimum code to pass.
3. **REFACTOR** — improve naming, structure, and remove duplication (tests stay green).

## Python defaults

- Test runner: `pytest`
- Lint/format: `ruff format` + `ruff check` (optionally `--fix`)
- Type check (optional): `mypy` or `pyright`

## Practical rules

- Prefer unit tests for business logic; add integration tests at module boundaries.
- Use **arrange / act / assert** structure.
- Keep tests deterministic: avoid real network, time, randomness.
- Prefer dependency injection for external IO.
- When fixing a bug, first add a regression test that fails on the buggy behavior.

## Minimal pytest skeleton

```python
def test_example():
    # arrange
    x = 1

    # act
    y = x + 1

    # assert
    assert y == 2
```

## When tests are hard to write

- Extract pure functions from messy code paths.
- Introduce small adapters for IO.
- Use fakes/stubs at boundaries.

## Related

- Agents: `./.cursor/agents/tdd-guide.md`
- Commands: `/plan`, `/tdd`, `/code-review`
