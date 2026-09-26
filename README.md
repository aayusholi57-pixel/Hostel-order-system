# HotelEase — Hostel Food Ordering Platform

A full-stack food-ordering application for a hostel/hotel environment. It combines a responsive frontend, Express REST API, SQLite persistence, password/JWT authentication, Firebase Google/phone authentication, order management, notifications, reviews, password reset, and Render deployment configuration.

## What this demonstrates
- Frontend: HTML, CSS, vanilla JavaScript, responsive UI
- Backend: Node.js + Express REST API
- Database: SQLite via better-sqlite3 with foreign keys, indexes, and transactions
- Authentication: bcrypt password hashing, JWT sessions, Firebase Admin token verification
- Product flow: menu → cart → checkout → order tracking → notification → review
- Admin flow: menu management, order status management, statistics, customer reviews
- Account recovery: expiring, single-use password-reset tokens with Resend email delivery
- Engineering: environment configuration, security headers, auth rate limiting, CI validation, Render Blueprint

## Architecture
```text
Browser
  │
  ├── Static HTML/CSS/JS
  │
  ▼
Express application
  ├── Authentication + authorization
  ├── Menu API
  ├── Order API
  ├── Notifications
  ├── Reviews
  ├── Password reset
  └── Admin API
       │
       ▼
   SQLite database
```

The Express server also serves the frontend, so normal local development does not require a separate Live Server process.

## Run locally
```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run seed
npm start
```

Open **http://localhost:8000**.

Health check: **http://localhost:8000/api/health**

Public menu API: **http://localhost:8000/api/menu**

## Configuration
For local development, `.env` can contain the values from `backend/.env.example`.

Firebase and password-reset email are optional for the core email/password flow. Configure them when those features are needed.

### Production admin bootstrap
Production seeding does **not** create public demo credentials. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the deployment environment before running the production seed.

Never commit real credentials.

## Main API surface
| Area | Examples |
|---|---|
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login` |
| Firebase | `POST /api/auth/firebase` |
| Menu | `GET /api/menu` |
| Orders | `POST /api/orders`, `GET /api/orders/my` |
| Notifications | `GET /api/notifications` |
| Reviews | `POST /api/orders/:id/review` |
| Password reset | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Admin | `/api/admin/*` |

## Project structure
```text
Hostel-order-system/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── auth.js
│   │   ├── firebase.js
│   │   ├── seed.js
│   │   └── utils.js
│   ├── .env.example
│   ├── FIREBASE_SETUP.md
│   └── package.json
├── frontend/
│   ├── *.html
│   ├── css/
│   └── js/
├── .github/workflows/ci.yml
├── render.yaml
└── README.md
```

## Quality checks
GitHub Actions validates the backend on every push to `main` and pull request:
```powershell
cd backend
npm ci
npm test
npm run seed
```

`npm test` performs syntax validation across the backend source files.

## Deployment
The repository includes `render.yaml` for Render deployment.

Required production configuration includes:
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- Firebase server credentials when Firebase login is enabled
- Resend credentials when password-reset email is enabled

### Persistence note
The application currently uses SQLite. SQLite data is local to the service filesystem, so a production deployment that needs durable data across instance replacement or redeployment should use persistent storage or migrate the database layer to a managed database such as PostgreSQL.

This limitation is intentionally documented rather than presenting the current SQLite setup as a distributed production datastore.

## Security
- Secrets are supplied through environment variables
- Passwords are hashed with bcrypt
- JWT authentication protects private routes
- Admin routes require an authenticated admin role
- Firebase ID tokens are verified server-side
- Authentication endpoints have rate limiting
- Security response headers are enabled
- Password-reset tokens are hashed, expire after 30 minutes, and are single-use
- SQLite foreign-key enforcement is enabled
- `.env` and database files are ignored by Git

See `SECURITY.md` for responsible vulnerability reporting.

## Internship portfolio value
This project demonstrates practical software-engineering skills beyond a simple CRUD demo: authentication, authorization, API design, database modeling, transactions, third-party authentication, email integration, frontend/backend integration, deployment configuration, testing, and security-conscious configuration.

### Reviewer path
1. `backend/src/server.js` — API and business logic
2. `backend/src/db.js` — schema and database design
3. `backend/src/auth.js` — authentication and authorization
4. `frontend/js/auth.js` — client authentication flow
5. `.github/workflows/ci.yml` — automated validation
6. `render.yaml` — deployment configuration

## License
No license has been selected for this repository yet. Add an explicit license before distributing or reusing the code outside your own portfolio.