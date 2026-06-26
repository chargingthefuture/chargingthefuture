#!/usr/bin/env node

import fs from "node:fs";

const API_BASE_URL = "https://api.github.com";
const API_VERSION = "2022-11-28";

function bytesToMegabytes(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function parseThresholds(value) {
  const fallback = [60, 80, 90];
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
    .sort((left, right) => left - right);

  if (parsed.length !== 3) {
    return fallback;
  }

  return parsed;
}

function classifyUsage(used, budget, thresholds) {
  if (used === null || used === undefined || budget <= 0) {
    return {
      level: "unknown",
      percentUsed: null,
    };
  }

  const percentUsed = Number(((used / budget) * 100).toFixed(2));
  const [warningThreshold, criticalThreshold, blockedThreshold] = thresholds;

  let level = "ok";
  if (percentUsed >= blockedThreshold) {
    level = "blocked";
  } else if (percentUsed >= criticalThreshold) {
    level = "critical";
  } else if (percentUsed >= warningThreshold) {
    level = "warning";
  }

  return { level, percentUsed };
}

function formatUsageValue(value, unit) {
  if (value === null || value === undefined) {
    return "unknown";
  }

  if (unit === "minutes") {
    return `${Math.round(value).toLocaleString()} min`;
  }

  if (unit === "mb") {
    return `${value.toLocaleString()} MB`;
  }

  return `${value}`;
}

function statusPriority(status) {
  const priorities = {
    ok: 1,
    warning: 2,
    critical: 3,
    blocked: 4,
    "degraded-auth": 5,
  };
  return priorities[status] ?? 0;
}

function toStepOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized.includes("\n")) {
    const delimiter = `EOF_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    fs.appendFileSync(outputPath, `${name}<<${delimiter}\n${serialized}\n${delimiter}\n`, "utf8");
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${serialized}\n`, "utf8");
}

function appendStepSummary(content) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  fs.appendFileSync(summaryPath, `${content}\n`, "utf8");
}

