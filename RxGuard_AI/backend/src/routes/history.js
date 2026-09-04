// Dashboard statistics and search history endpoints.
const express = require('express');
const { q, one } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/history/search - log a search event (suggestion clicks, admin
// centralized searches) so every executed search shows up in history
router.post('/search', requireAuth, async (req, res) => {
  try {
    const query = String((req.body || {}).query || '').trim();
    if (!query) return res.status(400).json({ error: 'Query is required.' });
    await q('INSERT INTO rxguard.search_history (user_id, query) VALUES ($1, $2)', [
      req.user.id,
      query.slice(0, 500),
    ]);
    res.status(201).json({ message: 'Search logged.' });
  } catch (err) {
    console.error('history log error', err);
    res.status(500).json({ error: 'Could not log the search.' });
  }
});

// GET /api/history/search - the caller's search history (any role)
router.get('/search', requireAuth, async (req, res) => {
  try {
    const rows = await q(
      'SELECT search_id, query, created_at FROM rxguard.search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('history error', err);
    res.status(500).json({ error: 'Could not load your search history.' });
  }
});

// DELETE /api/history/search - clear the caller's search history
router.delete('/search', requireAuth, async (req, res) => {
  try {
    await q('DELETE FROM rxguard.search_history WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Search history cleared.' });
  } catch (err) {
    console.error('history clear error', err);
    res.status(500).json({ error: 'Could not clear your search history.' });
  }
});

// GET /api/history/dashboard - role-aware dashboard stats from the database
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'patient' || role === 'admin') {
      // Patients: prescription records. Admins: their own searches.
      if (role === 'patient') {
        const stats = await one(
          "SELECT COUNT(*) AS total_prescriptions, " +
          "COUNT(*) FILTER (WHERE status = 'success') AS successful, " +
          "COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())) AS this_week " +
          "FROM rxguard.prescriptions WHERE user_id = $1",
          [userId]
        );
        const recent = await q(
          "SELECT prescription_id, title, file_name, mime_type, status, created_at FROM rxguard.prescriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
          [userId]
        );
        return res.json({ role, stats, recent });
      }
      const stats = await one(
        'SELECT COUNT(*) AS total_searches, COUNT(*) FILTER (WHERE created_at >= date_trunc(\'week\', now())) AS this_week FROM rxguard.search_history WHERE user_id = $1',
        [userId]
      );
      const recent = await q(
        'SELECT search_id, query, created_at FROM rxguard.search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [userId]
      );
      return res.json({ role, stats, recent });
    }

    // Doctor: patient files and prescriptions
    const stats = await one(
      "SELECT (SELECT COUNT(*) FROM rxguard.patient_files WHERE doctor_id = $1) AS patient_files, " +
      "(SELECT COUNT(*) FROM rxguard.doctor_prescriptions WHERE doctor_id = $1) AS total_prescriptions, " +
      "(SELECT COUNT(*) FROM rxguard.doctor_prescriptions WHERE doctor_id = $1 AND status = 'printed') AS printed, " +
      "(SELECT COUNT(*) FROM rxguard.doctor_prescriptions WHERE doctor_id = $1 AND updated_at >= date_trunc('week', now())) AS this_week",
      [userId]
    );
    const recent = await q(
      "SELECT f.file_id, f.patient_name, MAX(d.updated_at) AS last_updated, COUNT(d.dp_id) AS prescription_count " +
      "FROM rxguard.patient_files f " +
      "LEFT JOIN rxguard.doctor_prescriptions d ON d.file_id = f.file_id " +
      "WHERE f.doctor_id = $1 GROUP BY f.file_id, f.patient_name " +
      "ORDER BY last_updated DESC NULLS LAST LIMIT 5",
      [userId]
    );
    res.json({ role, stats, recent });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ error: 'Could not load dashboard statistics.' });
  }
});

module.exports = router;
