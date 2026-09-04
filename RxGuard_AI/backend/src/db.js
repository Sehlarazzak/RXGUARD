const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'RxGuard AI',
  max: 10,
  idleTimeoutMillis: 30000,
};

const pool = new Pool(dbConfig);

// Central query helper. All queries use parameterised statements so user
// input can never reach the SQL engine as code (SQL-injection protection).
async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

async function one(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

// Check whether the application schema has been initialised.
async function schemaExists() {
  try {
    const row = await one(
      `SELECT 1 AS exists
       FROM information_schema.tables
       WHERE table_schema = 'mediverify' AND table_name = 'users'`
    );
    return !!row;
  } catch (err) {
    console.error('schemaExists check failed:', err.message);
    return false;
  }
}

module.exports = { pool, q, one, dbConfig, schemaExists };
