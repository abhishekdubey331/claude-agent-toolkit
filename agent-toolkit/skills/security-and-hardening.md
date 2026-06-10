---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations. Use when building any feature that accepts untrusted data, manages user sessions, or interacts with third-party services.
---

# Security and Hardening

> Adapted from [addyosmani/agent-skills/skills/security-and-hardening/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/security-and-hardening/SKILL.md) — MIT, © Addy Osmani.

## Adaptation note for this repo

Adapted from upstream — core guidance unchanged; illustrative code examples genericized across languages. Bundled in the `agent-toolkit` plugin for general use across projects on any language or platform.


## Overview

Security-first development practices for web applications. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory. Security isn't a phase — it's a constraint on every line of code that touches user data, authentication, or external systems.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services
- Adding file uploads, webhooks, or callbacks
- Handling payment or PII data

## The Three-Tier Boundary System

### Always Do (No Exceptions)

- **Validate all external input** at the system boundary (API routes, form handlers)
- **Parameterize all database queries** — never concatenate user input into SQL
- **Encode output** to prevent XSS (use framework auto-escaping, don't bypass it)
- **Use HTTPS** for all external communication
- **Hash passwords** with bcrypt/scrypt/argon2 (never store plaintext)
- **Set security headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **Use httpOnly, secure, sameSite cookies** for sessions
- **Run your ecosystem's dependency-audit tool** (`npm audit`, `pip-audit`, `cargo audit`, `govulncheck`, OWASP Dependency-Check, etc.) before every release

### Ask First (Requires Human Approval)

- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling
- Granting elevated permissions or roles

### Never Do

- **Never commit secrets** to version control (API keys, passwords, tokens)
- **Never log sensitive data** (passwords, tokens, full credit card numbers)
- **Never trust client-side validation** as a security boundary
- **Never disable security headers** for convenience
- **Never use `eval()` or `innerHTML`** with user-provided data
- **Never store sessions in client-accessible storage** (localStorage for auth tokens)
- **Never expose stack traces** or internal error details to users

## OWASP Top 10 Prevention

### 1. Injection (SQL, NoSQL, OS Command)

The pattern is universal: never interpolate untrusted input into queries or commands. Use parameterized queries or prepared statements in every language.

```typescript
// BAD: SQL injection via string concatenation (TypeScript/Node example)
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// GOOD: ORM with parameterized input
const user = await prisma.user.findUnique({ where: { id: userId } });
```

```python
# GOOD: Parameterized query (Python example)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

```go
// GOOD: Parameterized query (Go example)
row := db.QueryRow("SELECT * FROM users WHERE id = $1", userID)
```

### 2. Broken Authentication

Principles are universal: hash passwords with a slow, salted algorithm; load secrets from environment variables; mark session cookies httpOnly, secure, and sameSite.

```typescript
// Password hashing (Node.js / TypeScript illustrative example)
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);

// Session management — pull secret from environment, never from source code
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,     // Not accessible via JavaScript
    secure: true,       // HTTPS only
    sameSite: 'lax',    // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  },
}));
```

In other ecosystems use the equivalent slow hash (Python: `passlib`/`bcrypt`, Go: `golang.org/x/crypto/bcrypt`, Java: Spring Security's `BCryptPasswordEncoder`, etc.) and your framework's session management — the cookie attributes apply universally.

### 3. Cross-Site Scripting (XSS)

Always rely on your framework's auto-escaping. Never insert raw user content into the DOM or template output without sanitization.

```typescript
// BAD: Rendering user input as raw HTML (JavaScript/browser example)
element.innerHTML = userInput;

// GOOD: Use framework auto-escaping (React does this by default)
return <div>{userInput}</div>;

// If you MUST render HTML, sanitize first (browser environments)
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

Server-side template engines (Jinja2, Go `html/template`, ERB, Thymeleaf, etc.) auto-escape by default — don't bypass that unless you explicitly sanitize the input first.

### 4. Broken Access Control

Always check ownership/authorization — not just authentication — before mutating or returning any resource. The pattern is universal across frameworks and languages.

```typescript
// Illustrative example (TypeScript/Express)
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);

  // Check that the authenticated user owns this resource
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' }
    });
  }

  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

Apply the same ownership check in any language: verify the resource belongs to the authenticated principal before proceeding.

### 5. Security Misconfiguration

Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) and CORS restrictions apply regardless of language or framework. Use your framework's idiomatic middleware or configuration to set them.

```typescript
// Illustrative example (Node.js/Express — use helmet middleware)
import helmet from 'helmet';
app.use(helmet());

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // Tighten if possible
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  },
}));

// CORS — restrict to known origins; load allowed origins from environment
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

Equivalents in other stacks: Django `SecurityMiddleware` + `django-cors-headers`, Go `gorilla/handlers` or custom middleware, Spring Security's `HttpSecurity`, Nginx/Caddy config for static or reverse-proxied apps.

### 6. Sensitive Data Exposure

Strip sensitive fields before returning API responses, and load secrets exclusively from environment variables — never hardcode them.

