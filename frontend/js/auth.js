// ============================================================
// HotelEase Authentication
// Email/password works WITHOUT Firebase.
// Firebase is loaded only when Google/Phone login is used.
// ============================================================

const API_URL =
    window.location.port === "5500"
        ? "http://localhost:8000/api"
        : "/api";

const pageMode =
    document.body.dataset.authMode || "login";

let phoneConfirmationResult = null;
let phoneVerifier = null;


// ============================================================
// TOAST
// ============================================================

function toast(message, type = "success") {

    if (typeof window.showToast === "function") {
        window.showToast(message, type);
        return;
    }

    alert(message);
}


// ============================================================
// LOAD FIREBASE ONLY WHEN NEEDED
// ============================================================

async function loadFirebaseAuth() {

    try {

        return await import("./firebase-auth.js");

    } catch (error) {

        console.error(
            "Firebase module could not be loaded:",
            error
        );

        throw new Error(
            "Google/Phone authentication is not configured. Email login is still available."
        );
    }
}


// ============================================================
// SAVE USER
// ============================================================

function saveLoginSession(data) {

    localStorage.setItem(
        "hotel_token",
        data.token
    );

    if (
        typeof window.setCurrentUser ===
        "function"
    ) {
        window.setCurrentUser(data.user);
    }

    localStorage.setItem(
        "hotel_current_user",
        JSON.stringify(data.user)
    );
}


// ============================================================
// REDIRECT
// ============================================================

function redirectAfterLogin(user) {

    toast("Login successful");

    setTimeout(() => {

        if (user.role === "admin") {

            window.location.href =
                "admin.html";

        } else {

            window.location.href =
                "index.html";
        }

    }, 500);
}


// ============================================================
// EMAIL LOGIN
// ============================================================

async function loginWithPassword(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const email = String(form.elements.email?.value || '').trim().toLowerCase();
    const password = String(form.elements.password?.value || '');

    if (!email || !password) {
        toast('Please enter your email and password.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Invalid email or password');
        }

        saveLoginSession(data);
        redirectAfterLogin(data.user);
    } catch (error) {
        console.error('EMAIL LOGIN ERROR:', error);
        toast(error.message || 'Unable to login.', 'error');
    }
}


// ============================================================
// EMAIL REGISTER
// ============================================================

