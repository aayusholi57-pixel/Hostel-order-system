# HotelEase — Fixed Local Setup

This version avoids the localhost:5500 CORS problem by serving the frontend directly from the Express backend.

## 1. Project structure

E:\hotelorder-system\
  backend\
  frontend\

## 2. Backend

Open PowerShell in `backend`:

```powershell
npm install
mkdir data -ErrorAction SilentlyContinue
npm run seed
npm start
```

## 3. Open the app

Use:

http://localhost:8000

Do **not** use Live Server for this version unless you specifically want port 5500.

## 4. API checks

http://localhost:8000/api/health
http://localhost:8000/api/menu

## Demo accounts

Customer: customer@hotel.com / 123456
Admin: admin@hotel.com / admin123

## Firebase

Google and Nepal phone OTP still require Firebase configuration. See `backend/FIREBASE_SETUP.md`.
