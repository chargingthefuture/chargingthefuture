#!/usr/bin/env node
// Seed script for Trust plugin validation

const { queryDb } = require('../../src/lib/db/postgres');

async function seedTrustUserExtension() {
  const demoUsers = [
    { userId: 'demo-user-1', trustEvidence: [
      { type: 'engagement-login-frequency', summary: 'Active on 12 days', createdAt: new Date().toISOString(), createdBy: 'trust-signal' }
    ] },
    { userId: 'demo-user-2', trustEvidence: [
      { type: 'engagement-chyme-rooms', summary: 'Joined 2 Chyme rooms', createdAt: new Date().toISOString(), createdBy: 'trust-signal' }
    ] },
    { userId: 'demo-user-3', trustEvidence: [] },
  ];

  for (const user of demoUsers) {
    await queryDb(
      `INSERT INTO trust_user_extension (user_id, trust_evidence, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET trust_evidence = EXCLUDED.trust_evidence, updated_at = NOW()`,
      [user.userId, JSON.stringify(user.trustEvidence)]
    );
  }
  console.log('Seeded trust_user_extension with demo users.');
}

seedTrustUserExtension().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
