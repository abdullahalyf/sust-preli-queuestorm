# Session Summary — QueueStorm Investigator

**Date:** June 30, 2026
**Project:** QueueStorm Investigator — Fintech support challenge REST API
**Repository:** `F:\Hackathon\Hackathon Preli\preli_final`
**Context:** SUST CSE Carnival 2026 — Codex Community Hackathon (Online Preliminary Round)
**Built in:** ~4 hours

---

## Project Overview

A REST API that acts as an automated support-ticket investigator for fintech (bKash/Nagad-like) platforms. It accepts a customer complaint + transaction history and returns: case classification, severity, department routing, evidence verdict, agent summary, safe customer reply, and reason codes.

Built with a deterministic rule-based pipeline — no LLMs, no external API calls.

---

## Architecture — 5-Stage Pipeline

```
Client → Validation → ComplaintAnalysis → TransactionMatcher → EvidenceEngine → DecisionEngine → ResponseBuilder → Client
```

| Stage | Module | Responsibility |
|-------|--------|----------------|
| 1 | `complaintAnalysis/` | Normalize text (EN/BN/Banglish), extract structured fields (amount, intent, time, counterparty, fraud indicators, security mentions) |
| 2 | `transactionMatcher/` | Score each transaction against complaint using weighted fields (amount=50, type=20, status=15, time=10, counterparty=5, keywords=10). Return best match above threshold |
| 3 | `evidenceEngine/` | Compare complaint fields vs matched transaction. Produce verdict: `consistent`, `inconsistent`, or `insufficient_data` |
| 4 | `decisionEngine/` | Classify case type (8 enums), assign severity (low/critical), route to department (6 enums). Emit reasoning signals |
| 5 | `responseBuilder/` | Assemble final JSON: agent summary, recommended action, safe customer reply, confidence, reason codes |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥18, CommonJS |
| Framework | Express 4.19 |
| Security | helmet, cors (all origins) |
| Logging | morgan (HTTP) + custom logger |
| Validation | Hand-rolled (no Joi/Zod) |
| Deployment | Render |
| Persistence | None (stateless) |
| Testing | None (placeholder) |
| Type safety | None (plain JS) |
| Linting | None |

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | `{ "status": "ok" }` |
| `POST` | `/analyze-ticket` | Accept `{ ticket_id, complaint, transactions[] }` → structured investigation result |

---

## Folder Structure

```
src/
├── app.js                         # Express setup (helmet, cors, morgan, json parsing)
├── server.js                      # Entry point, graceful shutdown (SIGTERM/SIGINT)
├── config/index.js                # dotenv config loader (PORT, NODE_ENV, LOG_LEVEL)
├── constants/index.js             # HTTP_STATUS, ERROR_CODES, ENV
├── controllers/
│   ├── health.controller.js       # GET /health handler
│   └── ticket.controller.js       # POST /analyze-ticket handler
├── middleware/
│   ├── errorHandler.js            # Global error handler (env-aware stack traces)
│   ├── notFound.js                # 404 handler
│   ├── requestLogger.js           # Per-request duration logging
│   └── validate.js                # Validation middleware factory
├── routes/
│   ├── index.js                   # Route aggregator
│   ├── health.routes.js           # GET /health
│   └── ticket.routes.js           # POST /analyze-ticket (with validation)
├── services/
│   ├── ticket.service.js          # Pipeline orchestrator
│   ├── complaintAnalysis/         # 4 files (index, normalizer, parser, dictionaries)
│   │   ├── index.js               # Entry: analyzeComplaint(text)
│   │   ├── normalizer.js          # Text normalization (transliteration, lowercasing, Banglish → EN)
│   │   ├── parser.js              # Structured field extraction (amount, intent, time, etc.)
│   │   └── dictionaries.js        # All keyword maps (EN/BN/Banglish)
│   ├── transactionMatcher/        # 3 files (index, matcher, scoring)
│   │   ├── index.js               # Entry: matchTransaction(analysis, transactions)
│   │   ├── matcher.js             # Candidate scoring & selection (threshold + margin gates)
│   │   └── scoring.js             # Per-field scoring functions
│   ├── evidenceEngine/            # 2 files (index, evaluator)
│   │   ├── index.js               # Entry: evaluateEvidence(analysis, matchResult)
│   │   └── evaluator.js           # Weighted field comparison + verdict rollup
│   ├── decisionEngine/            # 4 files (index, classifier, router, severity)
│   │   ├── index.js               # Entry: decide(analysis, matchResult, evidence)
│   │   ├── classifier.js          # Case type classification (8 types, priority-ordered)
│   │   ├── router.js              # Department routing (6 departments)
│   │   └── severity.js            # Severity scoring (low → critical)
│   └── responseBuilder/
│       └── index.js               # Final response assembly (~500 lines)
├── validators/
│   └── ticket.validator.js        # Request body validation (hand-rolled)
└── utils/
    ├── ApiError.js                # Custom error class with statusCode + code + details
    ├── asyncHandler.js            # Async route wrapper (catch → next)
    └── logger.js                  # Level-aware console logger (debug/info/warn/error)
```

