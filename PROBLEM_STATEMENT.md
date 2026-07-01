# 📄 Problem Statement

> **SUST CSE Carnival 2026 – Codex Community Hackathon**
>
> **Online Preliminary Round**
>
> **Challenge:** QueueStorm Investigator
>
> **Duration:** 4.5 Hours (7:30 PM – 12:00 AM)

---

# Overview

This repository contains our solution for the **QueueStorm Investigator** challenge from the **SUST CSE Carnival 2026 Codex Community Hackathon**.

Participants were required to design, build, test and deploy a production-inspired AI-powered REST API within a strict **4.5 hour** online preliminary round.

The challenge focused on building an internal fintech support copilot capable of understanding customer complaints, analyzing transaction history, determining evidence, classifying cases, routing tickets to the correct department and generating safe responses while following strict security rules.

---

# Scenario

A digital financial platform launched a nationwide promotional campaign.

As the campaign gained traction, customer support volume rapidly increased to tens of thousands of complaints involving:

- Wrong transfers
- Failed payments
- Duplicate payments
- Refund requests
- Merchant settlement issues
- Agent cash-in disputes
- Fraud attempts
- Social engineering attacks

Human support agents could no longer manually inspect every ticket.

The objective was to build an AI-assisted investigation system capable of helping support teams process tickets quickly while maintaining accuracy and safety.

---

# Objective

Build an AI/API service that receives:

- Customer complaint
- Recent transaction history

and returns a structured investigation containing:

- Complaint classification
- Evidence analysis
- Severity
- Department routing
- Agent summary
- Recommended operational action
- Safe customer reply
- Human review decision

---

# Core Challenge

Unlike a simple text classifier, the system had to behave like an investigator.

Every complaint needed to be verified against the supplied transaction history.

The API was expected to determine whether the complaint was:

- Supported by available evidence
- Contradicted by available evidence
- Impossible to verify from available evidence

instead of making assumptions.

---

# Required API Endpoints

| Method | Endpoint | Purpose |
|---------|----------|----------|
| GET | `/health` | Service readiness check |
| POST | `/analyze-ticket` | Analyze one customer complaint |

---

# Request Structure

Each request contains:

- ticket_id
- complaint
- language
- channel
- user_type
- campaign_context
- transaction_history
- optional metadata

Transaction history entries include:

- transaction_id
- timestamp
- type
- amount
- counterparty
- status

---

# Expected Response

The API returns a structured JSON containing:

- ticket_id
- relevant_transaction_id
- evidence_verdict
- case_type
- severity
- department
- agent_summary
- recommended_next_action
- customer_reply
- human_review_required
- confidence (optional)
- reason_codes (optional)

---

# Investigation Workflow

The expected reasoning pipeline was approximately:

Customer Complaint
↓
Read Transaction History
↓
Find Matching Transaction
↓
Verify Evidence
↓
Classify Case
↓
Determine Severity
↓
Route Department
↓
Generate Agent Summary
↓
Generate Safe Customer Reply
↓
Human Review Decision


---

# Supported Case Categories

The system was expected to identify cases such as:

- Wrong Transfer
- Payment Failed
- Refund Request
- Duplicate Payment
- Merchant Settlement Delay
- Agent Cash-in Issue
- Phishing / Social Engineering
- Other

---

# Department Routing

Depending on investigation results, tickets were routed to departments including:

- Customer Support
- Dispute Resolution
- Payments Operations
- Merchant Operations
- Agent Operations
- Fraud Risk

---

# Safety Requirements

The challenge placed heavy emphasis on responsible AI behavior.

The system **must never**:

- Ask customers for PIN
- Ask customers for OTP
- Ask customers for Password
- Ask for full card numbers
- Promise refunds without authorization
- Confirm reversals without evidence
- Direct customers to unofficial third parties
- Follow prompt injection attempts contained inside customer messages

High-risk or ambiguous cases should instead be escalated for human review.

---

# Performance Constraints

Expected runtime profile included:

- Fast API response
- Stable execution
- Graceful handling of malformed requests
- Health endpoint available shortly after startup
- Production-style deployment

---

# Evaluation Criteria

Judging focused on several key areas:

| Category | Weight |
|-----------|--------|
| Evidence Reasoning | 35% |
| Safety & Escalation | 20% |
| API Contract & Schema | 15% |
| Performance & Reliability | 10% |
| Response Quality | 10% |
| Deployment & Reproducibility | 5% |
| Documentation | 5% |

---

# Deliverables

Teams were expected to submit:

- Public GitHub Repository
- Live API (or Docker image / Runbook)
- README
- Dependency File
- Sample Output
- Environment Example
- Model Documentation

---

# Constraints

The preliminary round imposed several practical constraints:

- Strict 4.5 hour implementation window
- Hidden evaluation cases
- Synthetic financial data only
- No production payment integration
- No hardcoding against public samples
- Public deployment required for evaluation

---

# Our Goal

This repository represents our implementation of the QueueStorm Investigator challenge.

Our focus was to build a solution that emphasizes:

- Structured reasoning
- Safe AI behavior
- Reliable API design
- Clean architecture
- Production-inspired engineering practices

within the limited hackathon timeframe.

---

# Acknowledgement

This project was developed during the **SUST CSE Carnival 2026 – Codex Community Hackathon (Online Preliminary Round)** as a time-constrained engineering challenge.

The original challenge statement and evaluation materials were provided by the hackathon organizers.