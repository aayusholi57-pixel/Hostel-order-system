const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let firebaseAuth = null;

function getFirebaseAuth() {
  if (firebaseAuth) return firebaseAuth;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  firebaseAuth = getAuth();
  return firebaseAuth;
}

async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Admin is not configured on the server');
  }
  return auth.verifyIdToken(idToken, true);
}

module.exports = { getFirebaseAuth, verifyFirebaseIdToken };
