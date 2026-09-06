// RxGuard AI REST API server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./db-init');
const { q } = require('./db');
const { ensureProductEmbeddings } = require('./utils/embeddings');
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const prescriptionRoutes = require('./routes/prescriptions');
const historyRoutes = require('./routes/history');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Simple request log for diagnostics
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'RxGuard AI API' }));

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Serve the exported web app (single origin: the app and API share one port)
const fs = require('fs');
const WEB_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(WEB_DIST)) {
  // Hashed assets can be cached forever; index.html must always be revalidated
  // so browsers pick up newly exported bundles instead of stale ones.
  app.use(express.static(WEB_DIST, { maxAge: '1y', immutable: true, index: false }));
  // SPA fallback: client-side routes such as /dashboard serve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
  console.log(`Serving RxGuard AI web app from ${WEB_DIST}`);
}

// Friendly error handler - never leak stack traces
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.message);
  const msg =
    err && err.message === 'Only image files are allowed.'
      ? 'Only image files can be uploaded.'
      : 'Something went wrong on our side. Please try again.';
  res.status(err && err.status ? err.status : 500).json({ error: msg });
});

async function startServer() {
  try {
    await initDatabase();

    // Idempotent migration: make sure the products table has embedding columns
    // even when the database was created before this feature was added.
    await q('ALTER TABLE mediverify.products ADD COLUMN IF NOT EXISTS embedding jsonb');
    await q('ALTER TABLE mediverify.products ADD COLUMN IF NOT EXISTS embedding_model text');

    // Generate or refresh embeddings in the background. If the model cannot be
    // downloaded (e.g. offline), the API still starts; semantic search simply
    // falls back to keyword search until embeddings are available.
    await ensureProductEmbeddings().catch((err) => {
      console.error('Embedding generation warning:', err.message);
      console.error('Semantic search will run in keyword-only mode until embeddings are available.');
    });

    app.listen(PORT, () => {
      console.log(`RxGuard AI API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('\nFailed to start RxGuard AI API:');
    console.error(err.message);
    if (/database|connection|ECONNREFUSED|password authentication|does not exist/i.test(err.message)) {
      console.error('\nPlease check your database settings:');
      console.error('  1. Copy backend/.env.example to backend/.env');
      console.error('  2. Fill in DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD');
      console.error('  3. Make sure PostgreSQL is running and the database exists.');
    }
    process.exit(1);
  }
}

startServer();
