require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const originalExpress = express;
let capturedApp = null;

const expressProxy = new Proxy(originalExpress, {
  apply(target, thisArg, args) {
    capturedApp = Reflect.apply(target, thisArg, args);
    return capturedApp;
  },
});

require.cache[require.resolve('express')].exports = expressProxy;

require('./server');

const { db } = require('./db');
const { hashPassword } = require('./auth');

db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
    ON password_reset_tokens(expires_at);
`);

if (!capturedApp) {
  throw new Error('Could not capture Express application');
}

const RESET_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetUrl(token) {
  const base = String(
    process.env.APP_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '');

  return `${base}/reset-password.html?token=${encodeURIComponent(token)}`;
}

async function sendResetEmail({ to, name, url }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your HotelEase password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#222">
          <h2 style="margin-bottom:8px">Reset your HotelEase password</h2>
          <p>Hello ${String(name || 'there').replace(/[&<>'"]/g, '')},</p>
          <p>We received a request to reset your HotelEase account password.</p>
          <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Reset Password</a></p>
          <p>This link expires in 30 minutes and can only be used once.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Hello ${name || 'there'}, reset your HotelEase password here: ${url}. This link expires in 30 minutes.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider rejected the message: ${response.status} ${body}`);
  }
}

capturedApp.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = db.prepare(
      "SELECT id, name, email, auth_provider FROM users WHERE email = ? AND role = 'customer'"
    ).get(email);

    // Always use the same success response for unknown emails.
    if (!user) {
      return res.json({
        message: 'If an account exists for that email, a password reset link has been sent.',
      });
    }

    // Google/phone accounts do not have a local password to reset.
    if (user.auth_provider && user.auth_provider !== 'password') {
      return res.json({
        message: 'This account uses social/phone sign-in. Please use that sign-in method instead.',
      });
    }

    db.prepare(
      "DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= datetime('now')"
    ).run(user.id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, tokenHash, expiresAt);

    try {
      await sendResetEmail({
        to: user.email,
        name: user.name,
        url: resetUrl(rawToken),
      });
    } catch (mailError) {
      db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash);
      console.error('Password reset email failed:', mailError);
      return res.status(503).json({
        message: 'Password reset email is temporarily unavailable. Please try again later.',
      });
    }

    return res.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Unable to start password reset.' });
  }
});

capturedApp.post('/api/auth/reset-password', (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token || token.length < 32) {
      return res.status(400).json({ message: 'Invalid or missing reset token.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
    }

    const tokenHash = hashToken(token);
    const row = db.prepare(`
      SELECT *
      FROM password_reset_tokens
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > ?
      LIMIT 1
    `).get(tokenHash, new Date().toISOString());

    if (!row) {
      return res.status(400).json({
        message: 'This reset link is invalid or expired. Please request a new one.',
      });
    }

    const result = db.prepare(
      'UPDATE users SET password_hash = ?, auth_provider = \'password\' WHERE id = ?'
    ).run(hashPassword(password), row.user_id);

    if (!result.changes) {
      return res.status(400).json({ message: 'Account could not be updated.' });
    }

    db.prepare(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(row.id);

    db.prepare(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND id != ?'
    ).run(row.user_id, row.id);

    return res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Unable to reset password.' });
  }
});

console.log('Password reset routes enabled');
