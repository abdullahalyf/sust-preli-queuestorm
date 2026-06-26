# QueueStorm Investigator — Backend API

A production-ready REST API built with **Node.js** and **Express** for the **QueueStorm Investigator** fintech support challenge.

The API automatically investigates customer support tickets by analyzing complaints, matching transaction history, evaluating evidence, classifying the case, and generating safe, structured responses following the official problem statement.

---

# Features

* Complaint analysis and information extraction
* Deterministic transaction matching
* Evidence consistency evaluation
* Intelligent case classification
* Department routing
* Severity assessment
* Human review detection
* Safe customer response generation
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
Evidence Engine
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

# API Endpoints

## Health Check

```
GET /health
```

Response

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

# Safety

The API follows the challenge safety requirements.

* Never requests OTP, PIN, Password or CVV.
* Never promises unauthorized refunds.
* Resistant to prompt-injection style complaint text.
* Uses deterministic rule-based investigation.
* Returns only official enum values defined in the problem statement.

---

# Technology Stack

* Node.js
* Express.js
* JavaScript
* Render

---

# Local Development

```bash
npm install
cp .env.example .env
npm start
```

---

# Production

Render Deployment

https://sust-preli-queuestorm.onrender.com

Health Endpoint

https://sust-preli-queuestorm.onrender.com/health

---

# Repository

GitHub

https://github.com/abdullahalyf/sust-preli-queuestorm

---

# License

MIT License
