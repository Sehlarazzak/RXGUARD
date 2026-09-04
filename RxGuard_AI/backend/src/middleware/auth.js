const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Verifies the bearer token and loads the caller's identity + role.
// Also accepts ?token= for image requests loaded via <img> tags.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && typeof req.query.token === 'string' && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, approval_status }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// Doctors must be approved by an administrator before they can prescribe.
function requireApprovedDoctor(req, res, next) {
  if (req.user.role !== 'doctor') return next();
  if (req.user.approval_status !== 'approved') {
    return res.status(403).json({ error: 'Your registration is awaiting administrator approval.' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireApprovedDoctor, JWT_SECRET };
