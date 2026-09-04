// Authentication endpoints: register (patient/doctor/admin) and login.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { q, one } = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNIC_RE = /^\d{5}-\d{7}-\d$/;

function passwordProblems(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must include at least one lowercase letter.';
  if (!/\d/.test(pw)) return 'Password must include at least one number.';
  return null;
}

function makeToken(user) {
  return jwt.sign(
    { id: user.user_id, email: user.email, role: user.role, approval_status: user.approval_status },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

async function publicUser(userId) {
  return one(
    `SELECT u.user_id, u.email, u.display_name, u.full_name, u.cnic, u.phone,
            u.license_number, u.clinic_name, u.approval_status, u.created_at,
            (SELECT r.role_name FROM mediverify.user_roles ur
              JOIN mediverify.roles r ON r.role_id = ur.role_id
              WHERE ur.user_id = u.user_id LIMIT 1) AS role
     FROM mediverify.users u WHERE u.user_id = $1`,
    [userId]
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { role, fullName, cnic, email, password, confirmPassword, phone, licenseNumber, clinicName } = req.body || {};

    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Please choose a valid account type.' });
    }
    if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!cnic || !CNIC_RE.test(cnic.trim())) {
      return res.status(400).json({ error: 'CNIC must follow the format XXXXX-XXXXXXX-X (13 digits).' });
    }
    if (!email || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const pwProblem = passwordProblems(password);
    if (pwProblem) return res.status(400).json({ error: pwProblem });
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    }
    if (role === 'doctor') {
      if (!licenseNumber || !licenseNumber.trim()) {
        return res.status(400).json({ error: 'Medical License Number is required.' });
      }
      if (!clinicName || !clinicName.trim()) {
        return res.status(400).json({ error: 'Clinic/Hospital Name is required.' });
      }
    }

    const emailNorm = email.trim().toLowerCase();
    const existing = await one('SELECT user_id FROM mediverify.users WHERE lower(email) = $1', [emailNorm]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Please use another email.' });

    const cnicNorm = cnic.trim();
    const existingCnic = await one('SELECT user_id FROM mediverify.users WHERE cnic = $1', [cnicNorm]);
    if (existingCnic) return res.status(409).json({ error: 'An account with this CNIC already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const roleId = role === 'patient' ? 1 : role === 'doctor' ? 2 : 4;

    const user = await one(
      `INSERT INTO mediverify.users (email, password_hash, display_name, full_name, cnic, phone, license_number, clinic_name, is_active, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
       RETURNING user_id`,
      [
        emailNorm,
        hash,
        fullName.trim(),
        fullName.trim(),
        cnicNorm,
        phone ? phone.trim() : null,
        role === 'doctor' ? licenseNumber.trim() : null,
        role === 'doctor' ? clinicName.trim() : null,
        role === 'doctor' ? 'pending' : 'approved',
      ]
    );

    await q('INSERT INTO mediverify.user_roles (user_id, role_id) VALUES ($1, $2)', [user.user_id, roleId]);

    const created = await publicUser(user.user_id);
    res.status(201).json({
      message:
        role === 'doctor'
          ? 'Registration successful! Your account is pending administrator approval.'
          : 'Registration successful! You can now sign in.',
      user: created,
    });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Something went wrong while creating your account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Please enter your email and password.' });

    const user = await one(
      `SELECT u.*, (SELECT r.role_name FROM mediverify.user_roles ur
        JOIN mediverify.roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = u.user_id LIMIT 1) AS role
       FROM mediverify.users u WHERE lower(u.email) = $1`,
      [email.trim().toLowerCase()]
    );

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated.' });

    const profile = await publicUser(user.user_id);
    res.json({
      message: 'Signed in successfully.',
      token: makeToken(user),
      user: profile,
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Something went wrong while signing you in. Please try again.' });
  }
});

// GET /api/auth/me - restore session on refresh
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await publicUser(req.user.id);
    if (!profile) return res.status(401).json({ error: 'Account no longer exists. Please sign in again.' });
    res.json({ user: profile });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({ error: 'Could not load your account.' });
  }
});

// POST /api/auth/logout (client drops the token; recorded for API completeness)
router.post('/logout', requireAuth, (req, res) => {
  res.json({ message: 'Signed out successfully.' });
});

module.exports = router;
