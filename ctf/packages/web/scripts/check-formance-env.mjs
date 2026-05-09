function inferRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.RAILWAY_DEPLOYMENT_ENVIRONMENT,
  );
}

function inferRailwayProduction() {
  const name = (
    process.env.RAILWAY_ENVIRONMENT_NAME
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.RAILWAY_DEPLOYMENT_ENVIRONMENT
    || ''
  ).toLowerCase();
  return name === 'production';
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

const runningOnRailway = inferRailwayRuntime();
const railwayProduction = inferRailwayProduction();
const requireFormance = isTruthy(process.env.SERVICE_CREDITS_REQUIRE_FORMANCE)
  || railwayProduction;

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

  if (runningOnRailway) {
    if (!isInternalHost) {
      console.error(`FORMANCE_API_URL must target Railway private networking when running on Railway. Use an internal host (for example: http://ledger.railway.internal:8080). Received: ${process.env.FORMANCE_API_URL}`);
      process.exit(1);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.error(`FORMANCE_API_URL must use http or https. Received: ${process.env.FORMANCE_API_URL}`);
      process.exit(1);
    }
  } else if (parsed.protocol !== 'https:' && !isInternalHost) {
    console.error(`FORMANCE_API_URL must use https for non-local runtimes unless targeting a private internal host. Received: ${process.env.FORMANCE_API_URL}`);
    process.exit(1);
  }
} catch {
  console.error(`Invalid FORMANCE_API_URL format: ${process.env.FORMANCE_API_URL}`);
  process.exit(1);
}

console.log('Formance environment validation passed.');