async function githubRequestWithResponse(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "ctf-github-actions-budget-monitor",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub API ${path} failed (${response.status}): ${body}`);
    error.status = response.status;
    throw error;
  }

  const json = await response.json();
  return { json, response };
}

async function githubRequest(path, token) {
  const { json } = await githubRequestWithResponse(path, token);
  return json;
}

// Standard GitHub-hosted runner minute multipliers (billed minutes per real
// minute). Linux is billed at 1x, Windows at 2x, macOS at 10x.
// https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions#minute-multipliers
const RUNNER_OS_MULTIPLIERS = {
  UBUNTU: 1,
  LINUX: 1,
  WINDOWS: 2,
  MACOS: 10,
};

const MINUTES_PAGE_CAP = 10; // up to ~1000 runs (per_page=100)

function firstOfCurrentUtcMonth(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function billedMinutesFromTiming(timing) {
  // timing.billable is a map of runner OS -> { total_ms, jobs, job_runs[] }.
  // GitHub bills each job's run time rounded up to the next whole minute, then
  // applies the OS multiplier. Per-job ms is not reliably present for every
  // run shape, so we approximate per-OS: round that OS's total_ms up to whole
  // minutes, then multiply by the OS rate. This matches GitHub exactly when an
  // OS ran a single job; when several jobs ran on the same OS their individual
  // round-ups can only add a little, so this is a close lower-bound estimate.
  const billable = timing && typeof timing.billable === "object" ? timing.billable : null;
  if (!billable) {
    return 0;
  }

  let minutes = 0;
  for (const [os, entry] of Object.entries(billable)) {
    const totalMs = Number(entry?.total_ms ?? 0);
    if (!Number.isFinite(totalMs) || totalMs <= 0) {
      continue;
    }
    const multiplier = RUNNER_OS_MULTIPLIERS[os.toUpperCase()] ?? 1;
    minutes += Math.ceil(totalMs / 60000) * multiplier;
  }
  return minutes;
}

// Compute billed Actions minutes for the current UTC billing month from this
// repo's workflow-run timing, using only repo-scoped endpoints the token can
// already reach. Returns { minutesUsed, capped }: minutesUsed is null when no
// run timing could be obtained at all (caller keeps the old null + note then).
// Throws only on a genuine auth failure (401/403) so the caller can record a
// real degraded reason.
async function computeRepoMinutesUsed({ owner, repository, token }) {
  const since = firstOfCurrentUtcMonth();
  let page = 1;
  let capped = false;
  const runIds = [];

  while (page <= MINUTES_PAGE_CAP) {
    // created=>=YYYY-MM-01 limits the listing to this month's runs.
    const path =
      `/repos/${owner}/${repository}/actions/runs` +
      `?created=%3E%3D${since}&per_page=100&page=${page}`;
    let payload;
    let response;
    try {
      ({ json: payload, response } = await githubRequestWithResponse(path, token));
    } catch (error) {
      // A 401/403 on the runs API is a genuine auth failure — propagate so the
      // caller records a degraded reason. Any other failure on the run listing
      // means we cannot compute minutes; treat as "no data" (null) and stop.
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
      return { minutesUsed: null, capped };
    }

    const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
    for (const run of runs) {
      // Skip runs still in progress — their billable time is not final yet.
      if (run.status !== "completed") {
        continue;
      }
      if (run.id !== undefined && run.id !== null) {
        runIds.push(run.id);
      }
    }

    const linkHeader = response.headers.get("link") || "";
    const hasNext = /\brel="next"/.test(linkHeader);
    if (!hasNext || runs.length === 0) {
      break;
    }
    page += 1;
    if (page > MINUTES_PAGE_CAP) {
      // There were more pages than the cap allows; the total is a lower bound.
      capped = true;
    }
  }

  if (runIds.length === 0) {
    return { minutesUsed: null, capped };
  }

  let totalMinutes = 0;
  let timingsObtained = 0;
  for (const runId of runIds) {
    try {
      const timing = await githubRequest(
        `/repos/${owner}/${repository}/actions/runs/${runId}/timing`,
        token,
      );
      totalMinutes += billedMinutesFromTiming(timing);
      timingsObtained += 1;
    } catch (error) {
      // A genuine auth failure on the timing API is still worth surfacing.
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
      // Otherwise skip this run's timing and keep going — one failed call must
      // not abort the whole monitor.
    }
  }

  if (timingsObtained === 0) {
    return { minutesUsed: null, capped };
  }

  return { minutesUsed: totalMinutes, capped };
}

async function collectOrgUsage({ owner, token, budgets }) {
  const actionsBilling = await githubRequest(`/orgs/${owner}/settings/billing/actions`, token);
  const sharedStorage = await githubRequest(`/orgs/${owner}/settings/billing/shared-storage`, token);

  const minutesUsed = Number(actionsBilling.total_minutes_used ?? actionsBilling.minutes_used ?? 0);

  const sharedStorageBytes = Number(
    sharedStorage.estimated_storage_for_month ?? sharedStorage.estimated_paid_storage_for_month ?? 0,
  );

  return {
    source: "org",
    minutesUsed,
    minutesBudget: Number(actionsBilling.included_minutes ?? budgets.minutes),
    artifactStorageMbUsed: bytesToMegabytes(sharedStorageBytes),
    artifactStorageMbBudget: budgets.artifactStorageMb,
    notes: [
      "artifact storage is estimated from org shared storage usage for the month",
    ],
  };
}

async function collectRepoFallbackUsage({ owner, repository, token, budgets, degradedReasons }) {
  const artifacts = await githubRequest(`/repos/${owner}/${repository}/actions/artifacts?per_page=100`, token);

  const artifactTotalBytes = Array.isArray(artifacts.artifacts)
    ? artifacts.artifacts.reduce((sum, artifact) => sum + Number(artifact.size_in_bytes ?? 0), 0)
    : 0;

  // Minutes are not available from the org billing endpoint for this account,
  // so compute them from this repo's workflow-run billable time for the current
  // month. A genuine auth failure (401/403) on the runs/timing API is recorded
  // as a real degraded reason; any other problem just leaves minutes null.
  let minutesUsed = null;
  let minutesCapped = false;
  try {
    const computed = await computeRepoMinutesUsed({ owner, repository, token });
    minutesUsed = computed.minutesUsed;
    minutesCapped = computed.capped;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      degradedReasons.push(`runs-timing-auth-unavailable:${error.message}`);
    }
    minutesUsed = null;
  }

  const notes = [
    "artifact storage reflects first 100 artifacts for this repository and is an estimate",
  ];

  if (minutesUsed === null) {
    notes.unshift("minutes unavailable in repo fallback mode (no obtainable workflow-run timing)");
  } else {
    notes.unshift(
      "minutes computed from this repo's workflow-run billable time for the current month " +
        "(repo-scoped estimate; account-level usage may include other repositories). " +
        "Per OS, total billable ms is rounded up to whole minutes then multiplied by the OS rate " +
        "(Linux 1x, Windows 2x, macOS 10x).",
    );
    if (minutesCapped) {
      notes.push(
        `minutes is a lower-bound estimate: more than ${MINUTES_PAGE_CAP} pages of runs exist this month and were capped`,
      );
    }
  }

  return {
    source: "repo-fallback",
    minutesUsed,
    minutesBudget: budgets.minutes,
    artifactStorageMbUsed: bytesToMegabytes(artifactTotalBytes),
    artifactStorageMbBudget: budgets.artifactStorageMb,
    notes,
  };
}

function resolveOverallStatus(metricStatuses, degradedReasons) {
  let overall = "ok";
  for (const status of metricStatuses) {
    if (statusPriority(status) > statusPriority(overall)) {
      overall = status;
    }
  }

  if (degradedReasons.length > 0) {
    return "degraded-auth";
  }

  return overall;
}

function canEnforceBlocking({ status, usageSource, degradedReasons }) {
  return status === "blocked" && usageSource === "org" && degradedReasons.length === 0;
}

function buildSummaryMarkdown({
  status,
  scope,
  owner,
  repository,
  thresholds,
  usage,
  classes,
  degradedReasons,
  notes,
  generatedAt,
}) {
  const lines = [];

  lines.push("## GitHub Actions Budget Monitor");
  lines.push("");
  lines.push(`- Status: **${status}**`);
  lines.push(`- Scope: **${scope}**`);
  lines.push(`- Owner: **${owner}**`);
  if (repository) {
    lines.push(`- Repository: **${repository}**`);
  }
  lines.push(`- Thresholds: **${thresholds.join("/")}%** (warning/critical/blocked)`);
  lines.push("");
  lines.push("| Metric | Used | Budget | Percent | Level |");
  lines.push("|---|---:|---:|---:|---|");
  lines.push(
    `| Minutes | ${formatUsageValue(usage.minutesUsed, "minutes")} | ${formatUsageValue(usage.minutesBudget, "minutes")} | ${classes.minutes.percentUsed ?? "unknown"}% | ${classes.minutes.level} |`,
  );
  lines.push(
    `| Artifact storage | ${formatUsageValue(usage.artifactStorageMbUsed, "mb")} | ${formatUsageValue(usage.artifactStorageMbBudget, "mb")} | ${classes.artifacts.percentUsed ?? "unknown"}% | ${classes.artifacts.level} |`,
  );

  if (degradedReasons.length > 0) {
    lines.push("");
    lines.push("### Degraded/Auth Notes");
    for (const reason of degradedReasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (notes.length > 0) {
    lines.push("");
    lines.push("### Data Notes");
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  lines.push(`Generated at: ${generatedAt}`);
  return lines.join("\n");
}

async function main() {
  const [ownerFromRepo, repository] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");
  const owner = process.env.GITHUB_ACTIONS_MONITOR_OWNER || ownerFromRepo;

  if (!owner) {
    throw new Error("Missing owner context. Set GITHUB_ACTIONS_MONITOR_OWNER or GITHUB_REPOSITORY.");
  }

  const scope = process.env.GITHUB_ACTIONS_MONITOR_SCOPE ?? "org";
  const thresholds = parseThresholds(process.env.GITHUB_ACTIONS_BUDGET_THRESHOLDS);
  const generatedAt = new Date().toISOString();

  const budgets = {
    minutes: Number(process.env.GITHUB_ACTIONS_BUDGET_MINUTES ?? "2000"),
    artifactStorageMb: Number(process.env.GITHUB_ACTIONS_BUDGET_ARTIFACT_MB ?? "500"),
  };

  const degradedReasons = [];
  const token = process.env.GITHUB_ACTIONS_MONITOR_TOKEN;

  let usage;
  if (!token) {
    degradedReasons.push("missing-monitor-token");
    usage = {
      source: "none",
      minutesUsed: null,
      minutesBudget: budgets.minutes,
      artifactStorageMbUsed: null,
      artifactStorageMbBudget: budgets.artifactStorageMb,
      notes: ["No token available for GitHub API billing endpoints."],
    };
  } else if (scope === "org") {
    try {
      usage = await collectOrgUsage({ owner, token, budgets });
    } catch (error) {
      if (!repository) {
        // No repo context to fall back to — the org billing failure is the only
        // signal we have, so it remains a genuine degraded reason.
        degradedReasons.push(`org-billing-unavailable:${error.message}`);
        usage = {
          source: "none",
          minutesUsed: null,
          minutesBudget: budgets.minutes,
          artifactStorageMbUsed: null,
          artifactStorageMbBudget: budgets.artifactStorageMb,
          notes: ["Repository context unavailable; repo fallback could not run."],
        };
      } else {
        // The org billing endpoint 404s for personal accounts / accounts on the
        // new billing platform. That is expected here and is NOT an auth
        // failure: we obtain minutes another way (repo-scoped run timing), so
        // record it as an informational note rather than a degraded reason —
        // the status then reflects the real budget levels instead of a
        // perpetual degraded-auth.
        usage = await collectRepoFallbackUsage({ owner, repository, token, budgets, degradedReasons });
        usage.notes = [
          "org billing API unavailable for this account; using repo-scoped run timing for minutes",
          ...(usage.notes ?? []),
        ];
      }
    }
  } else {
    if (!repository) {
      throw new Error("Repository fallback mode requires GITHUB_REPOSITORY context.");
    }
    usage = await collectRepoFallbackUsage({ owner, repository, token, budgets, degradedReasons });
  }

  const classes = {
    minutes: classifyUsage(usage.minutesUsed, usage.minutesBudget, thresholds),
    artifacts: classifyUsage(usage.artifactStorageMbUsed, usage.artifactStorageMbBudget, thresholds),
  };

  const status = resolveOverallStatus(
    [classes.minutes.level, classes.artifacts.level],
    degradedReasons,
  );

  const enforceBlock = canEnforceBlocking({
    status,
    usageSource: usage.source,
    degradedReasons,
  });

  const result = {
    generatedAt,
    status,
    scope,
    owner,
    repository,
    thresholds,
    budgets,
    usage,
    classes,
    degradedReasons,
    enforceBlock,
  };

  const summaryMarkdown = buildSummaryMarkdown({
    status,
    scope,
    owner,
    repository,
    thresholds,
    usage,
    classes,
    degradedReasons,
    notes: usage.notes ?? [],
    generatedAt,
  });

  const outputPath = process.env.GITHUB_ACTIONS_BUDGET_OUTPUT_PATH;
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify({ ...result, summaryMarkdown }, null, 2), "utf8");
  }

  toStepOutput("status", status);
  toStepOutput("enforce_block", enforceBlock ? "true" : "false");
  toStepOutput("scope", scope);
  toStepOutput("owner", owner);
  toStepOutput("repository", repository || "");
  toStepOutput("json", JSON.stringify(result));

  appendStepSummary(summaryMarkdown);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
