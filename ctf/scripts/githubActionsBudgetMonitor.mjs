#!/usr/bin/env node

import fs from "node:fs";

const API_BASE_URL = "https://api.github.com";
const API_VERSION = "2022-11-28";

function bytesToMegabytes(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function bytesToGigabytes(bytes) {
  return Number((bytes / (1024 * 1024 * 1024)).toFixed(3));
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

  if (unit === "gb") {
    return `${value.toLocaleString()} GB`;
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

async function githubRequest(path, token) {
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
    throw new Error(`GitHub API ${path} failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function collectOrgUsage({ owner, token, budgets, degradedReasons }) {
  const actionsBilling = await githubRequest(`/orgs/${owner}/settings/billing/actions`, token);
  const sharedStorage = await githubRequest(`/orgs/${owner}/settings/billing/shared-storage`, token);

  let cacheUsage = null;
  try {
    cacheUsage = await githubRequest(`/orgs/${owner}/actions/cache/usage`, token);
  } catch (error) {
    degradedReasons.push(`cache-usage-unavailable:${error.message}`);
  }

  const minutesUsed = Number(actionsBilling.total_minutes_used ?? actionsBilling.minutes_used ?? 0);

  const sharedStorageBytes = Number(
    sharedStorage.estimated_storage_for_month ?? sharedStorage.estimated_paid_storage_for_month ?? 0,
  );

  const cacheBytes = cacheUsage ? Number(cacheUsage.active_caches_size_in_bytes ?? 0) : null;
  const artifactBytes = cacheBytes === null ? null : Math.max(sharedStorageBytes - cacheBytes, 0);

  return {
    source: "org",
    minutesUsed,
    minutesBudget: Number(actionsBilling.included_minutes ?? budgets.minutes),
    artifactStorageMbUsed: artifactBytes === null ? null : bytesToMegabytes(artifactBytes),
    artifactStorageMbBudget: budgets.artifactStorageMb,
    cacheStorageGbUsed: cacheBytes === null ? null : bytesToGigabytes(cacheBytes),
    cacheStorageGbBudget: budgets.cacheStorageGb,
    notes: [
      "artifact storage is estimated from shared storage minus cache usage when org cache endpoint is available",
    ],
  };
}

async function collectRepoFallbackUsage({ owner, repository, token, budgets }) {
  const cacheUsage = await githubRequest(`/repos/${owner}/${repository}/actions/cache/usage`, token);
  const artifacts = await githubRequest(`/repos/${owner}/${repository}/actions/artifacts?per_page=100`, token);

  const artifactTotalBytes = Array.isArray(artifacts.artifacts)
    ? artifacts.artifacts.reduce((sum, artifact) => sum + Number(artifact.size_in_bytes ?? 0), 0)
    : 0;

  return {
    source: "repo-fallback",
    minutesUsed: null,
    minutesBudget: budgets.minutes,
    artifactStorageMbUsed: bytesToMegabytes(artifactTotalBytes),
    artifactStorageMbBudget: budgets.artifactStorageMb,
    cacheStorageGbUsed: bytesToGigabytes(Number(cacheUsage.active_caches_size_in_bytes ?? 0)),
    cacheStorageGbBudget: budgets.cacheStorageGb,
    notes: [
      "minutes unavailable in repo fallback mode",
      "artifact storage reflects first 100 artifacts for this repository and is an estimate",
    ],
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
  lines.push(
    `| Cache storage | ${formatUsageValue(usage.cacheStorageGbUsed, "gb")} | ${formatUsageValue(usage.cacheStorageGbBudget, "gb")} | ${classes.cache.percentUsed ?? "unknown"}% | ${classes.cache.level} |`,
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
    cacheStorageGb: Number(process.env.GITHUB_ACTIONS_BUDGET_CACHE_GB ?? "10"),
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
      cacheStorageGbUsed: null,
      cacheStorageGbBudget: budgets.cacheStorageGb,
      notes: ["No token available for GitHub API billing endpoints."],
    };
  } else if (scope === "org") {
    try {
      usage = await collectOrgUsage({ owner, token, budgets, degradedReasons });
    } catch (error) {
      degradedReasons.push(`org-billing-unavailable:${error.message}`);
      if (!repository) {
        usage = {
          source: "none",
          minutesUsed: null,
          minutesBudget: budgets.minutes,
          artifactStorageMbUsed: null,
          artifactStorageMbBudget: budgets.artifactStorageMb,
          cacheStorageGbUsed: null,
          cacheStorageGbBudget: budgets.cacheStorageGb,
          notes: ["Repository context unavailable; repo fallback could not run."],
        };
      } else {
        usage = await collectRepoFallbackUsage({ owner, repository, token, budgets });
      }
    }
  } else {
    if (!repository) {
      throw new Error("Repository fallback mode requires GITHUB_REPOSITORY context.");
    }
    usage = await collectRepoFallbackUsage({ owner, repository, token, budgets });
  }

  const classes = {
    minutes: classifyUsage(usage.minutesUsed, usage.minutesBudget, thresholds),
    artifacts: classifyUsage(usage.artifactStorageMbUsed, usage.artifactStorageMbBudget, thresholds),
    cache: classifyUsage(usage.cacheStorageGbUsed, usage.cacheStorageGbBudget, thresholds),
  };

  const status = resolveOverallStatus(
    [classes.minutes.level, classes.artifacts.level, classes.cache.level],
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
