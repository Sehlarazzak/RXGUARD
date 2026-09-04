// Creates the test accounts (idempotent):
//   Patient : john@test.com  / John@1234
//   Doctor  : jane@test.com  / Jane@1234 (pre-approved)
//   Admin   : admin@rxguard.ai / Admin@1234
const { seedDemoAccounts } = require('./db-init');

(async () => {
  await seedDemoAccounts();
  console.log('Seed complete.');
  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
