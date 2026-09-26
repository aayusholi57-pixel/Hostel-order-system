# HotelEase — Local Development

This project serves the frontend directly from the Express backend, so normal development does not require Live Server.

## Quick start
```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run seed
npm start
```

Open **http://localhost:8000**.

Health check: **http://localhost:8000/api/health**

Menu API: **http://localhost:8000/api/menu**

## Local demo account
The development seed creates:
- Customer: `customer@hotel.com` / `123456`
- Admin: `admin@hotel.com` / `admin123`

These credentials are development-only and are **not** created when `NODE_ENV=production`.

## Production
Set these environment variables before running the production seed:
```text
NODE_ENV=production
JWT_SECRET=<long-random-secret>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<strong-admin-password>
```

Do not commit production credentials.

## Firebase
Google and Nepal phone OTP require Firebase configuration. See `backend/FIREBASE_SETUP.md`.

## Password reset
Password reset requires:
```text
RESEND_API_KEY=<resend-api-key>
MAIL_FROM=HotelEase <verified-sender@your-domain.com>
APP_URL=https://your-deployed-app.example
```