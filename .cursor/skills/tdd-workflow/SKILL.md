---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring. Python-first TDD workflow (pytest/ruff/mypy) with optional Node.js notes.
---

# Test-Driven Development Workflow

This skill enforces a practical TDD loop: **Red → Green → Refactor**, plus a coverage sanity check.

## When to Activate

- Writing new features
- Fixing bugs
- Refactoring
- Adding API endpoints
- Adding business logic / data validations

## Core Principles

### 1) Tests before code
Write the failing test first, then implement the minimum code to pass.

### 2) Prefer deterministic, fast tests
- Keep unit tests fast (< 1s if possible)
- Isolate external services (mock or use test containers)
- Avoid flaky timing assertions

### 3) Coverage target (guideline)
- Target **80%+** on critical packages (domain logic, services)
- Allow lower coverage on glue code, migrations, and generated code
- A single high-value test is better than many low-value assertions

## Test Types (Python)

### Unit tests (pytest)
- Pure functions / utilities
- Domain logic (validation, transforms)
- Small services with dependencies mocked

**Example:**

```python
# tests/test_slugify.py
from myapp.text import slugify

def test_slugify_basic():
    assert slugify("Hello, World!") == "hello-world"


def test_slugify_trims_and_collapses_spaces():
    assert slugify("  a   b  ") == "a-b"
```

### Integration tests
- DB queries
- Repository layer
- HTTP endpoints (FastAPI/Flask)

**Example (FastAPI):**

```python
# tests/test_users_api.py
from fastapi.testclient import TestClient
from myapp.main import app

client = TestClient(app)


def test_create_user_validates_input():
    r = client.post("/users", json={"email": "not-an-email"})
    assert r.status_code in (400, 422)


def test_create_user_success():
    r = client.post("/users", json={"email": "a@example.com"})
    assert r.status_code == 201
```

### Contract / boundary tests
- Webhook payload validation
- Third-party API client assumptions
- Backward compatibility for public functions

### E2E tests (optional)
Only if your project has user flows or multi-service workflows.
- UI: Playwright (JS) or Playwright Python
- API workflows: run against a test environment with seeded data

## The TDD Workflow

### Step 1: Write a small acceptance statement
```
Given [context]
When  [action]
Then  [outcome]
```

### Step 2: Write the failing test (RED)
- Smallest test that captures the behavior
- One reason to fail

### Step 3: Make it pass (GREEN)
- Minimal implementation
- No premature optimization

### Step 4: Refactor safely
- Remove duplication
- Improve naming
- Simplify control flow
- Add type hints where helpful

### Step 5: Run the “quality loop”
Before running commands, **auto-detect your repo tooling** (uv/poetry/pdm/pipenv, npm/pnpm, etc.):

```bash
node .cursor/scripts/recommend-commands.js
```

If hooks are enabled, the snapshot is also available at `.cursor/.hook_state/tooling.json`.

Then run the Python quality loop using the detected runner prefix (examples):

```bash
# uv
uv run ruff format .
uv run ruff check .
uv run mypy .
uv run pytest -q

# poetry
poetry run ruff format .
poetry run ruff check .
poetry run mypy .
poetry run pytest -q

# fallback (plain)
ruff format .
ruff check .
mypy .
pytest -q
```

Coverage (recommended for PRs):

```bash
# uv
uv run pytest -q --cov=myapp --cov-report=term-missing

# poetry
poetry run pytest -q --cov=myapp --cov-report=term-missing

# fallback
pytest -q --cov=myapp --cov-report=term-missing
```

## Practical Guidance

- Prefer **pydantic** (or dataclasses + validators) for input schemas
- Add **type hints** for public APIs and complex data flows
- If a bug was reported, add a regression test that fails *before* the fix

## Node.js Notes (if your project includes Node)

- Unit tests: vitest/jest
- Integration tests: supertest (API) or DB test harness
- Optional UI E2E: Playwright
- Prefer repo-specific commands (e.g., `pnpm test`, `npm test`).
- Prefer local dependency execution (e.g., `pnpm exec prettier`) and avoid auto-installs.
