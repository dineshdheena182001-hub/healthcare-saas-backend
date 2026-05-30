# 🏥 Healthcare SaaS Backend API

> **SAMH** — Patient Management System Backend  
> Built with **Node.js + Express.js + MySQL**

---

## 📋 Table of Contents
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Architecture](#architecture)
- [Assumptions](#assumptions)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL 8.x |
| Auth | JWT (jsonwebtoken) |
| Password | bcryptjs (salt rounds: 12) |
| Validation | express-validator |
| Security | helmet, cors |
| API Docs | Swagger UI (swagger-jsdoc) |
| Logging | morgan |

---

## 📁 Project Structure

```
healthcare-backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js         # OTP + Patient ID login
│   │   ├── patientController.js      # Register + Profile CRUD
│   │   ├── dashboardController.js    # Dashboard summary + AI health
│   │   ├── appointmentController.js  # Doctors, booking, queue
│   │   └── wellnessController.js     # Wellness logging
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── patientRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── appointmentRoutes.js
│   │   └── wellnessRoutes.js
│   ├── middleware/
│   │   ├── auth.js                   # JWT verification
│   │   ├── validate.js               # express-validator handler
│   │   └── errorHandler.js           # Global error + 404
│   ├── models/                       # (DB queries in controllers/services)
│   ├── utils/
│   │   ├── jwt.js                    # generateToken, verifyToken
│   │   ├── response.js               # successResponse, errorResponse
│   │   ├── otpStore.js               # In-memory OTP (→ Redis in prod)
│   │   └── patientIdGenerator.js     # SAMH-XXXXX auto-generator
│   ├── config/
│   │   ├── database.js               # MySQL pool
│   │   └── swagger.js                # OpenAPI spec config
│   └── app.js                        # Entry point
├── schema.sql                        # Full DB schema + seed data
├── postman_collection.json           # Import into Postman
├── .env                              # Environment variables
├── package.json
└── README.md
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js >= 18.x
- MySQL 8.x

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/healthcare-saas-backend.git
cd healthcare-saas-backend
npm install
```

### 2. Configure Environment

```bash
cp .env .env.local
# Edit .env with your DB credentials
```

```env
PORT=3000
JWT_SECRET=your_strong_secret_key_here
JWT_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=healthcare_saas
```

### 3. Setup Database

```bash
mysql -u root -p < schema.sql
```

This creates all tables and seeds:
- 8 sample doctors  
- 1 test patient: `SAMH-10001` / password: `123456`
- Sample wellness data, appointment, therapy session, notifications

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:3000`  
Swagger Docs: `http://localhost:3000/api-docs`

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/send-otp` | Send OTP to mobile | ❌ |
| POST | `/api/auth/verify-otp` | Verify OTP → JWT | ❌ |
| POST | `/api/auth/login` | Login with Patient ID + Password | ❌ |
| POST | `/api/auth/logout` | Logout | ✅ |

### Patients

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/patients/register` | Register new patient | ❌ |
| GET | `/api/patients` | List patients (paginated) | ✅ |
| GET | `/api/patients/:id` | Get patient profile | ✅ |
| PUT | `/api/patients/:id` | Update profile + wellness | ✅ |

### Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/dashboard/home` | Full dashboard summary | ✅ |
| GET | `/api/dashboard/wellness` | Wellness vitals | ✅ |
| GET | `/api/dashboard/notifications` | Patient notifications | ✅ |

### Appointments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/doctors` | List doctors | ✅ |
| GET | `/api/doctors/:id/slots` | Available slots for date | ✅ |
| POST | `/api/appointments` | Book appointment | ✅ |
| GET | `/api/appointments/:id/queue` | Queue + wait time | ✅ |
| GET | `/api/appointments/patient/:id` | Patient history | ✅ |
| PATCH | `/api/appointments/:id/cancel` | Cancel appointment | ✅ |

### Wellness

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/wellness/log` | Log BP/sugar/sleep/stress | ✅ |
| GET | `/api/wellness/history/:id` | Trend history | ✅ |

---

## 🗃 Database Schema

```
patients          → core patient info + auth
auth_otp_log      → OTP audit trail
doctors           → doctor profiles + scheduling
appointments      → bookings with token numbers
queue_tracker     → real-time queue state per doctor/day
wellness_logs     → latest vitals per patient
therapy_sessions  → therapy schedule
notifications     → patient alerts
prescriptions     → pharmacy integration
```

**Relationships:**
- `appointments` → `patients` (FK, CASCADE DELETE)
- `appointments` → `doctors` (FK, CASCADE DELETE)
- `queue_tracker` → `doctors` (FK, 1 row per doctor/day)
- `wellness_logs` → `patients` (FK, 1 row per patient)
- `therapy_sessions` → `patients` (FK)
- `notifications` → `patients` (FK)
- `prescriptions` → `patients`, `doctors`, `appointments`

---

## 🏗 Architecture

```
Request → Middleware (helmet/cors/morgan)
        → Route
        → Validation Middleware (express-validator)
        → Auth Middleware (JWT)
        → Controller
        → MySQL Pool (query)
        → Response Helper
        → JSON Response

Errors → Global Error Handler → Structured JSON error
```

**Key design decisions:**
- **OTP Store**: In-memory Map with expiry. Replace with Redis for production/multi-instance deployment.
- **Patient ID**: Auto-incremented from DB last record, format `SAMH-XXXXX`.
- **Queue**: `queue_tracker` table stores `current_token` per doctor/day. In production, update via WebSocket or polling.
- **Wellness**: Single row per patient (`UPSERT`). Separate audit/history table can be added for trend data.
- **Passwords**: bcrypt with salt rounds 12.
- **JWT**: Stateless, 7-day expiry. Add refresh tokens for production.

---

## 📌 Assumptions

1. **OTP delivery**: Mock OTP returned in response (no SMS gateway). Replace with Twilio/MSG91 in production.
2. **Doctor slots**: Fixed 15-minute slots from 9AM–5PM. Can be made configurable per doctor.
3. **Queue wait time**: Calculated as `(token - current_token) × 15 minutes`. Real-time updates via polling or WebSocket.
4. **Wellness logs**: Stores latest reading per patient. Full history can be added with a separate `wellness_history` table.
5. **AI health summary**: Rule-based threshold logic (BP > 140, sugar > 140, sleep < 6, stress > 70). Replace with actual ML model if needed.
6. **Single patient per appointment slot**: Enforced via DB unique constraint.
7. **No frontend**: Pure REST API, tested via Postman/Swagger.

---

## 🧪 Testing with Postman

1. Import `postman_collection.json` into Postman
2. Set `baseUrl` variable to `http://localhost:3000`
3. Run **"Login with Patient ID"** → token auto-saved to collection variable
4. All other requests use `{{token}}` automatically

---

## 📦 Bonus Features Implemented

- ✅ Swagger Documentation (`/api-docs`)
- ✅ Validation Middleware (express-validator)
- ✅ Error Handling Middleware (global + 404)
- ✅ Pagination (patients list)
- ✅ Security headers (helmet)
- ✅ CORS configured
- ✅ AI health summary (rule-based)
- ✅ Notification system
- ✅ Prescription/Pharmacy table (schema ready)
- ✅ Doctor slot availability check

---

*Built for SAMH Healthcare SaaS Platform*
#   h e a l t h c a r e - s a a s - b a c k e n d  
 