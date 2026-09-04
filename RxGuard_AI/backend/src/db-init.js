// Automatic database initialisation for portable deployments.
// When a judge clones the repo and creates an empty PostgreSQL database,
// the backend creates the mediverify + rxguard schemas and seed data on
// first startup. Running against an already-populated database is safe.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, q, one, schemaExists } = require('./db');

const SCHEMA_FILE = path.join(__dirname, '..', '..', 'database', 'schema.sql');

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

async function upsertUser({ email, password, fullName, cnic, phone, role, license, clinic, approval }) {
  const existing = await one('SELECT user_id FROM mediverify.users WHERE lower(email) = $1', [email.toLowerCase()]);
  if (existing) {
    console.log(`- ${email} already exists, skipping`);
    return existing.user_id;
  }
  const hash = await bcrypt.hash(password, 10);
  const roleId = role === 'patient' ? 1 : role === 'doctor' ? 2 : 4;
  const user = await one(
    `INSERT INTO mediverify.users (email, password_hash, display_name, full_name, cnic, phone, license_number, clinic_name, is_active, approval_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9) RETURNING user_id`,
    [email, hash, fullName, fullName, cnic, phone || null, license || null, clinic || null, approval || 'approved']
  );
  await q('INSERT INTO mediverify.user_roles (user_id, role_id) VALUES ($1, $2)', [user.user_id, roleId]);
  console.log(`+ created ${role}: ${email}`);
  return user.user_id;
}

async function seedDemoAccounts() {
  await upsertUser({
    email: 'john@test.com',
    password: 'John@1234',
    fullName: 'John Doe',
    cnic: '35202-1234567-1',
    phone: '+92 300 1234567',
    role: 'patient',
  });
  await upsertUser({
    email: 'jane@test.com',
    password: 'Jane@1234',
    fullName: 'Dr. Jane Smith',
    cnic: '35202-7654321-2',
    phone: '+92 301 7654321',
    role: 'doctor',
    license: 'PMDC-2019-45231',
    clinic: 'Shifa International Hospital',
    approval: 'approved',
  });
  await upsertUser({
    email: 'admin@rxguard.ai',
    password: 'Admin@1234',
    fullName: 'RxGuard Administrator',
    cnic: '35202-0000000-3',
    role: 'admin',
  });
}

async function seedProductionBatches() {
  const batchesFile = path.join(__dirname, '..', '..', 'database', 'seed-batches.sql');
  if (fs.existsSync(batchesFile)) {
    await runSqlFile(batchesFile);
    console.log('+ production batches seeded');
  }
}

async function initDatabase() {
  const exists = await schemaExists();
  if (exists) {
    console.log('Database schema already present. Skipping automatic initialisation.');
    return;
  }

  console.log('No mediverify schema found. Creating full schema and seed data...');
  if (!fs.existsSync(SCHEMA_FILE)) {
    throw new Error(`Schema file not found: ${SCHEMA_FILE}`);
  }
  await runSqlFile(SCHEMA_FILE);
  await seedProductionBatches();
  await seedDemoAccounts();
  console.log('Database initialisation complete.');
}

module.exports = { initDatabase, seedDemoAccounts };
