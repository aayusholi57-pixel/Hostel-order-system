# Firebase setup for Google + Nepal phone authentication

## 1. Create a Firebase project

Open the Firebase Console and create/select your project. Add a **Web App** and copy its web configuration into:

`hotel-order-frontend/js/firebase-config.js`

The browser config is safe to include in frontend code. Do **not** put a Firebase service-account private key in the frontend.

## 2. Enable Authentication providers

Firebase Console → Authentication → Sign-in method:

- Enable **Google**.
- Enable **Phone**.

For Phone sign-in, also configure the SMS region policy to allow **Nepal (NP)**.

## 3. Authorized domains

Add the domain where the frontend is actually hosted under Authentication settings.

For production phone SMS, use a real hosted domain (for example Firebase Hosting, Netlify, Vercel, or your own domain). Firebase's web phone-auth documentation notes that `localhost` is not allowed as a hosted domain for phone authentication.

## 4. Backend service account

Firebase Console → Project settings → Service accounts → Generate a new private key.

Store the values in the backend `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Never commit the service-account JSON or private key to GitHub.

## 5. Install backend dependencies

```powershell
cd E:\Hotel-Order-System\hotel-order-backend
npm install
npm start
```

## 6. Frontend

Run the frontend with Live Server for ordinary web development. Google sign-in can be tested after the Firebase web config and Google provider are configured.

For real SMS phone sign-in, deploy the frontend to a non-local authorized domain.

## 7. Phone number format

The UI accepts a normal Nepal mobile number such as:

`98XXXXXXXX`

and sends it to Firebase in E.164 format:

`+97798XXXXXXXX`

## 8. Delivered message and reviews

When an admin changes an order from any state to `Completed`, the backend creates an in-app notification with a delivered message. The customer sees it on **My Orders**.

A customer can submit or edit a review only when the order status is `Completed`.