async function registerWithPassword(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const submit = document.getElementById('register-submit');

    const name = String(form.elements.name?.value || '').trim().replace(/\s+/g, ' ');
    const phone = String(form.elements.phone?.value || '').trim();
    const gender = String(form.elements.gender?.value || '').trim().toLowerCase();
    const email = String(form.elements.email?.value || '').trim().toLowerCase();
    const password = String(form.elements.password?.value || '');
    const confirmPassword = String(form.elements.confirmPassword?.value || '');

    if (!name || name.length < 2) {
        toast('Please enter your full name.', 'error');
        return;
    }

    if (!/^(?:\+977)?9[678]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) {
        toast('Please enter a valid Nepal mobile number.', 'error');
        return;
    }

    if (!['male', 'female'].includes(gender)) {
        toast('Please select Male or Female.', 'error');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast('Please enter a valid email address.', 'error');
        return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        toast('Password needs 8+ characters, uppercase, lowercase and a number.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        toast('Passwords do not match.', 'error');
        return;
    }

    if (submit) {
        submit.disabled = true;
        submit.textContent = 'Creating account...';
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, gender, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        saveLoginSession(data);
        toast('Account created successfully. You are now logged in.');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('REGISTER ERROR:', error);
        toast(error.message || 'Registration failed.', 'error');
        if (submit) {
            submit.disabled = false;
            submit.textContent = 'Create Account';
        }
    }
}


// ============================================================
// FIREBASE USER → BACKEND
// ============================================================

async function exchangeFirebaseUser(
    user,
    extraName = "",
    extraPhone = "",
    extraGender = ""
) {

    const firebase =
        await loadFirebaseAuth();

    const idToken =
        await firebase.getFirebaseIdToken(
            user
        );

    const response =
        await fetch(
            `${API_URL}/auth/firebase`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    idToken,

                    name:
                        extraName ||
                        user.displayName ||
                        "",
                    phone: extraPhone || user.phoneNumber || '',
                    gender: extraGender || ''
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        const error = new Error(data.message || 'Firebase authentication failed');
        error.code = data.code || '';
        throw error;
    }

    saveLoginSession(data);

    return data.user;
}


// ============================================================
// GOOGLE LOGIN
// ============================================================

async function handleGoogle() {

    try {

        const firebase = await loadFirebaseAuth();
        const result = await firebase.loginWithGoogle();
        const firebaseUser = result.user;

        let phone = '';
        let gender = '';

        try {
            const user = await exchangeFirebaseUser(firebaseUser, firebaseUser.displayName || '', '', '');
            redirectAfterLogin(user);
            return;
        } catch (error) {
            if (error.code !== 'PROFILE_REQUIRED') throw error;
        }

        phone = window.prompt('Complete your registration: Nepal mobile number (98XXXXXXXX):', '') || '';
        gender = (window.prompt('Gender: Male or Female:', '') || '').trim().toLowerCase();

        const user = await exchangeFirebaseUser(
            firebaseUser,
            firebaseUser.displayName || '',
            phone,
            gender
        );

        redirectAfterLogin(user);

    } catch (error) {

        console.error('GOOGLE LOGIN ERROR:', error);
        toast(error.message || 'Google login failed. Check Firebase configuration and authorized domains.', 'error');
    }
}


// ============================================================
// NEPAL PHONE NUMBER
// ============================================================

function normalizeNepalPhone(value) {

    const raw =
        String(value || "")
            .replace(/\D/g, "");

    // 97798XXXXXXXX
    if (
        raw.startsWith("977") &&
        raw.length === 13
    ) {

        return `+${raw}`;
    }

    // 98XXXXXXXX
    if (
        /^9\d{9}$/.test(raw)
    ) {

        return `+977${raw}`;
    }

    throw new Error(
        "Enter a valid Nepal mobile number like 98XXXXXXXX."
    );
}


// ============================================================
// SEND PHONE OTP
// ============================================================

async function handleSendPhoneCode() {

    try {

        const firebase =
            await loadFirebaseAuth();

        const phoneInput =
            document.getElementById(
                "phone-number"
            );

        const phone =
            normalizeNepalPhone(
                phoneInput?.value
            );

        if (!phoneVerifier) {

            phoneVerifier =
                await firebase.createPhoneVerifier(
                    "recaptcha-container"
                );
        }

        phoneConfirmationResult =
            await firebase.sendPhoneCode(
                phone,
                phoneVerifier
            );

        document
            .getElementById(
                "phone-code-wrap"
            )
            ?.classList.remove(
                "hidden"
            );

        document
            .getElementById(
                "verify-phone-btn"
            )
            ?.classList.remove(
                "hidden"
            );

        document
            .getElementById(
                "send-phone-btn"
            )
            .textContent =
            "Code Sent";

        toast(
            "OTP sent to your phone."
        );

    } catch (error) {

        console.error(
            "PHONE OTP ERROR:",
            error
        );

        toast(
            error.message ||
            "Could not send OTP.",
            "error"
        );

        try {

            phoneVerifier?.clear();

        } catch (_) {}

        phoneVerifier = null;
    }
}


// ============================================================
// VERIFY PHONE OTP
// ============================================================

async function handleVerifyPhoneCode() {

    try {

        const code =
            String(
                document.getElementById(
                    "phone-code"
                )?.value || ""
            ).trim();

        if (!/^\d{6}$/.test(code)) {

            throw new Error(
                "Enter the 6-digit OTP."
            );
        }

        if (!phoneConfirmationResult) {

            throw new Error(
                "Request an OTP first."
            );
        }

        const firebase =
            await loadFirebaseAuth();

        const result =
            await firebase.confirmPhoneCode(
                phoneConfirmationResult,
                code
            );

        const name =
            String(
                document.getElementById(
                    "phone-name"
                )?.value || ""
            ).trim();

        const user =
            await exchangeFirebaseUser(
                result.user,
                name
            );

        redirectAfterLogin(user);

    } catch (error) {

        console.error(
            "PHONE VERIFY ERROR:",
            error
        );

        toast(
            error.message ||
            "Phone verification failed.",
            "error"
        );
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutOnAuthPage() {

    localStorage.removeItem(
        "hotel_token"
    );

    localStorage.removeItem(
        "hotel_current_user"
    );

    if (
        typeof window.setCurrentUser ===
        "function"
    ) {
        window.setCurrentUser(null);
    }

    try {

        const firebase =
            await loadFirebaseAuth();

        await firebase.logoutFirebase();

    } catch (_) {}

    window.location.href =
        "index.html";
}


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "HotelEase auth.js loaded."
        );

        console.log(
            "API:",
            API_URL
        );


        // EMAIL LOGIN
        const loginForm =
            document.getElementById(
                "login-form"
            );

        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                loginWithPassword
            );
        }


        // EMAIL REGISTER
        const registerForm =
            document.getElementById(
                "register-form"
            );

        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                registerWithPassword
            );
        }


        // GOOGLE
        document
            .getElementById(
                "google-login"
            )
            ?.addEventListener(
                "click",
                handleGoogle
            );

        document
            .getElementById(
                "google-register"
            )
            ?.addEventListener(
                "click",
                handleGoogle
            );


        // PHONE
        document
            .getElementById(
                "send-phone-btn"
            )
            ?.addEventListener(
                "click",
                handleSendPhoneCode
            );

        document
            .getElementById(
                "verify-phone-btn"
            )
            ?.addEventListener(
                "click",
                handleVerifyPhoneCode
            );


        // LOGOUT
        document
            .getElementById(
                "auth-logout"
            )
            ?.addEventListener(
                "click",
                logoutOnAuthPage
            );


        // REGISTER PAGE
        if (
            pageMode ===
            "register"
        ) {

            document
                .getElementById(
                    "phone-name-wrap"
                )
                ?.classList.remove(
                    "hidden"
                );
        }
    }
);