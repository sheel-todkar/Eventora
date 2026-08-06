<p align="center">
  <h1 align="center">🎟️ Eventora</h1>
  <p align="center">
    A full-stack event management and booking platform with integrated payments, email verification, and role-based access control.
  </p>
  <p align="center">
    <a href="https://eventora-nu.vercel.app/">Live Demo</a> · <a href="https://github.com/sheel-todkar/Eventora">GitHub Repository</a>
  </p>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Authentication & Security](#authentication--security)
- [Payment Integration](#payment-integration)
- [Booking Flow](#booking-flow)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Engineering Decisions](#engineering-decisions)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Overview

Eventora is a production-grade event booking platform where users can browse, search, and book events — with support for both free registrations and paid ticket purchases via Razorpay. Admins manage event listings, track bookings, and monitor revenue through a dedicated dashboard.

The application implements a complete user lifecycle: email-based registration with OTP verification, JWT authentication, password reset flows, and role-based route protection on both frontend and backend.

---

## Key Features

### User-Facing
- **Event Discovery** — Browse events with category filtering and search by title
- **Event Details** — View date, time, location, pricing, seat availability with real-time occupancy bar
- **Ticket Booking** — Register for free events instantly or purchase paid tickets via Razorpay
- **Booking Management** — View personal booking history, track payment status, cancel unpaid bookings
- **Email Notifications** — Receive booking confirmation emails after successful registration/payment

### Authentication
- **OTP-Based Registration** — Email verification via 6-digit OTP before account activation
- **Forgot/Reset Password** — OTP-based password reset flow with dedicated pages
- **JWT Sessions** — Token-based authentication with 7-day expiry (configurable via `JWT_EXPIRES_IN`), persisted in localStorage

### Admin Panel
- **Dashboard Analytics** — Aggregated stats: total events, bookings, revenue, seat utilization (via MongoDB aggregation pipeline)
- **Event CRUD** — Create, update, and delete events with image support and category tagging
- **Booking Management** — View all bookings across users, confirm pending bookings, track payment statuses

### Performance & Security
- **Redis Caching Layer** — Cache-aside implementation (listings 60s, details 120s, stats 30s) with active cache invalidation on write events and SCAN-based non-blocking pattern deletions
- **Graceful Cache Degradation** — Application runs seamlessly even if the Redis server goes offline by falling back to MongoDB directly
- **Rate Limiting** — Global (100 req/15min), auth-specific (15 req/15min), and OTP-specific (5 req/15min) limits
- **Input Validation** — Server-side validation on every endpoint using `express-validator`
- **Atomic Seat Management** — MongoDB `$inc` with conditional `$gt: 0` queries to prevent overbooking under concurrency
- **CORS Configuration** — Dynamic origin validation supporting local development and Vercel preview deployments
- **Graceful Shutdown** — SIGINT/SIGTERM handlers for clean MongoDB and Redis connection teardown

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, React Router 7 | SPA with client-side routing |
| **Build Tool** | Vite 8 | Fast dev server and optimized production builds |
| **HTTP Client** | Axios | API communication with JWT interceptor |
| **Backend** | Node.js, Express 5 | REST API server |
| **Database** | MongoDB (Mongoose 9) | Document store with schema validation |
| **Caching** | Redis (Node-Redis v4) | Cache-aside database query performance optimizer |
| **Authentication** | JWT (jsonwebtoken), bcryptjs | Token-based auth with password hashing |
| **Payments** | Razorpay | Payment gateway with server-side signature verification |
| **Email** | Nodemailer (Gmail SMTP) | OTP delivery and booking confirmations |
| **Validation** | express-validator | Request body/param sanitization and validation |
| **Rate Limiting** | express-rate-limit | Brute-force protection |
| **Containerization** | Docker, Docker Compose | Consistent multi-container environments |
| **Web Server** | Nginx | Reverse proxy, static asset serving, compression, and request routing |
| **Frontend Hosting** | Vercel | CDN-backed SPA hosting |
| **Backend Hosting** | Render / AWS EC2 | Production Node.js server hosting |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client (React SPA)                            │
│           Vercel CDN — Vite build → static HTML/JS/CSS                 │
│                                                                        │
│  AuthContext ──→ localStorage (JWT token)                              │
│  Axios Instance ──→ auto-attaches Bearer token                        │
│  React Router ──→ ProtectedRoute / AdminRoute guards                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTPS (REST)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Nginx Reverse Proxy                             │
│       Listens on Port 80, serves React build, routes /api/* requests    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Server (Express 5 on Render/EC2)                   │
│                                                                        │
│  Middleware Stack:                                                     │
│  ┌─ CORS (dynamic origin whitelist)                                    │
│  ├─ Global Rate Limiter (100 req / 15 min)                             │
│  ├─ JSON body parser (10 MB limit)                                     │
│  └─ Route-specific: auth middleware, validation                        │
│                                                                        │
│  Routes:                                                               │
│  /api/auth/*     → authController                                      │
│  /api/events/*   → eventController                                     │
│  /api/bookings/* → bookingController                                   │
│  /api/health     → DB ping health check                                │
│                                                                        │
│  Razorpay SDK ──→ Order creation + HMAC signature                      │
│  Nodemailer   ──→ Gmail SMTP (OTP + confirmations)                     │
└──────────────────┬───────────────────────────────┬─────────────────────┘
                   │ Cache-Aside                   │ Mongoose (Pool: 10)
                   ▼                               ▼
┌──────────────────────────────────────┐ ┌──────────────────────────────┐
│            Redis Cache               │ │        MongoDB Atlas         │
│                                      │ │                              │
│  - Events list cache (TTL 60s)       │ │  Collections: users, events, │
│  - Single event cache (TTL 120s)     │ │               bookings, otps │
│  - Admin stats cache (TTL 30s)       │ │  TTL Index: OTP auto-expiry  │
│  - Non-blocking SCAN-based clear     │ │  Compound & Text indexes     │
└──────────────────────────────────────┘ └──────────────────────────────┘
```

---

## Database Schema

### User
```javascript
{
  name:       String,       // required, 2-100 chars
  email:      String,       // required, unique, normalized
  password:   String,       // bcrypt hashed (10 salt rounds)
  role:       'user' | 'admin',  // default: 'user', hardcoded on registration
  isVerified: Boolean,      // false until OTP verification
  timestamps: true          // createdAt, updatedAt
}
```

### Event
```javascript
{
  title:          String,    // required, max 200 chars
  description:    String,    // required, max 5000 chars
  date:           Date,      // required, must be in the future
  location:       String,    // required
  category:       Enum,      // technology | community | music | business | sports | arts | education | other
  totalSeats:     Number,    // min: 1
  availableSeats: Number,    // min: 0, capped at totalSeats via pre-save hook
  ticketPrice:    Number,    // 0 = free event, min: 0
  image:          String,    // optional, base64 or URL
  status:         Enum,      // upcoming | ongoing | completed | cancelled
  createdBy:      ObjectId → User,

  // Virtuals (computed, not stored):
  isSoldOut:        Boolean,   // availableSeats === 0
  bookedSeats:      Number,    // totalSeats - availableSeats
  occupancyPercent: Number,    // percentage of seats booked
  isFree:           Boolean,   // ticketPrice === 0

  // Indexes:
  // - { category: 1, date: 1 }              → filter + sort
  // - { title: 'text', description: 'text' } → full-text search
  // - { createdBy: 1 }                       → organizer lookup
  // - { date: 1, availableSeats: 1 }         → upcoming + available
  // - { status: 1, date: 1 }                 → status-based queries
}
```

### Booking
```javascript
{
  userId:            ObjectId → User,
  eventId:           ObjectId → Event,
  quantity:          Number,    // default: 1
  status:            'pending' | 'confirmed' | 'cancelled',
  paymentStatus:     'pending' | 'paid' | 'failed' | 'not_paid',
  amount:            Number,    // ticket price at time of booking
  razorpayOrderId:   String,    // set after Razorpay order creation
  razorpayPaymentId: String,    // set after payment verification
  timestamps:        true,

  // Indexes:
  // - { userId: 1, createdAt: -1 } → user's booking history
  // - { eventId: 1 }               → event's bookings
}
```

### OTP
```javascript
{
  email:  String,
  otp:    String,     // 6-digit numeric
  action: 'account_verification' | 'password_reset',
  // TTL index: auto-deletes after 5 minutes
}
```

---

## API Reference

### Authentication — `/api/auth`

| Method | Endpoint | Rate Limit | Body | Description |
|--------|----------|------------|------|-------------|
| `POST` | `/register` | 15/15min | `{ name, email, password }` | Create account → sends OTP email |
| `POST` | `/login` | 15/15min | `{ email, password }` | Returns JWT (or re-sends OTP if unverified) |
| `POST` | `/verify-otp` | 5/15min | `{ email, otp }` | Verify account → returns JWT |
| `POST` | `/forgot-password` | 15/15min | `{ email }` | Sends password-reset OTP (no email enumeration) |
| `POST` | `/reset-password` | 5/15min | `{ email, otp, newPassword }` | Resets password after OTP validation |

### Events — `/api/events`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | None | List all events |
| `GET` | `/:id` | None | Get single event by ID |
| `POST` | `/` | Admin | Create event (validated: title, description, date, location, category, totalSeats) |
| `PUT` | `/:id` | Admin | Update event (partial updates supported) |
| `DELETE` | `/:id` | Admin | Delete event |

### Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | User | Register for event (free → auto-confirm, paid → pending) |
| `POST` | `/pay-now` | User | Create Razorpay payment order for pending booking |
| `POST` | `/verify-payment` | User | Verify Razorpay HMAC signature → confirm booking |
| `GET` | `/status/:eventId` | User | Check user's booking status for an event |
| `GET` | `/my` | User/Admin | User: own bookings; Admin: all bookings |
| `GET` | `/stats` | Admin | Aggregated dashboard stats (revenue, counts, seat utilization) |
| `PUT` | `/:id/confirm` | Admin | Manually confirm a pending booking |
| `DELETE` | `/:id` | User/Admin | Cancel booking (only if unpaid; restores seat if was confirmed) |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Returns `{ status: 'OK', db: 'connected' }` or 500 with error |

---

## Authentication & Security

### Authentication Flow
1. **Registration**: User submits name, email, password → server creates unverified user → sends 6-digit OTP via email
2. **OTP Verification**: User enters OTP → server validates against OTP collection → marks user as verified → returns JWT
3. **Login**: Credentials validated → if unverified, re-sends OTP and returns 403; if verified, returns JWT
4. **Password Reset**: User requests reset → OTP sent → user submits OTP + new password → password updated

### Security Measures
- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT**: Signed with `JWT_SECRET`, default 7-day expiry (`JWT_EXPIRES_IN`), includes `{ id, role }` payload
- **OTP**: Generated with `crypto.randomInt()` (cryptographically secure)
- **HTTP headers**: `helmet` middleware in production
- **Role Hardcoding**: Registration always sets `role: 'user'` regardless of request body (prevents privilege escalation)
- **Email Enumeration Prevention**: Forgot-password endpoint returns same message whether email exists or not
- **Rate Limiting**: Three tiers — global, auth-specific, OTP-specific — using `express-rate-limit`
- **Input Sanitization**: All inputs validated and sanitized via `express-validator` (email normalization, length limits, type checks)
- **CORS**: Whitelist-based with support for local dev ports and `*.vercel.app` preview URLs

---

## Payment Integration

Eventora uses **Razorpay** for processing paid event tickets:

```
User registers for paid event
        ↓
Backend creates Booking (status: pending, paymentStatus: not_paid)
        ↓
User clicks "Pay Now" → backend creates Razorpay Order
        ↓
Frontend opens Razorpay Checkout modal (client-side SDK)
        ↓
User completes payment → Razorpay calls handler
        ↓
Frontend sends {order_id, payment_id, signature} to backend
        ↓
Backend verifies HMAC-SHA256 signature using Razorpay key secret
        ↓
On success: booking → confirmed, paymentStatus → paid
            seat atomically decremented
            confirmation email sent
```

- **Signature Verification**: `HMAC-SHA256(order_id|payment_id, key_secret)` compared against Razorpay-provided signature
- **Atomic Seat Deduction**: `findOneAndUpdate` with `{ availableSeats: { $gt: 0 } }` — prevents overselling even under concurrent requests

---

## Booking Flow

### Free Events
```
Register → Atomic seat deduction → Booking created (status: confirmed) → Done
```

### Paid Events
```
Register → Booking created (status: pending) → Pay Now → Razorpay Checkout
  → Payment verified → Seat deducted → Booking confirmed → Email sent
```

### Cancellation
- Only unpaid bookings can be cancelled by the user
- If the booking was confirmed (seat was deducted), the seat is atomically restored
- Paid bookings cannot be cancelled (requires manual refund processing)

### Duplicate Prevention
- Before registering, the system checks for existing `pending` or `confirmed` bookings for the same user + event combination

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **MongoDB** (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- **Redis** (local instance or running container for caching; optional, system degrades gracefully if absent)
- **Gmail App Password** for email functionality ([how to generate](https://support.google.com/accounts/answer/185833))
- **Razorpay Test Keys** for payment testing ([get test keys](https://dashboard.razorpay.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/sheel-todkar/Eventora.git
cd Eventora

# Install all dependencies (server + client)
npm run setup

# Configure environment variables (see section below)
cp .env.example server/.env

# Start your local Redis server (if installed, e.g., via redis-server)
# (Alternatively, run without Redis URL and the cache-aside layer will bypass automatically)

# Seed sample events (optional)
cd server && node seed.js && cd ..

# Start both server and client concurrently
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run setup` | Install dependencies for both server and client |
| `npm run dev` | Start both server (nodemon) and client (vite) concurrently |
| `npm run dev:server` | Start only the backend |
| `npm run dev:client` | Start only the frontend |
| `npm run build` | Build the client for production |
| `npm run start` | Start both in production mode |

---

## Environment Variables

Create a `server/.env` file based on `.env.example`:

```env
# Server Configuration
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/eventora
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Email (Gmail SMTP)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Razorpay (use test keys for development)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Redis Caching (leave blank to run in non-cached database-only mode)
REDIS_URL=redis://localhost:6379

# CORS Whitelist Origin
CLIENT_URL=http://localhost:5173
```

The client uses `VITE_API_URL` (set in `client/.env` or defaults to `/api` / localhost proxy in development).

---

## Project Structure

```
eventora/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js             # Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   └── Navbar.jsx            # Navigation bar with auth-aware links
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Auth state provider (user, login, logout)
│   │   ├── pages/
│   │   │   ├── Home.jsx              # Event listing with search and category filters
│   │   │   ├── EventDetail.jsx       # Event info + booking/payment flow
│   │   │   ├── MyBookings.jsx        # User's booking history
│   │   │   ├── Login.jsx             # Login form
│   │   │   ├── Register.jsx          # Registration form
│   │   │   ├── VerifyOTP.jsx         # OTP input for account verification
│   │   │   ├── ForgotPassword.jsx    # Email input for password reset
│   │   │   ├── ResetPassword.jsx     # OTP + new password form
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.jsx  # Stats overview (events, bookings, revenue)
│   │   │       ├── AdminEvents.jsx     # CRUD interface for events
│   │   │       └── AdminBookings.jsx   # Booking management table
│   │   ├── App.jsx                   # Router setup with ProtectedRoute/AdminRoute
│   │   ├── main.jsx                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── vercel.json                   # SPA rewrite rules for Vercel
│   └── vite.config.js
│
├── server/                           # Express backend
│   ├── controllers/
│   │   ├── authController.js         # Register, login, OTP, forgot/reset password
│   │   ├── eventController.js        # CRUD operations for events (caching integrated)
│   │   └── bookingController.js      # Registration, payment, cancellation, admin stats
│   ├── models/
│   │   ├── User.js                   # User schema (name, email, password, role, isVerified)
│   │   ├── Event.js                  # Event schema with virtuals, indexes, pre-save hooks
│   │   ├── Booking.js                # Booking schema with payment tracking
│   │   └── OTP.js                    # OTP schema with TTL auto-expiry
│   ├── middleware/
│   │   ├── auth.js                   # JWT verification + admin role check
│   │   ├── validate.js               # express-validator rule sets for all endpoints
│   │   └── rateLimiter.js            # Global, auth, and OTP rate limiters
│   ├── routes/
│   │   ├── auth.js                   # Auth routes with rate limiters + validators
│   │   ├── events.js                 # Event routes with admin protection
│   │   └── bookings.js               # Booking routes with mixed auth levels
│   ├── utils/
│   │   ├── email.js                  # Nodemailer: OTP + booking confirmation emails
│   │   └── redis.js                  # Redis client with graceful failure handling
│   ├── seed.js                       # Database seeder for sample events
│   └── index.js                      # Express app setup, DB/Redis, graceful shutdown
│
├── .dockerignore                     # Docker build exclusions
├── .env.example                      # Environment variable template
├── .gitignore
├── Dockerfile                        # Multi-stage production build config
├── docker-compose.yml                # Express, Redis, and Nginx orchestrator
├── nginx.conf                        # Reverse proxy, static serving, and routing configuration
├── deploy.sh                         # Automation script for SSH-based remote EC2 setup
├── package.json                      # Root-level monorepo scripts (concurrently)
├── Eventora_Postman_Collection.json  # Importable Postman collection for API testing
└── README.md
```

---

## Deployment

### Frontend → Vercel
1. Connect the GitHub repo to [Vercel](https://vercel.com)
2. Set root directory to `client`
3. Framework preset: **Vite**
4. Add environment variable: `VITE_API_URL=https://your-backend-url.onrender.com/api` (or your EC2 public IP/domain)
5. The included `vercel.json` handles SPA routing rewrites

### Backend Option A → Render (Web Service)
1. Create a new **Web Service** on [Render](https://render.com)
2. Set root directory to `server`
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add all environment variables from `.env.example` (Exclude `REDIS_URL` if you want to bypass caching and run database-only)

> **Note:** Render's free tier has a cold start delay of ~30 seconds on the first request after inactivity.

### Backend Option B → AWS EC2 (Multi-Container Docker Production)
For production-grade scalability, the root folder contains a multi-container Docker deployment configuration:
- **Express Backend Container** (running on port 5000)
- **Redis Cache Container** (LRU eviction policy, locked internally)
- **Nginx Reverse Proxy Container** (Serving built static frontend files, proxying `/api/*` to Express, handling gzip, caching assets for 30 days)

To deploy on a standard AWS EC2 Ubuntu instance:
```bash
# Make the deployment automation script executable
chmod +x deploy.sh

# Run the deployment script (it installs Docker/Docker Compose, prompts for env secrets, and starts the container stack)
./deploy.sh
```

---

## Screenshots

### 🏠 Homepage
<img width="1911" height="1032" alt="Homepage - Event listing with category filters and search" src="https://github.com/user-attachments/assets/c1ec4d82-2f60-4c48-a84d-627f7ffd1fcb" />

### 📊 Admin Dashboard
<img width="1457" height="1028" alt="Admin Dashboard - Stats overview with event and booking management" src="https://github.com/user-attachments/assets/f95b3300-052f-4b27-98b5-7251b007ade1" />

### ➕ Create Event
<img width="1919" height="992" alt="Create Event - Admin form for adding new events" src="https://github.com/user-attachments/assets/0293ef0b-67d0-4674-ae04-d12cd8f8924a" />

---

## Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| **Atomic `$inc` for seats** | Using `findOneAndUpdate` with `$gt: 0` guard prevents race conditions and overbooking without needing transactions |
| **Separate register + pay-now flow** | Decouples registration intent from payment — users can register first and pay later, reducing drop-off |
| **Redis Cache-Aside Pattern** | Improves read latency ($<10$ms on hits) for read-heavy operations. Automatically invalidates affected caches on write mutations |
| **SCAN over KEYS in Redis** | Deleting keys matching `events:*` uses cursor-based `SCAN` rather than blocking `KEYS`, preserving single-threaded performance |
| **Graceful Cache Degradation** | If Redis goes offline, the connection wrapper catches the fault and redirects calls directly to MongoDB, maintaining application uptime |
| **Docker Compose + Nginx orchestration** | Packages Node, Redis, and Nginx in a consistent, self-contained network. Nginx offloads static serving and SSL/API proxying from Node |
| **Role hardcoded on registration** | Prevents privilege escalation by ignoring any `role` field sent from the client |
| **OTP over email links** | Simpler to implement, no need for additional URL token management, works well for mobile users |
| **No frontend CSS framework** | Vanilla CSS with custom properties for full control over the design system without bundle overhead |
| **Monorepo with root scripts** | `concurrently` runs both services from a single `npm run dev` command — better DX than separate terminals |
| **express-validator over Joi** | Tighter integration with Express middleware chain, chainable API, built-in sanitization |
| **Postman collection included** | Enables API testing without reading docs — importable JSON file in the repo root |

---

## Future Improvements

- [ ] Seat selection UI (row/seat picker similar to BookMyShow)
- [ ] Event reviews and ratings system
- [ ] Real-time seat updates via WebSockets
- [ ] Refund processing for paid bookings
- [ ] Image upload to cloud storage (currently base64/URL)
- [ ] Pagination UI for event listing (API supports page/limit)
- [ ] Refresh tokens for shorter-lived JWT access tokens
- [ ] Unit and integration test suite

---

## Author

**Sheel Todkar**
Final Year Information Technology Student

- GitHub: [@sheel-todkar](https://github.com/sheel-todkar)

---

## License

This project is open source and available for learning and reference purposes.
