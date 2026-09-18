const RESET_API = window.API_URL || '/api';

function resetMessage(id, text, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.toggle('error', type === 'error');
}

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('forgot-password-form');

  forgotForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(new FormData(forgotForm).get('email') || '').trim().toLowerCase();
    const button = forgotForm.querySelector('button[type="submit"]');

    if (!email) return;

    button.disabled = true;
    button.textContent = 'Sending...';

    try {
      const response = await fetch(`${RESET_API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to send reset link');
      resetMessage('forgot-message', data.message);
      forgotForm.reset();
    } catch (error) {
      resetMessage('forgot-message', error.message || 'Unable to send reset link', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send Reset Link';
    }
  });

  const resetForm = document.getElementById('reset-password-form');

  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const token = new URLSearchParams(window.location.search).get('token') || '';
    const form = new FormData(resetForm);
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const button = resetForm.querySelector('button[type="submit"]');

    if (!token) {
      resetMessage('reset-message', 'This reset link is missing its token. Please request a new link.', 'error');
      return;
    }

    if (password.length < 8) {
      resetMessage('reset-message', 'Password must contain at least 8 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      resetMessage('reset-message', 'Passwords do not match.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Updating...';

    try {
      const response = await fetch(`${RESET_API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to reset password');

      resetMessage('reset-message', 'Password updated successfully. Redirecting to login...');
      resetForm.reset();
      setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    } catch (error) {
      resetMessage('reset-message', error.message || 'Unable to reset password', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Update Password';
    }
  });
});
