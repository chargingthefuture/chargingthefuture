#!/usr/bin/env node
// Seed script for Trust plugin validation

const { queryDb } = require('../../src/lib/db/postgres');

async function seedTrustUserExtension() {
  const demoUsers = [
    { userId: 'demo-user-1', trustStatus: 'verified', trustEvidence: [
      { type: 'admin-note', summary: 'Verified by admin', createdAt: new Date().toISOString(), createdBy: 'admin' }
    ] },
    { userId: 'demo-user-2', trustStatus: 'flagged', trustEvidence: [
      { type: 'admin-note', summary: 'Flagged for review', createdAt: new Date().toISOString(), createdBy: 'admin' }
    ] },
    { userId: 'demo-user-3', trustStatus: 'unverified', trustEvidence: [] },
  ];

  for (const user of demoUsers) {
    await queryDb(
      `INSERT INTO trust_user_extension (user_id, trust_status, trust_evidence, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET trust_status = EXCLUDED.trust_status, trust_evidence = EXCLUDED.trust_evidence, updated_at = NOW()`,
      [user.userId, user.trustStatus, JSON.stringify(user.trustEvidence)]
    );
  }
  console.log('Seeded trust_user_extension with demo users.');
}

seedTrustUserExtension().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
