# QueueStorm Investigator — Backend API

REST API built with **Node.js + Express** for the QueueStorm Investigator fintech support challenge.

> Status: Architecture scaffold only. Business logic intentionally not implemented yet.

---

## 📁 Project Structure

```
src/
├── config/          # Environment + app configuration
├── controllers/     # Route controllers (request/response layer)
├── routes/          # Express route definitions
├── services/        # Business logic / service modules
├── middleware/      # Custom Express middleware (logger, errors, validation)
├── validators/      # Input validation schemas / rules
├── utils/           # Shared utility helpers
├── constants/       # App-wide constants and enums
├── app.js           # Express app setup
└── server.js        # HTTP server entry point
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- npm

### Installation

```bash
npm install
cp .env.example .env
```

### Running

```bash
# Development
npm run dev

# Production
npm start
```

---

## 🌐 Endpoints

| Method | Endpoint           | Description                          |
| ------ | ------------------ | ------------------------------------ |
| GET    | `/health`          | Health check                         |
| POST   | `/analyze-ticket`  | Analyze a support ticket (placeholder) |

### GET `/health`

```json
{
  "status": "ok"
}
```

### POST `/analyze-ticket`

```json
{
  "message": "Business logic not implemented yet."
}
```

---

## 🚢 Deployment (Render)

1. Push to a Git provider.
2. Create a new **Web Service** on Render.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables from `.env.example`.

---

## 📝 License

MIT