```typescript
// Illustrative example (TypeScript): strip sensitive fields from API response
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}

// Load secrets from environment — fail fast if missing
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

The same pattern applies in any language: use serializer/DTO layers (Python Pydantic, Go struct tags, Java Jackson `@JsonIgnore`, Ruby `as_json`, etc.) to ensure sensitive fields are never accidentally serialised.

## Input Validation Patterns

### Schema Validation at Boundaries

Validate all untrusted input at system boundaries (API route handlers, CLI argument parsers, message queue consumers, etc.) using your ecosystem's schema/validation library. Reject early and return structured errors.

```typescript
// Illustrative example (TypeScript/Node — using Zod)
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() },
    });
  }
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

Equivalent libraries in other stacks: Python (Pydantic, marshmallow, cerberus), Go (validator, go-playground/validator), Java (Bean Validation / Hibernate Validator), Ruby (dry-validation), Rust (serde + validator).

### File Upload Safety

Restrict file types and sizes regardless of stack. Never trust the file extension alone — verify the declared MIME type and, for critical use cases, inspect magic bytes.

```typescript
// Illustrative example (TypeScript)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ValidationError('File type not allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
  // Don't trust the file extension — check magic bytes if critical
}
```

## Triaging Dependency-Audit Results

Not all audit findings require immediate action. Use this decision tree with whichever audit tool your ecosystem provides (`npm audit`, `pip-audit`, `cargo audit`, `govulncheck`, OWASP Dependency-Check, etc.):

```
Dependency-audit tool reports a vulnerability
├── Severity: critical or high
│   ├── Is the vulnerable code reachable in your app?
│   │   ├── YES --> Fix immediately (update, patch, or replace the dependency)
│   │   └── NO (dev-only dep, unused code path) --> Fix soon, but not a blocker
│   └── Is a fix available?
│       ├── YES --> Update to the patched version
│       └── NO --> Check for workarounds, consider replacing the dependency, or add to allowlist with a review date
├── Severity: moderate
│   ├── Reachable in production? --> Fix in the next release cycle
│   └── Dev-only? --> Fix when convenient, track in backlog
└── Severity: low
    └── Track and fix during regular dependency updates
```

**Key questions:**
- Is the vulnerable function actually called in your code path?
- Is the dependency a runtime dependency or dev-only?
- Is the vulnerability exploitable given your deployment context (e.g., a server-side vulnerability in a client-only app)?

When you defer a fix, document the reason and set a review date.

## Rate Limiting

Apply rate limiting at the API layer — stricter limits on authentication endpoints. Use your framework's middleware or a reverse proxy (Nginx, Caddy, API gateway).

```typescript
// Illustrative example (Node.js/Express — using express-rate-limit)
import rateLimit from 'express-rate-limit';

// General API rate limit
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter limit for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // 10 attempts per 15 minutes
}));
```

Equivalents: Django REST Framework throttle classes, Go `golang.org/x/time/rate`, Spring Boot `bucket4j`, infrastructure-level rate limiting via Nginx `limit_req`, Cloudflare rules, etc.

## Secrets Management

```
.env files:
  ├── .env.example  → Committed (template with placeholder values)
  ├── .env          → NOT committed (contains real secrets)
  └── .env.local    → NOT committed (local overrides)

.gitignore must include:
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
```

**Always check before committing:**
```bash
# Check for accidentally staged secrets
git diff --cached | grep -i "password\|secret\|api_key\|token"
```

## Security Review Checklist

```markdown
### Authentication
- [ ] Passwords hashed with bcrypt/scrypt/argon2 (salt rounds ≥ 12)
- [ ] Session tokens are httpOnly, secure, sameSite
- [ ] Login has rate limiting
- [ ] Password reset tokens expire

### Authorization
- [ ] Every endpoint checks user permissions
- [ ] Users can only access their own resources
- [ ] Admin actions require admin role verification

### Input
- [ ] All user input validated at the boundary
- [ ] SQL queries are parameterized
- [ ] HTML output is encoded/escaped

### Data
- [ ] No secrets in code or version control
- [ ] Sensitive fields excluded from API responses
- [ ] PII encrypted at rest (if applicable)

### Infrastructure
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS restricted to known origins
- [ ] Dependencies audited for vulnerabilities
- [ ] Error messages don't expose internals
```
## See Also

For detailed security checklists and pre-commit verification steps, see `references/security-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is an internal tool, security doesn't matter" | Internal tools get compromised. Attackers target the weakest link. |
| "We'll add security later" | Security retrofitting is 10x harder than building it in. Add it now. |
| "No one would try to exploit this" | Automated scanners will find it. Security by obscurity is not security. |
| "The framework handles security" | Frameworks provide tools, not guarantees. You still need to use them correctly. |
| "It's just a prototype" | Prototypes become production. Security habits from day one. |

## Red Flags

- User input passed directly to database queries, shell commands, or HTML rendering
- Secrets in source code or commit history
- API endpoints without authentication or authorization checks
- Missing CORS configuration or wildcard (`*`) origins
- No rate limiting on authentication endpoints
- Stack traces or internal errors exposed to users
- Dependencies with known critical vulnerabilities

## Verification

After implementing security-relevant code:

- [ ] Dependency-audit tool (e.g. `npm audit`, `pip-audit`, `cargo audit`) shows no critical or high vulnerabilities
- [ ] No secrets in source code or git history
- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected endpoint
- [ ] Security headers present in response (check with browser DevTools)
- [ ] Error responses don't expose internal details
- [ ] Rate limiting active on auth endpoints
