#!/usr/bin/env node
// Surface GitHub's open security findings into ONE always-current triage issue, so you can
// decide what's worth acting on without opening the Security tab.
//
// It reads three alert feeds from the app repo via the API:
//   - Dependabot alerts (vulnerable dependencies AND malware advisories)
//   - Code scanning alerts (CodeQL findings in your own code)
//   - Secret scanning alerts (credentials committed to the repo)
//
// and writes/updates a single issue in the PRIVATE triage repo. It is filed privately on
// purpose: the app repo is public, and a public issue listing vulnerable dependencies, the
// file+line of an injection, or anything about a leaked secret would help an attacker. The
// raw secret VALUE is never read into the output under any circumstance — only the secret
// type, state, and link.
//
// One issue, updated in place (like the workflow health check). If everything is clean the
// existing issue is closed. No-ops safely when unconfigured.
//
// Required environment:
//   GH_TOKEN              A token that can read the app repo's security alerts AND write
//                         issues on the triage repo (use the GH_PAT secret).
//
// Optional environment:
//   GITHUB_REPOSITORY     App repo to read alerts from (default: chargingthefuture/chargingthefuture).
//   SECURITY_TRIAGE_REPO  Private repo to file the triage issue in (default: chargingthefuture/bug-reports).
//   SECURITY_TRIAGE_MAX_LISTED  Most alerts listed per section before "…and N more" (default: 50).

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const APP_REPO = (process.env.GITHUB_REPOSITORY || 'chargingthefuture/chargingthefuture').trim();
const TRIAGE_REPO = (process.env.SECURITY_TRIAGE_REPO || 'chargingthefuture/bug-reports').trim();
const MAX_LISTED = Number(process.env.SECURITY_TRIAGE_MAX_LISTED || '50');
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, warning: 4, note: 5, error: 1 };

if (!process.env.GH_TOKEN) {
  console.log('surfaceSecurityFindings: GH_TOKEN not set; nothing to do.');
  process.exit(0);
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

// Page an array endpoint by hand so a clean JSON array comes back each page. Returns
// { ok, data, error } — ok:false when the feature is off or the token can't read it.
function ghApiPaged(path) {
  const all = [];
  try {
    for (let page = 1; page <= 25; page += 1) {
      const sep = path.includes('?') ? '&' : '?';
      const raw = gh(['api', '-H', 'Accept: application/vnd.github+json', `${path}${sep}per_page=100&page=${page}`]);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) {
        break;
      }
      all.push(...arr);
      if (arr.length < 100) {
        break;
      }
    }
    return { ok: true, data: all };
  } catch (error) {
    // Keep this short and non-sensitive: the message can mention 403/404, not secrets.
    const msg = String(error?.stderr || error?.message || error).split('\n')[0].slice(0, 200);
    return { ok: false, data: [], error: msg };
  }
}

function bySeverity(a, b) {
  return (SEVERITY_RANK[a] ?? 9) - (SEVERITY_RANK[b] ?? 9);
}

function countBySeverity(severities) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of severities) {
    if (counts[s] !== undefined) {
      counts[s] += 1;
    }
  }
  return counts;
}

function listWithOverflow(lines) {
  if (lines.length <= MAX_LISTED) {
    return lines;
  }
  return [...lines.slice(0, MAX_LISTED), `- …and ${lines.length - MAX_LISTED} more`];
}

// A Dependabot alert is malware when its advisory is classified as malware. These are the
// most urgent: a dependency that is actively malicious, not just vulnerable.
function isMalware(alert) {
  const cls = alert.security_advisory?.classifications;
  return Array.isArray(cls) && cls.some((c) => /malware/i.test(String(c)));
}

