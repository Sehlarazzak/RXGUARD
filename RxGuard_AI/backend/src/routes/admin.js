// Admin endpoints: centralized search, relationship map data, filtering,
// record editing with audit trail, doctor approvals, users, manufacturers,
// sources, backups and admin events.
const express = require('express');
const { q, one, pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loadProducts, findAlternatives, invalidateCache } = require('../utils/analysis');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

async function logEvent(userId, action, entityName, entityId, details) {
  await q(
    'INSERT INTO mediverify.admin_events (user_id, action, entity_name, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
    [userId, action, entityName, entityId || null, details ? JSON.stringify(details) : null]
  );
}

// ---------------------------------------------------------------------------
// GET /api/admin/medicines - multi-criteria filterable medicine list
// ---------------------------------------------------------------------------
router.get('/medicines', async (req, res) => {
  try {
    const { search, status, form, manufacturer, source, from, to, sort, dir, limit, offset } = req.query;

    const where = [];
    const params = [];
    const add = (clause, value) => {
      params.push(value);
      where.push(clause.replace('$?', `$${params.length}`));
    };

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      params.push(term);
      const i = params.length;
      where.push(
        `(p.brand_name ILIKE $${i} OR p.normalized_name ILIKE $${i} OR p.registration_number ILIKE $${i} OR ` +
        `m.legal_name ILIKE $${i} OR EXISTS (SELECT 1 FROM mediverify.product_ingredients pi ` +
        `JOIN mediverify.ingredients ing ON ing.ingredient_id = pi.ingredient_id WHERE pi.product_id = p.product_id AND ing.name ILIKE $${i}) OR ` +
        `EXISTS (SELECT 1 FROM mediverify.product_identifiers pid WHERE pid.product_id = p.product_id AND pid.identifier_value ILIKE $${i}) OR ` +
        `EXISTS (SELECT 1 FROM mediverify.safety_notices sn JOIN mediverify.notice_products np ON np.notice_id = sn.notice_id ` +
        `WHERE np.product_id = p.product_id AND sn.notice_identifier ILIKE $${i}))`
      );
    }
    if (status) add('p.safety_status::text = $?', String(status));
    if (form) add('p.dosage_form = $?', String(form));
    if (manufacturer) add('m.manufacturer_id::text = $?', String(manufacturer));
    if (source) add('p.source_category = $?', String(source));
    if (from) add('p.registration_date >= $?', String(from));
    if (to) add('p.registration_date <= $?', String(to));

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sortCol = {
      name: 'p.brand_name',
      status: 'p.safety_status::text',
      form: 'p.dosage_form',
      manufacturer: 'm.legal_name',
      date: 'p.registration_date',
      created: 'p.registration_date',
    }[sort] || 'p.brand_name';
    const sortDir = String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const lim = Math.min(parseInt(limit || '50', 10) || 50, 200);
    const off = Math.max(parseInt(offset || '0', 10) || 0, 0);

    const rows = await q(
      `SELECT p.product_id, p.brand_name, p.dosage_form, p.registration_number, p.registration_date,
              p.safety_status::text AS safety_status, p.source_category, p.source_text,
              m.manufacturer_id, m.legal_name AS manufacturer_name,
              (SELECT count(*) FROM mediverify.product_ingredients pi WHERE pi.product_id = p.product_id) AS ingredient_count,
              (SELECT count(*) FROM mediverify.recall_batches rb WHERE rb.product_id = p.product_id) AS batch_count,
              (SELECT count(*) FROM mediverify.notice_products np WHERE np.product_id = p.product_id) AS notice_count
       FROM mediverify.products p
       LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id
       ${whereSql}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT ${lim} OFFSET ${off}`,
      params
    );

    const total = await one(`SELECT count(*) AS n FROM mediverify.products p LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id ${whereSql}`, params);

    // Completeness: highlight missing fields per requirements
    const enriched = rows.map((r) => {
      const missing = [];
      if (!r.brand_name) missing.push('name');
      if (r.ingredient_count === 0) missing.push('ingredients');
      if (!r.dosage_form) missing.push('dosage_form');
      if (!r.manufacturer_name) missing.push('manufacturer');
      if (!r.registration_number) missing.push('registration_number');
      if (r.notice_count === 0 && !r.source_text) missing.push('source_document');
      if (!r.safety_status) missing.push('safety_status');
      if (r.batch_count === 0) missing.push('batch_data');
      return { ...r, completeness: { missing, complete: missing.length === 0, score: Math.round(((8 - missing.length) / 8) * 100) } };
    });

    res.json({ medicines: enriched, total: total.n, limit: lim, offset: off });
  } catch (err) {
    console.error('admin medicines error', err);
    res.status(500).json({ error: 'Could not load medicines.' });
  }
});

