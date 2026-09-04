// Prescription endpoints: patient saved prescriptions (with image upload),
// doctor notepad drafts, safety analysis, and print gating.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { q, one } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { analyzePrescription, loadProducts, findAlternatives } = require('../utils/analysis');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'prescriptions');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Per-user ownership helper: fetch a prescription and confirm it belongs to
// the caller. Doctors access rows through their own patient files.
async function ownedPrescription(prescriptionId, userId) {
  return one('SELECT * FROM rxguard.prescriptions WHERE prescription_id = $1 AND user_id = $2', [
    prescriptionId,
    userId,
  ]);
}

// ---------------------------------------------------------------------------
// PATIENT: save prescription details (typed) and upload prescription photo
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '.jpg') || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image files are allowed.'), ok);
  },
});

// POST /api/prescriptions/patient - save details (optionally with a photo)
router.post('/patient', requireAuth, requireRole('patient', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const { title, details } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Please give your prescription a name.' });

    let file_name = null;
    let file_path = null;
    let mime_type = null;
    if (req.file) {
      file_name = req.file.filename;
      file_path = req.file.path;
      mime_type = req.file.mimetype;
    }

    const row = await one(
      "INSERT INTO rxguard.prescriptions (user_id, title, details, file_name, file_path, mime_type, status) " +
      "VALUES ($1, $2, $3, $4, $5, $6, 'success') RETURNING *",
      [req.user.id, title.trim(), details || null, file_name, file_path, mime_type]
    );
    res.status(201).json({ message: 'Prescription saved to your dashboard.', prescription: row });
  } catch (err) {
    console.error('patient prescription save error', err);
    res.status(500).json({ error: 'Could not save your prescription. Please try again.' });
  }
});

// GET /api/prescriptions/patient - list caller's saved prescriptions
router.get('/patient', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  try {
    const rows = await q(
      'SELECT prescription_id, title, details, file_name, mime_type, status, created_at FROM rxguard.prescriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ prescriptions: rows });
  } catch (err) {
    console.error('list error', err);
    res.status(500).json({ error: 'Could not load your prescriptions.' });
  }
});

// GET /api/prescriptions/patient/:id - detail view (ownership enforced)
router.get('/patient/:id', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  try {
    const row = await ownedPrescription(String(req.params.id), req.user.id);
    if (!row) return res.status(404).json({ error: 'Prescription not found.' });
    res.json({ prescription: row });
  } catch (err) {
    console.error('detail error', err);
    res.status(500).json({ error: 'Could not load the prescription.' });
  }
});

// DELETE /api/prescriptions/patient/:id
router.delete('/patient/:id', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  try {
    const row = await ownedPrescription(String(req.params.id), req.user.id);
    if (!row) return res.status(404).json({ error: 'Prescription not found.' });
    if (row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }
    await q('DELETE FROM rxguard.prescriptions WHERE prescription_id = $1', [row.prescription_id]);
    res.json({ message: 'Prescription deleted.' });
  } catch (err) {
    console.error('delete error', err);
    res.status(500).json({ error: 'Could not delete the prescription.' });
  }
});

// GET /api/prescriptions/patient/:id/image - serve the stored image
router.get('/patient/:id/image', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  try {
    const row = await ownedPrescription(String(req.params.id), req.user.id);
    if (!row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Image not found.' });
    }
    res.sendFile(path.resolve(row.file_path));
  } catch (err) {
    console.error('image error', err);
    res.status(500).json({ error: 'Could not load the image.' });
  }
});

// ---------------------------------------------------------------------------
// SHARED: analyze prescription text -> ordered medicine statuses
// ---------------------------------------------------------------------------
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Please type a prescription first.' });
    }
    const analysis = await analyzePrescription(content);
    res.json(analysis);
  } catch (err) {
    console.error('analyze error', err);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// DOCTOR: patient files (folders) and prescriptions inside them
// ---------------------------------------------------------------------------
// GET /api/prescriptions/files - doctor's patient folders
router.get('/files', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const files = await q(
      "SELECT f.file_id, f.patient_name, f.created_at, " +
      "COUNT(d.dp_id) AS prescription_count, " +
      "MAX(d.updated_at) AS last_updated " +
      "FROM rxguard.patient_files f " +
      "LEFT JOIN rxguard.doctor_prescriptions d ON d.file_id = f.file_id " +
      "WHERE f.doctor_id = $1 GROUP BY f.file_id, f.patient_name, f.created_at " +
      "ORDER BY f.patient_name",
      [req.user.id]
    );
    res.json({ files: files });
  } catch (err) {
    console.error('files error', err);
    res.status(500).json({ error: 'Could not load your patient files.' });
  }
});

// POST /api/prescriptions/files - create a patient folder
router.post('/files', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { patientName } = req.body || {};
    if (!patientName || !patientName.trim()) return res.status(400).json({ error: 'Patient name is required.' });
    const existing = await one(
      'SELECT file_id FROM rxguard.patient_files WHERE doctor_id = $1 AND patient_name = $2',
      [req.user.id, patientName.trim()]
    );
    if (existing) return res.status(409).json({ error: 'A folder for this patient already exists.' });
    const row = await one(
      'INSERT INTO rxguard.patient_files (doctor_id, patient_name) VALUES ($1, $2) RETURNING *',
      [req.user.id, patientName.trim()]
    );
    res.status(201).json({ message: 'Patient folder created.', file: row });
  } catch (err) {
    console.error('create file error', err);
    res.status(500).json({ error: 'Could not create the patient folder.' });
  }
});