---

## Bug Audit (from code review)

### Critical

| # | File | Issue |
|---|------|-------|
| 1 | `validators/ticket.validator.js` + `controllers/ticket.controller.js` | **Validated data never used** — `req.validated` is flat but controller reads `req.validated.body` (undefined). Falls back to raw `req.body`. Sanitization is silently discarded. |
| 2 | `services/complaintAnalysis/normalizer.js:123` + `parser.js:39-52` | **Banglish language detection broken** — `normalizeBanglish()` converts tokens ("ajke"→"today") BEFORE `detectLanguage()` checks for them. All Banglish input misclassified as English. |
| 3 | `services/transactionMatcher/scoring.js:35` + `matcher.js:150` | **Comment contradicts code** — comment says "amount-only alone does not pass" but threshold=35 and amount weight=50, so amount-only matches when no runner-up exists. |
| 4 | `services/responseBuilder/index.js:387` | **Hardcoded SCORE_MAX=110** — duplicates `scoring.js:25`. If weights change, confidence normalization silently breaks. |
| 5 | `services/evidenceEngine/evaluator.js:141-184` | **Time/counterparty evaluation delegates to matcher** — checks `matchResult.matchedFields` instead of comparing directly. "No match" reported as "conflict", semantically wrong. |
| 6 | `services/transactionMatcher/matcher.js:140` | **`Date.now()` at runtime** — same payload at different times returns different results, violating determinism claim. |
| — | No authentication | API is fully open. |
| — | CORS allows all origins | `cors()` with no options = `Access-Control-Allow-Origin: *`. |

### Medium

| # | Issue |
|---|--------|
| 7 | No rate limiting |
| 8 | No per-transaction field validation |
| 9 | No max-length enforcement on `ticket_id` or `complaint` |
| 10 | `Date.parse()` for timestamp parsing (fails silently on many formats) |
| 11 | `transliterateBangla()` iterative replacement can match inside prior replacements |
| 12 | No fallback for `human_review_required` when confidence low |
| 13 | Synchronous pipeline blocks event loop on CPU-intensive NLP |
| 14 | No caching — every request recomputes everything |

### Minor

| # | Issue |
|---|--------|
| 15 | Duplicate phishing condition in `classifier.js` (FIXED) |
| 16 | Duplicate duplicate-payment check in `classifier.js` |
| 17 | Redundant `.toLowerCase()` in `normalizer.js` |
| 18 | `console.warn` instead of `logger.warn` in `config/index.js` |
| 19 | Misleading comment on `normalizeAmountSuffixes` |
| 20 | Evidence coverage threshold too strict (40% coverage → insufficient_data) |
| 21 | "yesterday" time window too wide (18-42h) |
| 22 | Stack traces leaked in non-production (risk if NODE_ENV misconfigured) |
| 23 | Loose comma-grouped number regex (accepts Indian numbering patterns partially) |
| 24 | No environment validation on startup (silent defaults) |

---

## Improvement Roadmap (Easiest → Hardest)

### Tier 1 — Quick Fixes (~18 min total)
1. ~~Remove duplicate phishing condition~~ ✅ **DONE**
2. Remove duplicate duplicate-payment check
3. Remove redundant `.toLowerCase()`
4. Replace `console.warn` with `logger.warn`
5. Fix misleading comment
6. Add max-length enforcement in validator
7. Fix root route path for non-root apiPrefix