function dependabotSection() {
  const res = ghApiPaged(`/repos/${APP_REPO}/dependabot/alerts?state=open`);
  if (!res.ok) {
    return { lines: ['_Could not read Dependabot alerts (feature off or token lacks permission)._', `_(${res.error})_`], actionable: 0, malware: 0 };
  }
  const malware = res.data.filter(isMalware);
  const vulns = res.data.filter((a) => !isMalware(a));
  const counts = countBySeverity(vulns.map((a) => a.security_advisory?.severity));
  const head = `**Malware: ${malware.length} · Critical: ${counts.critical} · High: ${counts.high} · Medium: ${counts.medium} · Low: ${counts.low}**`;
  const lines = [head, ''];

  if (malware.length) {
    const malLines = malware.map((a) => {
      const pkg = a.dependency?.package?.name || '(unknown package)';
      const summary = (a.security_advisory?.summary || '').replace(/\s+/g, ' ').slice(0, 120);
      return `- \`${pkg}\` — ${summary} (${a.html_url})`;
    });
    lines.push('### ⚠️ Malware — remove these dependencies immediately', ...listWithOverflow(malLines), '');
  }

  const actNow = vulns
    .filter((a) => ['critical', 'high'].includes(a.security_advisory?.severity))
    .sort((a, b) => bySeverity(a.security_advisory?.severity, b.security_advisory?.severity))
    .map((a) => {
      const sev = a.security_advisory?.severity;
      const pkg = a.dependency?.package?.name || '(unknown package)';
      const fix = a.security_vulnerability?.first_patched_version?.identifier;
      const fixNote = fix ? `fix in ${fix}` : 'no fix yet';
      const summary = (a.security_advisory?.summary || '').replace(/\s+/g, ' ').slice(0, 120);
      return `- [${sev}] \`${pkg}\` — ${fixNote} — ${summary} (${a.html_url})`;
    });
  if (actNow.length) {
    lines.push('### Critical & High vulnerabilities — worth acting on', ...listWithOverflow(actNow));
  } else {
    lines.push('_No open Critical or High dependency vulnerabilities. (Medium/Low counts above.)_');
  }
  return { lines, actionable: counts.critical + counts.high, malware: malware.length };
}

function codeScanningSection() {
  const res = ghApiPaged(`/repos/${APP_REPO}/code-scanning/alerts?state=open`);
  if (!res.ok) {
    return { lines: ['_Could not read code scanning alerts (feature off or token lacks permission)._', `_(${res.error})_`], actionable: 0 };
  }
  if (res.data.length === 0) {
    return { lines: ['_No open code scanning alerts._'], actionable: 0 };
  }
  const sorted = [...res.data].sort((a, b) =>
    bySeverity(a.rule?.security_severity_level || a.rule?.severity, b.rule?.security_severity_level || b.rule?.severity),
  );
  const lines = sorted.map((a) => {
    const sev = a.rule?.security_severity_level || a.rule?.severity || 'unknown';
    const rule = a.rule?.id || a.rule?.name || '(rule)';
    const loc = a.most_recent_instance?.location;
    const where = loc?.path ? `${loc.path}:${loc.start_line ?? '?'}` : '(location n/a)';
    return `- [${sev}] \`${rule}\` — ${where} (${a.html_url})`;
  });
  const highish = res.data.filter((a) => ['critical', 'high'].includes(a.rule?.security_severity_level)).length;
  return { lines: [`**Open: ${res.data.length} (Critical/High: ${highish})**`, '', ...listWithOverflow(lines)], actionable: highish };
}

function secretScanningSection() {
  const res = ghApiPaged(`/repos/${APP_REPO}/secret-scanning/alerts?state=open`);
  if (!res.ok) {
    return { lines: ['_Could not read secret scanning alerts (feature off or token lacks permission)._', `_(${res.error})_`], actionable: 0 };
  }
  if (res.data.length === 0) {
    return { lines: ['_No open secret scanning alerts._'], actionable: 0 };
  }
  // SAFE FIELDS ONLY. Never read or print `.secret` (the raw credential value).
  const lines = res.data.map((a) => {
    const type = a.secret_type_display_name || a.secret_type || '(unknown type)';
    return `- ${type} — ${a.state || 'open'} (${a.html_url})`;
  });
  return {
    lines: [`**Open: ${res.data.length} — rotate any real ones immediately (the value is intentionally not shown here).**`, '', ...listWithOverflow(lines)],
    actionable: res.data.length,
  };
}

