let firebaseApp = null;
let auth = null;
let googleProvider = null;
let initialized = false;

async function getApiBase() {
  return window.location.port === '5500' ? 'http://localhost:8000/api' : '/api';
}

async function ensureFirebase() {
  if (initialized && auth && googleProvider) return true;

  const response = await fetch(`${await getApiBase()}/auth/firebase-config`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Google/phone authentication is not configured on the server yet.');
  }

  const firebaseConfig = await response.json();

  const [{ initializeApp }, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
  ]);

  const {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    setPersistence,
    browserLocalPersistence,
    signOut,
  } = authModule;

  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  await setPersistence(auth, browserLocalPersistence);

  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  window.hotelFirebaseModules = {
    getAuth,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut,
  };

  initialized = true;
  return true;
}

export function firebaseReady() {
  return initialized && Boolean(auth);
}

export async function loginWithGoogle() {
  await ensureFirebase();
  return window.hotelFirebaseModules.signInWithPopup(auth, googleProvider);
}

export async function createPhoneVerifier(containerId = 'recaptcha-container') {
  await ensureFirebase();

  if (window.hotelRecaptchaVerifier) {
    try { window.hotelRecaptchaVerifier.clear(); } catch (_) {}
  }

  const verifier = new window.hotelFirebaseModules.RecaptchaVerifier(
    auth,
    containerId,
    { size: 'normal' },
  );

  window.hotelRecaptchaVerifier = verifier;
  return verifier;
}

export async function sendPhoneCode(phoneNumber, verifier) {
  await ensureFirebase();
  return window.hotelFirebaseModules.signInWithPhoneNumber(auth, phoneNumber, verifier);
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
  if (!auth) return;
  await window.hotelFirebaseModules.signOut(auth);
}

export { auth };