### Tier 2 — Small Changes (~3.5 hr total)
8. Fix validated data not applied (controller reads wrong path)
9. Fix Banglish language detection ordering
10. Export SCORE_MAX from scoring.js, import in responseBuilder
11. Add env validation on startup (fail fast)
12. Sanitize/coerce individual transaction fields
13. Restrict CORS to specific origins
14. Add rate limiting middleware
15. Add request body size limit in validator

### Tier 3 — Moderate Effort (~12.5 hr total)
16. Add ESLint + Prettier config
17. Add test framework (vitest/jest) + first test suite
18. Fix evidence engine time/counterparty to compare directly
19. Inject Date.now() from entry point for determinism
20. Add request IDs (UUID per request)
21. Add structured JSON logging
22. Fix evidence coverage threshold to be field-weight-aware

### Tier 4 — Significant Effort (~8 hr total)
23. Add OpenAPI/Swagger docs
24. Add authentication (API key header)
25. Add response compression
26. Add human-review fallback for low confidence
27. Add health check dependency verification

### Tier 5 — Infrastructure (~5-6 days total)
28. Add persistence layer (PostgreSQL)
29. Add caching (Redis)
30. Dockerize (Dockerfile + docker-compose)
31. Add CI/CD pipeline (GitHub Actions)
32. Add cluster mode (Node.js cluster)

### Tier 6 — Rearchitecture (~2.5-5 weeks total)
33. Move CPU-intensive NLP to worker threads
34. Replace hand-rolled validator with Joi/Zod
35. TypeScript migration
36. Async event-driven architecture (message queue)

---

## Assets

| File | Purpose |
|------|---------|
| `src/services/complaintAnalysis/dictionaries.js` | 379 lines — all keyword maps (English, Bangla, Banglish, intent terms, status terms, fraud indicators, security keywords, important keywords) |
| `src/services/decisionEngine/classifier.js` | 8 case types: `wrong_transfer`, `payment_failed`, `refund_request`, `duplicate_payment`, `merchant_settlement_delay`, `agent_cash_in_issue`, `phishing_or_social_engineering`, `other` |
| `src/services/decisionEngine/router.js` | 6 departments: `customer_support`, `dispute_resolution`, `payments_ops`, `merchant_operations`, `agent_operations`, `fraud_risk` |
| `src/services/decisionEngine/severity.js` | 4 severity levels: `low`, `medium`, `high`, `critical` |
| `src/services/responseBuilder/index.js` | ~500 lines — templates for safe customer replies (never asks for OTP/PIN/password, never promises refunds) |

---

## Decisions Made

1. **Keep as plain JS** — TypeScript migration is Tier 6; not urgent for hackathon.
2. **Fix bugs before adding features** — Banglish detection and validation bypass are the two most impactful fixes.
3. **Export `_internals` for testability** — Already done; scoring.js, parser.js, evaluator.js all export internals for unit testing without mocking.
4. **Incremental productionization** — The architecture doesn't need a rewrite. Add tests → fix bugs → add DB → add auth in that order.

---

## Next Steps

1. ✅ Remove duplicate phishing condition (DONE — `classifier.js`)
2. Remove duplicate duplicate-payment check
3. Fix Banglish language detection ordering
4. Fix `req.validated.body` → `req.validated`
5. Add test framework + first tests (start with scoring.js — pure functions, no deps)
6. Add ESLint + Prettier
7. Add rate limiting

---

# Session Addendum — Frontend UI (1 Jul 2026)

**Branch:** `post-hackathon-improvements`
**Scope:** Add a minimal interactive web frontend served by the existing Express service.
**Status:** Implemented. Local smoke test pending in user's environment (sandbox blocked background shells).

## Goal

Ship a one-page UI that talks to `POST /analyze-ticket` and renders the official response schema (severity, evidence verdict, case type, department, confidence, agent summary, recommended action, customer reply, reason codes, human-review flag). Zero new dependencies, zero build step, single Render service.

## Decisions

