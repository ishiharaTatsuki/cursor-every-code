---
name: security-review
description: Use this skill when adding auth, handling user input/files, working with secrets, creating API endpoints, or implementing payment/sensitive features. Python-first with Node.js notes.
---

# Security Review Skill

This skill enforces security best practices and helps spot common vulnerabilities.

## When to Activate

- Implementing authentication/authorization
- Handling user input (forms, JSON, query params) or file uploads
- Creating new API endpoints (especially write endpoints)
- Working with secrets/credentials
- Payment, PII, health, financial, or other sensitive domains
- Integrating third-party APIs / webhooks

## Security Checklist

### 1) Secrets Management

#### ❌ Never hardcode secrets

```python
# DANGEROUS
OPENAI_API_KEY = "sk-proj-..."
DB_PASSWORD = "password123"
```

#### ✅ Always use environment/config providers

```python
import os

api_key = os.environ.get("OPENAI_API_KEY")
db_url = os.environ.get("DATABASE_URL")

if not api_key:
    raise RuntimeError("OPENAI_API_KEY not configured")
```

**Python tip (pydantic settings):**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    database_url: str

settings = Settings()  # reads from env by default
```

Verification:
- [ ] No secrets in repo (code, config, docs)
- [ ] `.env`/`.env.*` are in `.gitignore`
- [ ] CI/CD uses secret store (GitHub Actions / cloud secrets manager)
- [ ] Logs do not print tokens/headers
- [ ] Secrets rotated if leaked

### 2) Input Validation

#### ✅ Validate *all* external input (Python/FastAPI + pydantic example)

```python
from pydantic import BaseModel, EmailStr, Field

class CreateUser(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=0, le=150)
```

```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/users")
def create_user(payload: CreateUser):
    # payload is validated
    return {"ok": True}
```

#### ✅ Validate file uploads

- Enforce **size limit**
- Enforce **content type** (MIME) and **extension**
- Re-scan/verify server-side (magic bytes) if security-sensitive
- Store outside the web root, use randomized names

Verification:
- [ ] All user inputs validated (schema/typing + constraints)
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages do not leak stack traces or internal IDs
- [ ] No direct use of user input in shell commands

### 3) Injection Prevention

#### SQL Injection

❌ Never build SQL via string concatenation:

```python
# DANGEROUS
sql = f"SELECT * FROM users WHERE email = '{email}'"
```

✅ Use parameterized queries / ORM binding:

```python
# psycopg / DB-API style
cur.execute("SELECT * FROM users WHERE email = %s", (email,))
```

```python
# SQLAlchemy style
session.execute(text("SELECT * FROM users WHERE email = :email"), {"email": email})
```

#### Command Injection

- Prefer `subprocess.run([...], shell=False)`
- Never interpolate user input into a shell command string

Verification:
- [ ] DB access uses parameters/bind variables
- [ ] No `shell=True` with user input
- [ ] No dynamic eval/exec on untrusted data

### 4) AuthN / AuthZ

#### Authentication

- Use secure session cookies (HttpOnly, Secure, SameSite)
- Set reasonable TTL and rotate refresh tokens
- Store password hashes with a modern KDF (bcrypt/argon2)

#### Authorization

- Authorization is checked **server-side** on every sensitive action
- Use explicit ownership/role checks (deny by default)

FastAPI pseudo-pattern:

```python
# Example check (pseudo)
if resource.owner_id != current_user.id and not current_user.is_admin:
    raise HTTPException(status_code=403)
```

Verification:
- [ ] Every write endpoint has auth + authz checks
- [ ] Multi-tenant data access is scoped (tenant_id)
- [ ] No “client says admin=true” trust

### 5) XSS / HTML Sanitization

If you render user-supplied HTML, sanitize it.

Python example:

```python
import bleach

safe_html = bleach.clean(user_html, tags=["b", "i", "a"], attributes={"a": ["href"]})
```

Verification:
- [ ] No raw HTML injection into templates/DOM
- [ ] Use escaping by default
- [ ] CSP for web apps where possible

### 6) CSRF

- For cookie-based auth, enforce CSRF protections
- SameSite cookies help but are not a full substitute

Verification:
- [ ] CSRF tokens or same-origin protections for state-changing requests

### 7) SSRF / URL Fetching

If the service fetches URLs (webhooks previews, importers):
- Block private IP ranges and metadata endpoints
- Enforce allowlist of domains or signed URLs
- Enforce timeouts, size limits, redirect limits

### 8) Rate Limiting / Abuse

- Add rate limits on login, signup, password reset, OTP
- Add per-user/per-IP limits on expensive endpoints

### 9) Logging & Observability

- Avoid logging PII and secrets
- Use structured logs
- Ensure error logging doesn't expose internal stack traces to users

### 10) Supply Chain / Dependencies

- Pin dependencies (lockfiles)
- Run vulnerability scans in CI
- Avoid `curl | bash` install patterns

## Quick “Diff Review” Prompts

When reviewing a change, explicitly check:
- new endpoints: auth/authz + validation + rate limit
- DB queries: parameterized
- secrets: not added to code or logs
- file operations: path traversal, safe directories
- network calls: SSRF controls, timeouts

## Node.js Notes (if your project includes Node)

- Use env vars for secrets, never commit `.env`
- Validate input (Zod/Valibot/Joi)
- Avoid `eval`, avoid dynamic `child_process.exec` with user input
- Prefer parameterized DB clients

