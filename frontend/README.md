# HotelEase Frontend

Static HTML/CSS/JavaScript frontend for the Hotel Order Web Application.

## Run

Use VS Code Live Server, for example:

`http://localhost:5500`

## Firebase setup

1. Create a Firebase project.
2. Add a Web App.
3. Copy the web config into `js/firebase-config.js`.
4. In Firebase Authentication, enable Google and Phone providers.
5. For phone auth, allow the Nepal (`NP`) SMS region and configure authorized domains.
6. Phone authentication needs a real hosted domain for production; do not rely on `localhost` for SMS sign-in.

The Google and phone buttons use the Firebase Web SDK through the official CDN.

The backend must also be configured with Firebase Admin credentials in `.env`.