| # | Decision | Why |
|---|---|---|
| F1 | Static `public/` mounted via `express.static` (not a separate Static Site) | One URL serves both UI and API → no CORS, no extra Render service, no build pipeline. Same-origin fetch. |
| F2 | Tailwind via CDN (no PostCSS / build) | Fastest to ship; hackathon scope; ~3% perf hit is irrelevant for demo traffic. |
| F3 | Vanilla JS (no React/Vue) | Avoids a build step; UI is one form + one result panel — React would be ceremony. |
| F4 | Same-origin relative URLs (`""` API_BASE) | Static is served by the same Express app; CORS already `*` but we don't even need it. |
| F5 | 15s fetch timeout + 1 retry (1.5s backoff) | Render free tier cold starts can take 30–50s; retry absorbs the first hit, button-state lock prevents double-fire. |
| F6 | 30s `/health` polling with live pill | Judges see the system is instrumented; pill is part of the demo. |
| F7 | 3s "Waking up backend…" copy swap | Sets expectations honestly when cold-start is happening. |
| F8 | XSS escape (`esc()`) on every interpolated string | Backend echoes user-controlled `ticket_id` and `customer_reply`; never trust input into `innerHTML`. |
| F9 | `static` `maxAge: '1h'` | Repeated demo visits load instantly. |
| F10 | JSON root moved from `/` to `/api-info` | The UI now owns `/`; programmatic clients can still discover service metadata at `/api-info`. |

## Files Added

| Path | Lines | Purpose |
|---|---|---|
| `public/index.html` | 106 | UI shell: header (title + health pill), two-column grid (left = inputs, right = result), footer with backend URL. Tailwind via CDN. |
| `public/app.js` | 417 | All dynamic logic: transactions table add/remove, sample loader, fetch wrapper with AbortController + retry, validation, result renderer (severity badges, animated confidence bar, reason-code chips, copy-to-clipboard), health polling, cold-start UX, XSS escape helper. Ctrl/Cmd+Enter shortcut. |
| `public/style.css` | 70 | Polish layer: fade-in animation, smooth scrollbar, focus carets, `::selection`, number-input spinner suppression, confidence-bar transition. |
| `.puku/smoke.js` | 73 | In-process smoke test (boots the Express app on :3102, hits 6 endpoints, prints pass/fail). Not part of the shipped app — kept in `.puku/`. |

## Files Modified

| Path | Change |
|---|---|
| `src/app.js` | Added `const path = require('path')` import. Mounted `express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html', extensions: ['html'] })` **before** the API router. Replaced `GET /` JSON handler with `GET /api-info`. All security middleware (helmet, cors, express.json) untouched. |
| `README.md` | Added `# Frontend Demo` section with feature list, cold-start mitigation, and file map. Added `/api-info` to the deployment endpoints list. Screenshot placeholder at `public/screenshot.png`. |

## What Stayed the Same

- `package.json` — **no new dependencies**. `express.static` is bundled.
- All API contracts — `GET /health`, `POST /analyze-ticket` unchanged.
- All backend modules — no edits to services/, validators/, middleware/.
- helmet + CORS settings — same.

## Collapse-Prevention Stack

| Layer | Mechanism |
|---|---|
| Service warm | Render Cron Job: `curl -fsS https://sust-preli-queuestorm.onrender.com/health` every 14 min. Configured in Render dashboard (no file change). |
| Client retry | `fetchJSON()` uses `AbortController` with 15s timeout + 1 retry. |
| Visual feedback | Health pill (30s polling), spinner copy swap at 3s, error card with retry hint. |
| Input safety | Client-side validation (empty complaint / no transactions → inline error, no network call). |
| Security | XSS escape on every interpolated string; helmet sets safe defaults for static files. |

## Verification Performed in Sandbox

- `node --check public/app.js` → OK
- `node --check src/app.js` → OK
- File presence verified: `public/{index.html, app.js, style.css}` all on disk
- `src/app.js` re-read after edit — `express.static` mount confirmed before API router; JSON metadata at `/api-info`
- Response schema coverage: `renderResult()` consumes all 11 fields from the official schema

## Verification Pending (Manual, User's Environment)

- `npm run dev` → open `http://localhost:3000/` → click *Load sample* → *Analyze ▶*
- Network tab: `index.html`, `app.js`, `style.css` all `200 OK`
- `curl -X POST http://localhost:3000/analyze-ticket -H 'Content-Type: application/json' -d @sample.json`
- After Render deploy: `https://sust-preli-queuestorm.onrender.com/` returns UI; `/health` and `/api-info` return JSON

## Open Items (Not Blockers)

- `public/screenshot.png` placeholder is referenced in README — drop in a real screenshot before pitch.
- Tailwind CDN is a single external dependency; if cdn.tailwindcss.com is unreachable, layout degrades. Acceptable for hackathon scope.
- No automated browser test — manual click-through is the verification path.