// GET /api/admin/medicines/filters - filter option values
router.get('/medicines/filters', async (req, res) => {
  try {
    const [statuses, forms, manufacturers, sources] = await Promise.all([
      q('SELECT DISTINCT safety_status::text AS v FROM mediverify.products ORDER BY 1'),
      q('SELECT DISTINCT dosage_form AS v FROM mediverify.products WHERE dosage_form IS NOT NULL ORDER BY 1'),
      q('SELECT manufacturer_id AS id, legal_name AS v FROM mediverify.manufacturers ORDER BY 2'),
      q('SELECT DISTINCT source_category AS v FROM mediverify.products ORDER BY 1'),
    ]);
    res.json({
      statuses: statuses.map((s) => s.v),
      forms: forms.map((s) => s.v),
      manufacturers: manufacturers,
      sources: sources.map((s) => s.v),
    });
  } catch (err) {
    console.error('filters error', err);
    res.status(500).json({ error: 'Could not load filter options.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/medicines/:id - full record + relationship map + timeline
// ---------------------------------------------------------------------------
router.get('/medicines/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const product = await one(
      `SELECT p.*, m.legal_name AS manufacturer_name, m.country AS manufacturer_country, m.address AS manufacturer_address,
              m.manufacturer_id, h.legal_name AS holder_name, h.holder_id
       FROM mediverify.products p
       LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id
       LEFT JOIN mediverify.market_authorization_holders h ON h.holder_id = p.holder_id
       WHERE p.product_id = $1`,
      [id]
    );
    if (!product) return res.status(404).json({ error: 'Medicine not found.' });

    const [ingredients, batches, notices, sources, history, identifiers, events] = await Promise.all([
      q(`SELECT i.ingredient_id, i.name, pi.strength_value, pi.strength_unit, pi.composition_text
         FROM mediverify.product_ingredients pi JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id
         WHERE pi.product_id = $1 ORDER BY i.name`, [id]),
      q(`SELECT b.* FROM mediverify.recall_batches b WHERE b.product_id = $1 ORDER BY b.batch_number`, [id]),
      q(`SELECT n.notice_id, n.notice_identifier, n.title, n.notice_type, n.severity, n.action_date,
                n.problem_statement, n.risk_statement, n.action_initiated, np.disposition,
                sd.title AS document_title, sd.canonical_url, sd.publication_date, s.source_name
         FROM mediverify.notice_products np JOIN mediverify.safety_notices n ON n.notice_id = np.notice_id
         LEFT JOIN mediverify.source_documents sd ON sd.document_id = n.source_document_id
         LEFT JOIN mediverify.sources s ON s.source_id = sd.source_id
         WHERE np.product_id = $1 ORDER BY n.action_date DESC NULLS LAST`, [id]),
      q(`SELECT sd.document_id, sd.title, sd.canonical_url, sd.document_url, sd.publication_date, ps.source_role, s.source_name, s.source_type
         FROM mediverify.product_sources ps
         JOIN mediverify.source_documents sd ON sd.document_id = ps.source_document_id
         JOIN mediverify.sources s ON s.source_id = sd.source_id
         WHERE ps.product_id = $1`, [id]),
      q(`SELECT h.old_status::text AS old_status, h.new_status::text AS new_status, h.reason, h.effective_date, h.created_at
         FROM mediverify.product_status_history h WHERE h.product_id = $1 ORDER BY h.created_at DESC`, [id]),
      q(`SELECT identifier_type, identifier_value FROM mediverify.product_identifiers WHERE product_id = $1`, [id]),
      q(`SELECT a.action, a.entity_name, a.details, a.created_at, u.display_name AS actor
         FROM mediverify.admin_events a LEFT JOIN mediverify.users u ON u.user_id = a.user_id
         WHERE a.entity_id = $1 OR (a.details ->> 'brand_name') = $2
         ORDER BY a.created_at DESC LIMIT 50`, [id, product.brand_name]),
    ]);

    // AI-powered safe alternatives
    const products = await loadProducts();
    const cached = products.find((p) => p.product_id === id);
    const altResult = cached ? await findAlternatives(cached) : { alternatives: [], ai_powered: false, ai_reason: null, no_alternative: true };

    // Timeline: merged chronological regulatory events
    const timeline = [];
    if (product.registration_date) timeline.push({ date: product.registration_date, type: 'registration', label: `Registered with DRAP (${product.registration_number || 'no number'})` });
    for (const s of sources) {
      if (s.publication_date) timeline.push({ date: s.publication_date, type: 'source', label: `Source document: ${s.title || s.source_name}` });
    }
    for (const n of notices) {
      if (n.action_date) timeline.push({ date: n.action_date, type: 'recall', label: `DRAP ${n.notice_type} ${n.notice_identifier}: ${n.title}` });
    }
    for (const b of batches) {
      if (b.manufacturing_date) timeline.push({ date: b.manufacturing_date, type: 'batch', label: `Batch ${b.batch_number} manufactured` });
    }
    for (const h of history) {
      timeline.push({ date: h.effective_date || h.created_at, type: 'status', label: `Status ${h.old_status || '?'} -> ${h.new_status}${h.reason ? ': ' + h.reason : ''}` });
    }
    for (const e of events) {
      timeline.push({ date: e.created_at, type: 'admin', label: `${e.action} by ${e.actor || 'admin'}` });
    }
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    const missing = [];
    if (!product.brand_name) missing.push('name');
    if (ingredients.length === 0) missing.push('ingredients');
    if (!product.dosage_form) missing.push('dosage_form');
    if (!product.manufacturer_name) missing.push('manufacturer');
    if (!product.registration_number) missing.push('registration_number');
    if (sources.length === 0 && !product.source_text) missing.push('source_document');
    if (!product.safety_status) missing.push('safety_status');
    if (batches.length === 0) missing.push('batch_data');

    res.json({
      product: {
        ...product,
        ingredients,
        batches,
        notices,
        sources,
        status_history: history,
        identifiers,
        alternatives: altResult.alternatives,
        ai_powered: altResult.ai_powered,
        ai_reason: altResult.ai_reason,
        timeline,
        completeness: { missing, complete: missing.length === 0, score: Math.round(((8 - missing.length) / 8) * 100) },
      },
    });
  } catch (err) {
    console.error('admin medicine detail error', err);
    res.status(500).json({ error: 'Could not load the medicine record.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/medicines/:id - update attributes / safety classification
// ---------------------------------------------------------------------------
router.patch('/medicines/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { brand_name, dosage_form, registration_number, registration_date, manufacturer_id, source_text, safety_status, reason } = req.body || {};

    const product = await one('SELECT * FROM mediverify.products WHERE product_id = $1', [id]);
    if (!product) return res.status(404).json({ error: 'Medicine not found.' });

    const oldStatus = product.safety_status;
    if (safety_status && safety_status !== String(oldStatus)) {
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'A reason is required when changing the safety classification.' });
      }
      await q(
        `INSERT INTO mediverify.product_status_history (product_id, old_status, new_status, reason, effective_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
        [id, oldStatus, safety_status, reason.trim()]
      );
    }

    const updated = await one(
      `UPDATE mediverify.products SET
        brand_name = COALESCE($2, brand_name),
        dosage_form = COALESCE($3, dosage_form),
        registration_number = COALESCE($4, registration_number),
        registration_date = COALESCE($5, registration_date),
        manufacturer_id = COALESCE($6, manufacturer_id),
        source_text = COALESCE($7, source_text),
        safety_status = COALESCE($8, safety_status)
       WHERE product_id = $1 RETURNING *`,
      [id, brand_name || null, dosage_form || null, registration_number || null, registration_date || null, manufacturer_id || null, source_text || null, safety_status || null]
    );

    await logEvent(req.user.id, safety_status && safety_status !== String(oldStatus) ? 'safety_status_changed' : 'medicine_updated', 'medicine', id, {
      brand_name: product.brand_name,
      old_status: String(oldStatus),
      new_status: safety_status || String(oldStatus),
      reason: reason || null,
      fields: Object.keys(req.body || {}),
    });
    invalidateCache();

    res.json({ message: 'Medicine updated.', product: updated });
  } catch (err) {
    console.error('medicine update error', err);
    res.status(500).json({ error: 'Could not update the medicine.' });
  }
});

// ---------------------------------------------------------------------------
// Users / doctor approvals
// ---------------------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const { search, role, approval } = req.query;
    const where = [];
    const params = [];
    if (search && String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      const i = params.length;
      where.push(`(u.email ILIKE $${i} OR u.full_name ILIKE $${i} OR u.cnic ILIKE $${i} OR u.clinic_name ILIKE $${i})`);
    }
    if (role) { params.push(role); where.push(`r.role_name = $${params.length}`); }
    if (approval) { params.push(approval); where.push(`u.approval_status = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const rows = await q(
      `SELECT u.user_id, u.email, u.full_name, u.cnic, u.phone, u.license_number, u.clinic_name,
              u.approval_status, u.is_active, u.created_at, r.role_name AS role
       FROM mediverify.users u
       JOIN mediverify.user_roles ur ON ur.user_id = u.user_id
       JOIN mediverify.roles r ON r.role_id = ur.role_id
       ${whereSql}
       ORDER BY u.created_at DESC LIMIT 200`,
      params
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('admin users error', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

// GET /api/admin/approvals - pending doctor registrations
router.get('/approvals', async (req, res) => {
  try {
    const rows = await q(
      `SELECT u.user_id, u.email, u.full_name, u.cnic, u.phone, u.license_number, u.clinic_name, u.created_at
       FROM mediverify.users u
       JOIN mediverify.user_roles ur ON ur.user_id = u.user_id
       JOIN mediverify.roles r ON r.role_id = ur.role_id
       WHERE r.role_name = 'doctor' AND u.approval_status = 'pending'
       ORDER BY u.created_at ASC`
    );
    res.json({ pending: rows });
  } catch (err) {
    console.error('approvals error', err);
    res.status(500).json({ error: 'Could not load pending approvals.' });
  }
});

// POST /api/admin/approvals/:userId - approve or reject a doctor
router.post('/approvals/:userId', async (req, res) => {
  try {
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approve or reject.' });
    }
    const target = await one(
      `SELECT u.user_id, u.full_name FROM mediverify.users u
       JOIN mediverify.user_roles ur ON ur.user_id = u.user_id
       JOIN mediverify.roles r ON r.role_id = ur.role_id
       WHERE u.user_id = $1 AND r.role_name = 'doctor'`,
      [String(req.params.userId)]
    );
    if (!target) return res.status(404).json({ error: 'Pending doctor not found.' });

    await q('UPDATE mediverify.users SET approval_status = $1 WHERE user_id = $2', [decision, target.user_id]);
    await logEvent(req.user.id, decision === 'approved' ? 'doctor_approved' : 'doctor_rejected', 'doctor', target.user_id, { doctor: target.full_name });
    res.json({ message: `Doctor ${decision === 'approved' ? 'approved' : 'rejected'}.` });
  } catch (err) {
    console.error('approval action error', err);
    res.status(500).json({ error: 'Could not update the approval.' });
  }
});

// POST /api/admin/users/:userId/toggle - activate/deactivate account
router.post('/users/:userId/toggle', async (req, res) => {
  try {
    const target = await one('SELECT user_id, is_active, email FROM mediverify.users WHERE user_id = $1', [String(req.params.userId)]);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    await q('UPDATE mediverify.users SET is_active = NOT is_active WHERE user_id = $1', [target.user_id]);
    await logEvent(req.user.id, target.is_active ? 'user_deactivated' : 'user_activated', 'user', target.user_id, { email: target.email });
    res.json({ message: target.is_active ? 'Account deactivated.' : 'Account activated.' });
  } catch (err) {
    console.error('toggle user error', err);
    res.status(500).json({ error: 'Could not update the account.' });
  }
});

// ---------------------------------------------------------------------------
// Manufacturers
// ---------------------------------------------------------------------------
router.get('/manufacturers', async (req, res) => {
  try {
    const rows = await q(
      `SELECT m.*, (SELECT count(*) FROM mediverify.products p WHERE p.manufacturer_id = m.manufacturer_id) AS product_count
       FROM mediverify.manufacturers m ORDER BY m.legal_name`
    );
    res.json({ manufacturers: rows });
  } catch (err) {
    console.error('manufacturers error', err);
    res.status(500).json({ error: 'Could not load manufacturers.' });
  }
});

router.patch('/manufacturers/:id', async (req, res) => {
  try {
    const { legal_name, country, address } = req.body || {};
    const updated = await one(
      'UPDATE mediverify.manufacturers SET legal_name = COALESCE($2, legal_name), country = COALESCE($3, country), address = COALESCE($4, address) WHERE manufacturer_id = $1 RETURNING *',
      [String(req.params.id), legal_name || null, country || null, address || null]
    );
    if (!updated) return res.status(404).json({ error: 'Manufacturer not found.' });
    await logEvent(req.user.id, 'manufacturer_updated', 'manufacturer', updated.manufacturer_id, { legal_name: updated.legal_name });
    res.json({ message: 'Manufacturer updated.', manufacturer: updated });
  } catch (err) {
    console.error('manufacturer update error', err);
    res.status(500).json({ error: 'Could not update the manufacturer.' });
  }
});

// ---------------------------------------------------------------------------
// DRAP sources & documents
// ---------------------------------------------------------------------------
router.get('/sources', async (req, res) => {
  try {
    const rows = await q(
      `SELECT s.*, (SELECT count(*) FROM mediverify.source_documents sd WHERE sd.source_id = s.source_id) AS document_count
       FROM mediverify.sources s ORDER BY s.source_name`
    );
    res.json({ sources: rows });
  } catch (err) {
    console.error('sources error', err);
    res.status(500).json({ error: 'Could not load sources.' });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const rows = await q(
      `SELECT sd.*, s.source_name FROM mediverify.source_documents sd
       JOIN mediverify.sources s ON s.source_id = sd.source_id
       ORDER BY sd.publication_date DESC NULLS LAST LIMIT 200`
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('documents error', err);
    res.status(500).json({ error: 'Could not load source documents.' });
  }
});

// ---------------------------------------------------------------------------
// Backups: dump key tables to a JSON file + log
// ---------------------------------------------------------------------------
router.get('/backups', async (req, res) => {
  try {
    const rows = await q(
      `SELECT b.*, u.display_name AS triggered_by_name FROM rxguard.backups b
       LEFT JOIN mediverify.users u ON u.user_id = b.triggered_by ORDER BY b.created_at DESC LIMIT 50`
    );
    res.json({ backups: rows });
  } catch (err) {
    console.error('backups list error', err);
    res.status(500).json({ error: 'Could not load backups.' });
  }
});

router.post('/backups', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });

    const tables = [
      'mediverify.users', 'mediverify.products', 'mediverify.ingredients', 'mediverify.manufacturers',
      'mediverify.product_ingredients', 'mediverify.safety_notices', 'mediverify.recall_batches',
      'mediverify.notice_products', 'mediverify.admin_events',
      'rxguard.prescriptions', 'rxguard.patient_files', 'rxguard.doctor_prescriptions',
      'rxguard.search_history', 'rxguard.retailers',
    ];
    const dump = { created_at: new Date().toISOString(), tables: {} };
    for (const t of tables) {
      const r = await pool.query(`SELECT * FROM ${t}`);
      dump.tables[t] = { rows: r.rows.length, data: r.rows };
    }
    const name = `rxguard-backup-${Date.now()}.json`;
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(dump));
    const size = fs.statSync(file).size;

    const row = await one(
      "INSERT INTO rxguard.backups (file_name, file_size, status, triggered_by) VALUES ($1, $2, 'success', $3) RETURNING *",
      [name, size, req.user.id]
    );
    await logEvent(req.user.id, 'backup_created', 'backup', row.backup_id, { file_name: name, size });
    res.json({ message: 'Backup created successfully.', backup: row });
  } catch (err) {
    console.error('backup error', err);
    try { await q("INSERT INTO rxguard.backups (file_name, status, triggered_by) VALUES ($1, 'failed', $2)", [`failed-${Date.now()}`, req.user.id]); } catch (e) {}
    res.status(500).json({ error: 'Backup failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Admin events (immutable audit trail)
// ---------------------------------------------------------------------------
router.get('/events', async (req, res) => {
  try {
    const rows = await q(
      `SELECT a.*, u.display_name AS actor, u.email AS actor_email
       FROM mediverify.admin_events a LEFT JOIN mediverify.users u ON u.user_id = a.user_id
       ORDER BY a.created_at DESC LIMIT 300`
    );
    res.json({ events: rows });
  } catch (err) {
    console.error('events error', err);
    res.status(500).json({ error: 'Could not load admin events.' });
  }
});

// ---------------------------------------------------------------------------
// Admin dashboard summary
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  try {
    const summary = await one(
      `SELECT
        (SELECT count(*) FROM mediverify.products) AS total_medicines,
        (SELECT count(*) FROM mediverify.products WHERE safety_status::text = 'active') AS safe_medicines,
        (SELECT count(*) FROM mediverify.products WHERE safety_status::text <> 'active') AS unsafe_medicines,
        (SELECT count(*) FROM mediverify.users) AS total_users,
        (SELECT count(*) FROM mediverify.users u JOIN mediverify.user_roles ur ON ur.user_id = u.user_id
           JOIN mediverify.roles r ON r.role_id = ur.role_id WHERE r.role_name = 'doctor' AND u.approval_status = 'pending') AS pending_doctors,
        (SELECT count(*) FROM mediverify.safety_notices) AS safety_notices,
        (SELECT count(*) FROM mediverify.recall_batches) AS recall_batches,
        (SELECT count(*) FROM mediverify.admin_events) AS admin_events,
        (SELECT count(*) FROM rxguard.backups) AS backups`
    );
    const statusDistribution = await q(
      'SELECT safety_status::text AS status, count(*) AS count FROM mediverify.products GROUP BY 1 ORDER BY 2 DESC'
    );
    res.json({ summary, statusDistribution });
  } catch (err) {
    console.error('summary error', err);
    res.status(500).json({ error: 'Could not load the summary.' });
  }
});

module.exports = router;
