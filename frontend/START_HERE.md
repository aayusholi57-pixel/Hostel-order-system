# HotelEase — Complete Frontend Replacement

This frontend is connected to the Node/Express backend at:

`http://localhost:8000/api`

The Live Server frontend runs at:

`http://localhost:5500`

## Run

1. Keep the backend running with `npm start`.
2. Open this folder in VS Code.
3. Open `index.html` with Live Server.
4. Test `menu.html`.
5. The menu is loaded from the backend database; `data.js` is no longer the source of truth.

## Demo accounts

Customer:
- customer@hotel.com
- 123456

Admin:
- admin@hotel.com
- admin123

## Important

The Google/phone authentication files are included, but Firebase browser credentials still need to be placed into `js/firebase-config.js`, and Firebase Admin environment variables must be placed into the backend `.env` before Google/phone login can work.
