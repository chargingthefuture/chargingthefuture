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

function isRailwayInternalHost(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    return true;
  }

  if (normalized === 'ledger' || normalized === 'formance-ledger') {
    return true;
  }

  return normalized.endsWith('.railway.internal');
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
  const isInternalHost = isRailwayInternalHost(parsed.hostname);

  if (parsed.protocol !== 'https:' && !isInternalHost) {
    console.error(`FORMANCE_API_URL must use https for external services unless targeting an internal host. Received: ${process.env.FORMANCE_API_URL}`);
    process.exit(1);
  }
} catch {
  console.error(`Invalid FORMANCE_API_URL format: ${process.env.FORMANCE_API_URL}`);
  process.exit(1);
}

console.log('Formance environment validation passed.');