// DELETE /api/prescriptions/files/:id - delete folder and its prescriptions
router.delete('/files/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const row = await one(
      'SELECT file_id FROM rxguard.patient_files WHERE file_id = $1 AND doctor_id = $2',
      [String(req.params.id), req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Patient folder not found.' });
    await q('DELETE FROM rxguard.patient_files WHERE file_id = $1', [row.file_id]);
    res.json({ message: 'Patient folder deleted.' });
  } catch (err) {
    console.error('delete file error', err);
    res.status(500).json({ error: 'Could not delete the patient folder.' });
  }
});

// GET /api/prescriptions/files/:id - prescriptions within a folder
router.get('/files/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const folder = await one(
      'SELECT * FROM rxguard.patient_files WHERE file_id = $1 AND doctor_id = $2',
      [String(req.params.id), req.user.id]
    );
    if (!folder) return res.status(404).json({ error: 'Patient folder not found.' });
    const prescriptions = await q(
      'SELECT dp_id, content, status, created_at, updated_at FROM rxguard.doctor_prescriptions WHERE file_id = $1 ORDER BY updated_at DESC',
      [folder.file_id]
    );
    res.json({ file: folder, prescriptions });
  } catch (err) {
    console.error('folder detail error', err);
    res.status(500).json({ error: 'Could not load the patient folder.' });
  }
});

// POST /api/prescriptions/draft - save draft (autosave / Save Draft button)
router.post('/draft', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { fileId, content, dpId } = req.body || {};
    if (!content || !String(content).trim()) return res.status(400).json({ error: 'Prescription text is empty.' });

    const folder = await one(
      'SELECT file_id FROM rxguard.patient_files WHERE file_id = $1 AND doctor_id = $2',
      [fileId, req.user.id]
    );
    if (!folder) return res.status(404).json({ error: 'Patient folder not found.' });

    const analysis = await analyzePrescription(content);

    if (dpId) {
      const existing = await one(
        'SELECT dp_id FROM rxguard.doctor_prescriptions WHERE dp_id = $1 AND doctor_id = $2',
        [dpId, req.user.id]
      );
      if (existing) {
        const row = await one(
          "UPDATE rxguard.doctor_prescriptions SET content = $1, status = $2, updated_at = now() WHERE dp_id = $3 RETURNING *",
          [content, analysis.all_safe ? 'safe' : 'draft', dpId]
        );
        return res.json({ message: 'Draft updated.', prescription: row, analysis });
      }
    }

    const row = await one(
      "INSERT INTO rxguard.doctor_prescriptions (file_id, doctor_id, content, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [folder.file_id, req.user.id, content, analysis.all_safe ? 'safe' : 'draft']
    );
    res.status(201).json({ message: 'Draft saved.', prescription: row, analysis });
  } catch (err) {
    console.error('draft error', err);
    res.status(500).json({ error: 'Could not save the draft.' });
  }
});

// GET /api/prescriptions/draft/:dpId - load one draft (ownership enforced)
router.get('/draft/:dpId', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const row = await one(
      'SELECT dp.*, f.patient_name FROM rxguard.doctor_prescriptions dp JOIN rxguard.patient_files f ON f.file_id = dp.file_id WHERE dp.dp_id = $1 AND dp.doctor_id = $2',
      [String(req.params.dpId), req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Prescription not found.' });
    res.json({ prescription: row });
  } catch (err) {
    console.error('draft get error', err);
    res.status(500).json({ error: 'Could not load the prescription.' });
  }
});

// DELETE /api/prescriptions/draft/:dpId
router.delete('/draft/:dpId', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const row = await one(
      'SELECT dp_id FROM rxguard.doctor_prescriptions WHERE dp_id = $1 AND doctor_id = $2',
      [String(req.params.dpId), req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Prescription not found.' });
    await q('DELETE FROM rxguard.doctor_prescriptions WHERE dp_id = $1', [row.dp_id]);
    res.json({ message: 'Prescription deleted.' });
  } catch (err) {
    console.error('draft delete error', err);
    res.status(500).json({ error: 'Could not delete the prescription.' });
  }
});

// POST /api/prescriptions/print - gate: all medicines must be safe
router.post('/print', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { fileId, content, dpId } = req.body || {};
    if (!content || !String(content).trim()) return res.status(400).json({ error: 'Prescription text is empty.' });

    const analysis = await analyzePrescription(content);
    if (!analysis.all_safe) {
      return res.status(422).json({
        error: 'This prescription cannot be printed yet. Replace or remove all unsafe medicines first.',
        analysis,
      });
    }

    const folder = await one(
      'SELECT file_id FROM rxguard.patient_files WHERE file_id = $1 AND doctor_id = $2',
      [fileId, req.user.id]
    );
    if (!folder) return res.status(404).json({ error: 'Patient folder not found.' });

    if (dpId) {
      await q(
        "UPDATE rxguard.doctor_prescriptions SET content = $1, status = 'printed', updated_at = now() WHERE dp_id = $2 AND doctor_id = $3",
        [content, dpId, req.user.id]
      );
    } else {
      await q(
        "INSERT INTO rxguard.doctor_prescriptions (file_id, doctor_id, content, status) VALUES ($1, $2, $3, 'printed')",
        [folder.file_id, req.user.id, content]
      );
    }

    res.json({ message: 'Prescription verified as fully safe and saved. Printing.', analysis });
  } catch (err) {
    console.error('print error', err);
    res.status(500).json({ error: 'Could not print the prescription.' });
  }
});

module.exports = router;
