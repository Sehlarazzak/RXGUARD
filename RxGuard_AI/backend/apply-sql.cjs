// Applies a SQL file to the RxGuard AI database (same credentials as .env)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const file = process.argv[2];
if (!file) {
  console.error('Usage: node apply-sql.cjs <file.sql>');
  process.exit(1);
}

const c = new Client({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'RxGuard AI',
});

(async () => {
  await c.connect();
  const sql = fs.readFileSync(path.resolve(file), 'utf8');
  await c.query(sql);
  console.log('Applied:', file);
  await c.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
