function inferRenderProduction() {
  return process.env.RENDER_ENVIRONMENT === 'production';
}

function isTruthy(value) {
  if (!value) {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function isInternalLedgerHost(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    return true;
  }

  // Render reaches the Formance ledger over its private network by bare service
  // name (no public TLS), so plain http is acceptable for these internal hosts.
  return normalized === 'ledger'
    || normalized === 'formance-ledger'
    || normalized === 'ctf-formance-ledger';
}

const renderProduction = inferRenderProduction();
const requireFormance = isTruthy(process.env.SERVICE_CREDITS_REQUIRE_FORMANCE)
  || renderProduction;

const requiredKeys = ['FORMANCE_API_URL', 'FORMANCE_LEDGER', 'FORMANCE_API_TOKEN'];

if (!requireFormance) {
  console.log('Formance env check skipped (not required in current runtime).');
  process.exit(0);
}

const missing = requiredKeys.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);
if (missing.length > 0) {
  console.error('Formance env validation failed. Missing required keys:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

try {
  const parsed = new URL(String(process.env.FORMANCE_API_URL));
  const isInternalHost = isInternalLedgerHost(parsed.hostname);

  if (parsed.protocol !== 'https:' && !isInternalHost) {
    console.error(`FORMANCE_API_URL must use https for external services unless targeting an internal host. Received: ${process.env.FORMANCE_API_URL}`);
    process.exit(1);
  }
} catch {
  console.error(`Invalid FORMANCE_API_URL format: ${process.env.FORMANCE_API_URL}`);
  process.exit(1);
}

console.log('Formance environment validation passed.');
