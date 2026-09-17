# Hotel Order Backend

Express + SQLite backend for the Hotel Order Web Application.

## Run

```powershell
npm install
npm run seed
npm start
```

API: `http://localhost:8000`

Health: `http://localhost:8000/api/health`

## Firebase Google + Nepal phone login

The backend supports Firebase Authentication by exchanging a Firebase ID token for the app's normal JWT.

Add these values to `.env`:

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

Create these values from the Firebase Admin service account. Never commit the service-account JSON or private key.

Then:

```powershell
npm install
npm start
```

## New API features

- `POST /api/auth/firebase`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `GET /api/orders/:id/review`
- `POST /api/orders/:id/review`
- `GET /api/reviews/summary`
- `GET /api/admin/reviews`

Reviews are accepted only for orders whose status is `Completed` (shown to customers as `Delivered`).

When an admin changes an order to `Completed`, the backend creates an in-app delivered notification for that customer.
