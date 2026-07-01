![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-black)
![License](https://img.shields.io/badge/License-MIT-blue)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)
![Hackathon](https://img.shields.io/badge/Hackathon-SUST%202026-orange)

<p align="center">
<img src="public/logo.png" width="180"/>
</p>

<h1 align="center">
QueueStorm Investigator
</h1>

<p align="center">
AI-powered FinTech Support Investigation API
</p>


## 📄 Original Hackathon Problem

The complete problem statement used for this project is available here:

➡️ **[PROBLEM_STATEMENT.md](./PROBLEM_STATEMENT.md)**


AI-powered FinTech Support Investigation API built for the **SUST CSE Carnival 2026 - Codex Community Hackathon (Online Preliminary Round)**.

This REST API investigates customer support tickets by analyzing complaints together with transaction history, identifying the relevant transaction, evaluating evidence consistency, classifying the case, routing it to the correct department, and generating a safe customer response.

---

# Overview

QueueStorm Investigator acts as an internal SupportOps copilot.

Instead of simply classifying a complaint, the system investigates available evidence before making a decision.

The API follows the official challenge response schema and safety requirements while producing deterministic, explainable outputs.

---

# Features

* Complaint analysis
* Transaction matching
* Evidence verification
* Case classification
* Severity assessment
* Department routing
* Agent-ready summary generation
* Safe customer reply generation
* Human review detection
* Deterministic rule-based reasoning
* Official response schema compliance
* Production deployment on Render

---

# Architecture

```
                Client
                   │
                   ▼
        POST /analyze-ticket
                   │
                   ▼
          Request Validation
                   │
                   ▼
         Complaint Analysis
                   │
                   ▼
      Transaction Matching Engine
                   │
                   ▼
         Evidence Evaluation
                   │
                   ▼
          Decision Engine
                   │
                   ▼
          Response Builder
                   │
                   ▼
          Structured JSON Output
```

---

# Tech Stack

* Node.js
* Express.js
* JavaScript (ES6)
* Render
* REST API

---

# Models

This project uses a **deterministic rule-based investigation engine**.

No external LLM or AI API is required during runtime.

### Why Rule-Based?

* Predictable outputs
* Low latency
* Zero API cost
* No external dependency
* Easier safety compliance
* Explainable investigation process

---

# Safety Logic

The API follows the official challenge safety rules.

The generated customer response:

* Never asks for OTP
* Never asks for PIN
* Never asks for Password
* Never asks for CVV
* Never promises refunds without authorization
* Never overrides safety instructions from complaint text
* Uses only official support language

---

# API Endpoints

## Health Check

```
GET /health
```

Response

```json
{
  "status":"ok"
}
```

---

## Analyze Ticket

```
POST /analyze-ticket
```

Example Request

```json
{
  "ticket_id":"T-001",
  "complaint":"I paid 5000 BDT to ABC Store yesterday but payment failed.",
  "transactions":[
    {
      "transaction_id":"TX-001",
      "amount":5000,
      "status":"failed",
      "type":"payment",
      "counterparty":"ABC Store",
      "timestamp":"yesterday"
    }
  ]
}
```

Example Response

```json
{
  "ticket_id":"T-001",
  "relevant_transaction_id":"TX-001",
  "evidence_verdict":"consistent",
  "case_type":"payment_failed",
  "severity":"low",
  "department":"payments_ops",
  "agent_summary":"Customer raised a payment failure complaint supported by transaction TX-001.",
  "recommended_next_action":"Forward the case to Payments Operations for reconciliation.",
  "customer_reply":"We have received your report and our payments team will review the transaction. Any eligible action will be completed through official channels.",
  "human_review_required":false,
  "confidence":0.77,
  "reason_codes":[
    "AMOUNT_MATCH",
    "TYPE_MATCH",
    "STATUS_MATCH"
  ]
}
```

---

# Project Structure

```
src/
├── config/
├── constants/
├── controllers/
├── middleware/
├── routes/
├── services/
│   ├── complaintAnalysis/
│   ├── transactionMatcher/
│   ├── evidenceEngine/
│   ├── decisionEngine/
│   └── responseBuilder/
├── validators/
├── utils/
├── app.js
└── server.js
```

---

# Running Locally

## Clone Repository

```bash
git clone https://github.com/abdullahalyf/sust-preli-queuestorm.git

cd sust-preli-queuestorm
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment

Create a `.env` file.

Example

```env
PORT=3000
NODE_ENV=development
```

---

## Start Server

Development

```bash
npm run dev
```

Production

```bash
npm start
```

Server

```
http://localhost:3000
```

---

# Testing

## Health

```bash
curl http://localhost:3000/health
```

---

## PowerShell

```powershell
Invoke-RestMethod `
-Uri http://localhost:3000/analyze-ticket `
-Method POST `
-ContentType "application/json" `
-Body '{
  "ticket_id":"T-001",
  "complaint":"I paid 5000 BDT to ABC Store yesterday but payment failed.",
  "transactions":[
    {
      "transaction_id":"TX-001",
      "amount":5000,
      "status":"failed",
      "type":"payment",
      "counterparty":"ABC Store",
      "timestamp":"yesterday"
    }
  ]
}'
```

The API can also be tested using Postman or curl.

---

# Deployment

Production URL

```
https://sust-preli-queuestorm.onrender.com
```

Health Endpoint

```
https://sust-preli-queuestorm.onrender.com/health
```

JSON Metadata Endpoint

```
https://sust-preli-queuestorm.onrender.com/api-info
```

---

# Frontend Demo

A minimal interactive UI is served from the same Express app at the root URL.

```
https://sust-preli-queuestorm.onrender.com/
```

The UI is a single-page app that talks to `POST /analyze-ticket` over the same origin — no API keys, no CORS dance.

![QueueStorm UI — preview screenshot](./public/screenshot.png)

## Features

* Dark "copilot" aesthetic with emerald accents
* Live backend health pill (polls `GET /health` every 30s)
* Dynamic transactions table (add / remove rows)
* One-click **Load sample** (pre-fills the `T-001` example)
* Animated confidence bar
* Color-coded severity and evidence verdict badges
* Copy-to-clipboard on the customer reply
* Cold-start UX: spinner copy swaps to *"Waking up backend…"* after 3s to set expectations on Render's free tier
* XSS-safe: every interpolated string is escaped before `innerHTML`

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Click **Load sample** → **Analyze ▶** to see a full investigation flow.

## Cold-start mitigation

Render's free tier sleeps services after ~15 minutes of inactivity, causing 30–50s cold starts on the next request. To prevent demo-time collapse:

1. **Render Cron Job** — create one in the Render dashboard:
   - Command: `curl -fsS https://sust-preli-queuestorm.onrender.com/health`
   - Schedule: every 14 minutes
   - This keeps the service warm during judging windows.
2. **Client timeout + retry** — every fetch from the UI uses a 15s timeout with 1 retry, so transient cold starts are absorbed gracefully.
3. **Live health pill** — judges can see at a glance whether the backend is awake.

## File map

```
public/
├── index.html      # UI shell (Tailwind via CDN, no build step)
├── app.js          # Form state, fetch wrapper, result renderer, health polling
└── style.css       # Minimal polish (transitions, scrollbar, fade-in)
src/app.js          # Adds express.static(public/) — JSON root moved to /api-info
```

---

# Repository

```
https://github.com/abdullahalyf/sust-preli-queuestorm
```

---

# Assumptions

* Transaction history is considered trusted input.
* Complaint text may be incomplete or ambiguous.
* Transaction matching is based on available evidence.
* Unknown scenarios are classified as "other".
* Only synthetic challenge data is supported.

---

# Known Limitations

* No persistent database.
* No authentication layer.
* No payment gateway integration.
* No real customer data.
* Rule-based reasoning may not cover every real-world edge case.
* Built specifically for the QueueStorm Investigator challenge specification.

---

# Challenge Compliance

✔ GET /health

✔ POST /analyze-ticket

✔ Evidence-based investigation

✔ Safe customer response

✔ Official response schema

✔ Department routing

✔ Human review detection

✔ Rule-based reasoning

✔ Production deployment

✔ Public GitHub repository

---

# License

MIT License