function ensureLabel(name, color, description) {
  try {
    gh(['label', 'create', name, '--repo', TRIAGE_REPO, '--color', color, '--description', description, '--force']);
  } catch {
    // no-trace: best-effort, since applying the label at create time is what matters.
  }
}

function findExistingIssue() {
  try {
    const raw = gh(['issue', 'list', '--repo', TRIAGE_REPO, '--label', 'security-triage', '--state', 'open', '--json', 'number', '--limit', '1']);
    const list = JSON.parse(raw);
    return list[0]?.number ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const dep = dependabotSection();
  const code = codeScanningSection();
  const secret = secretScanningSection();
  const totalActionable = dep.actionable + dep.malware + code.actionable + secret.actionable;

  const body = [
    `_Security findings in \`${APP_REPO}\` as of ${today}. Filed privately because the app repo is public — do not copy alert details into public issues or PRs._`,
    '',
    '## What this triage covers',
    '- ✅ Dependabot **malware** advisories — always listed, top priority',
    '- ✅ Dependabot **vulnerabilities** — Critical/High listed; Medium/Low as counts',
    '- ✅ **Code scanning** (CodeQL) alerts — rule, severity, and location',
    '- ✅ **Secret scanning** alerts — type, state, and link only (never the value)',
    '- ❌ **Code quality** findings — no stable API; check the Security tab directly',
    '',
    '## Dependabot — malware and vulnerable dependencies',
    '',
    ...dep.lines,
    '',
    '## Code scanning (CodeQL) — your own code',
    '',
    ...code.lines,
    '',
    '## Secret scanning — committed credentials',
    '',
    ...secret.lines,
    '',
    '---',
    'Filed by `.github/workflows/security-findings-triage.yml`. Updated in place each run; closed',
    'automatically when there is no malware, nothing Critical/High, and no open secret alerts.',
  ].join('\n');

  const bodyFile = join(tmpdir(), 'security-triage-body.md');
  writeFileSync(bodyFile, `${body}\n`);

  ensureLabel('security-triage', 'b60205', 'Always-current digest of open security findings');
  const existing = findExistingIssue();
  const title = `Security findings triage — ${dep.malware} malware · ${dep.actionable} dep · ${code.actionable} code · ${secret.actionable} secret`;

  if (totalActionable === 0 && existing) {
    gh(['issue', 'comment', String(existing), '--repo', TRIAGE_REPO, '--body', `Cleared as of ${today}: no malware, no Critical/High dependency or code-scanning alerts, and no open secret alerts. Closing.`]);
    gh(['issue', 'close', String(existing), '--repo', TRIAGE_REPO]);
    console.log('surfaceSecurityFindings: all clear; closed the triage issue.');
    return;
  }

  if (existing) {
    gh(['issue', 'edit', String(existing), '--repo', TRIAGE_REPO, '--title', title, '--body-file', bodyFile]);
    console.log(`surfaceSecurityFindings: updated triage issue #${existing}.`);
  } else if (totalActionable > 0) {
    const url = gh(['issue', 'create', '--repo', TRIAGE_REPO, '--title', title, '--body-file', bodyFile, '--label', 'security-triage']).trim();
    console.log(`surfaceSecurityFindings: filed ${url}`);
  } else {
    console.log('surfaceSecurityFindings: nothing actionable and no existing issue; nothing to do.');
  }
}

main().catch((error) => {
  console.error('surfaceSecurityFindings failed:', error?.message || error);
  process.exit(1);
});
