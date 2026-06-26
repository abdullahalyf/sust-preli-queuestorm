# QueueStorm Investigator — Backend API

A production-ready REST API built with **Node.js** and **Express** for the **QueueStorm Investigator** fintech support challenge.

The system automatically investigates fintech customer support tickets by:

- Analyzing customer complaints
- Matching transaction history
- Evaluating supporting evidence
- Classifying case types
- Routing to the correct department
- Assessing severity
- Detecting when human review is required
- Generating safe customer responses

The implementation follows the official QueueStorm response schema, enum definitions, and safety requirements.

---

# Features

- Complaint Analysis Engine
- Transaction Matching Engine
- Evidence Evaluation Engine
- Decision & Routing Engine
- Safe Response Builder
- Deterministic Rule-Based Logic
- Human Review Detection
- Official Response Schema
- Production-ready REST API
- Render Deployment

---

# System Architecture

```
Client
   │
   ▼
POST /analyze-ticket
   │
   ▼
Input Validation
   │
   ▼
Complaint Analysis
   │
   ▼
Transaction Matching
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
Final JSON Response
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

# Technology Stack

- Node.js
- Express.js
- JavaScript
- Render

---

# Quick Start

## Clone Repository

```bash
git clone https://github.com/abdullahalyf/sust-preli-queuestorm.git

cd sust-preli-queuestorm
```

## Install

```bash
npm install
```

## Configure Environment

Create a `.env`

Example

```env
PORT=3000
NODE_ENV=development
```

## Run

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

# API Endpoints

## Health Check

```
GET /health
```

Example Response

```json
{
  "status": "ok"
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
  "ticket_id": "T-001",
  "complaint": "I paid 5000 BDT to ABC Store yesterday but payment failed.",
  "transactions": [
    {
      "transaction_id": "TX-001",
      "amount": 5000,
      "status": "failed",
      "type": "payment",
      "counterparty": "ABC Store",
      "timestamp": "yesterday"
    }
  ]
}
```

Example Response

```json
{
  "ticket_id": "T-001",
  "relevant_transaction_id": "TX-001",
  "evidence_verdict": "consistent",
  "case_type": "payment_failed",
  "severity": "low",
  "department": "payments_ops",
  "agent_summary": "...",
  "recommended_next_action": "...",
  "customer_reply": "...",
  "human_review_required": false,
  "confidence": 0.77,
  "reason_codes": [
    "AMOUNT_MATCH",
    "TYPE_MATCH",
    "STATUS_MATCH"
  ]
}
```

---

# HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Validation Error |
| 404 | Route Not Found |
| 500 | Internal Server Error |

---

# Safety

The API follows the official challenge safety requirements.

- Never requests OTP, PIN, Password or CVV
- Never promises unauthorized refunds
- Resistant to prompt injection attempts
- Deterministic rule-based investigation
- Uses only official enum values
- Generates safe customer replies
- Supports human review escalation

---

# Local Testing

Health Check

```bash
curl http://localhost:3000/health
```

PowerShell Example

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

---

# Deployment

Production

```
https://sust-preli-queuestorm.onrender.com
```

Health

```
https://sust-preli-queuestorm.onrender.com/health
```

---

# Repository

GitHub

```
https://github.com/abdullahalyf/sust-preli-queuestorm
```

---

# Notes

- Deterministic rule-based implementation
- No external AI API required at runtime
- Follows the official QueueStorm response schema
- Supports evidence-based investigation
- Generates safe customer-facing responses
- Production deployment on Render

---

# License

MIT License