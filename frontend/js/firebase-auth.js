import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

if (!isFirebaseConfigured()) {
  console.warn('Firebase is not configured. Add your web app config to js/firebase-config.js.');
}

let firebaseApp = null;
let auth = null;
const googleProvider = new GoogleAuthProvider();

if (isFirebaseConfigured()) {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  await setPersistence(auth, browserLocalPersistence);
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export function firebaseReady() {
  return isFirebaseConfigured();
}

export async function loginWithGoogle() {
  if (!firebaseReady() || !auth) throw new Error('Firebase web config is not configured yet.');
  return signInWithPopup(auth, googleProvider);
}

export function createPhoneVerifier(containerId = 'recaptcha-container') {
  if (!firebaseReady() || !auth) throw new Error('Firebase web config is not configured yet.');

  if (window.hotelRecaptchaVerifier) {
    try {
      window.hotelRecaptchaVerifier.clear();
    } catch (_) {}
  }

  window.hotelRecaptchaVerifier = new RecaptchaVerifier(
    auth,
    containerId,
    { size: 'normal' },
  );

  return window.hotelRecaptchaVerifier;
}

export async function sendPhoneCode(phoneNumber, verifier) {
  if (!firebaseReady() || !auth) throw new Error('Firebase web config is not configured yet.');
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function confirmPhoneCode(confirmationResult, code) {
  if (!confirmationResult) throw new Error('Request a verification code first.');
  return confirmationResult.confirm(code);
}

export async function getFirebaseIdToken(user) {
  if (!user) throw new Error('No Firebase user is signed in.');
  return user.getIdToken(true);
}

export async function logoutFirebase() {
  await signOut(auth);
}

export { auth };
