# How to Use Your Team

| Agent                        | Best For                                           | Invocation                                                                                                                                                                                                                                                                                  | Key Triggers                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meta Orchestrator**        | Full team review before merge/deploy               | `@meta-orchestrator Run full review on this PR`                                                                                                                                                                                                                                             | All PRs before merge; all deployments                                                                                                                                                                                                                                                                            |
| **Architecture Standards**   | Code quality and maintainability                   | `@architecture-standards Review this code for standards`                                                                                                                                                                                                                                    | Code changes; refactoring                                                                                                                                                                                                                                                                                        |
| **Brand Voice**              | UI copy and documentation                          | `@brand-voice Check this copy for brand compliance`                                                                                                                                                                                                                                         | UI text changes; docs updates                                                                                                                                                                                                                                                                                    |
| **Compliance & Safety**      | Legal and safety validation                        | `@compliance-safety Validate compliance for this change`                                                                                                                                                                                                                                    | Feature releases; legal changes                                                                                                                                                                                                                                                                                  |
| **Design & Mockups** (deprecated) | Reference only — do not route work through it | Deprecated (owner decision, 2026-06-17): production is the source of truth and the `design/` submodule and Replit design agent are reference only. Build UI from the design guide and shipped sibling screens per CLAUDE.md "Design Pass Gating"; see `design.agent.md` for history. | None — kept as history |
| **Deployment Topology**      | Deployment configuration                           | `@deployment-topology Check deployment config`                                                                                                                                                                                                                                              | Deployment changes; infrastructure updates                                                                                                                                                                                                                                                                       |
| **Environment & Auth**       | Secrets and environment setup                      | `@environment-auth Validate .env and secrets`                                                                                                                                                                                                                                               | Environment changes; auth provider updates                                                                                                                                                                                                                                                                       |
| **Metrics & Data Integrity** | Audit metric changes and economic data correctness | `@metrics-data-integrity Run Macro Audit on this metric change` or `@metrics-data-integrity Run synthetic economy test (5M users)` or `@metrics-data-integrity Check for metric drift in production` or `@metrics-data-integrity Verify Critical findings are resolved`                     | **AUTOMATIC**: Schema changes to `canonical_metrics`; new metric definitions; aggregation/rounding logic changes; ETL pipeline changes; changes affecting member credit grants or rankings. **MANUAL**: When you need to audit a metric before deployment; when you suspect metric drift; when reviewing audit findings. |
| **Monorepo Boundary**        | Cross-boundary violations                          | `@monorepo-boundary Check for boundary violations`                                                                                                                                                                                                                                          | Cross-module changes; dependency updates                                                                                                                                                                                                                                                                         |
| **Observability**            | Error monitoring and incidents                     | `@observability-incident Check Sentry integration`                                                                                                                                                                                                                                          | Error spikes; incident response; post-deployment monitoring                                                                                                                                                                                                                                                      |
| **Planning**                 | Task breakdown and implementation plans            | `@planning Plan this feature before we build it` (role file: `planning-agent.md`)                                                                                                                                                                                                           | Complex features; refactors; anything needing a plan first (flat ordered task lists, no phases — CLAUDE.md)                                                                                                                                                                                                      |
| **Plugin Lifecycle**         | Feature and plugin management                      | `@plugin-lifecycle Review plugin schema`                                                                                                                                                                                                                                                    | Plugin updates; feature lifecycle changes                                                                                                                                                                                                                                                                        |
| **Security & Dependency**    | Vulnerability scanning                             | `@security-dependency Scan for vulnerabilities`                                                                                                                                                                                                                                             | Dependency updates; security audits                                                                                                                                                                                                                                                                              |
| **Testing & Release**        | Test execution and CI/CD                           | `@testing-release Run all tests and validate release`                                                                                                                                                                                                                                       | Before merge; before production deploy                                                                                                                                                                                                                                                                           |

---

## Metrics & Data Integrity Agent: Detailed Usage Guide

### **When to Invoke (Automatic Triggers)**

The **Metrics & Data Integrity Agent** **automatically blocks** changes that affect economic data. You'll see a blocking GitHub issue with this checklist:

#### **Automatic Trigger Scenarios**

| Change Type                   | What Triggers Audit                                  | Example                                                    |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| **Schema changes**            | Any modification to `canonical_metrics` table/schema | Adding a field to `workforce_count` or `gdp_value`         |
| **New metrics**               | Adding a new metric definition                       | Creating `unemployment_rate` metric                        |
| **Calculation logic**         | Changes to aggregation, rounding, or formulas        | Modifying GDP calculation from sum to weighted average     |
| **ETL pipelines**             | Changes to data extraction, transformation, loading  | Modifying `workforce_etl.py` or data join logic            |
| **Economic flow changes**     | Anything affecting member credit grants or rankings          | Changing how individual income is calculated or aggregated |
| **Permission/access changes** | Changes to who sees what economic data               | Modifying dashboard access control for GDP data            |

**Result**: Metrics agent creates a **blocking GitHub issue** with an audit checklist. PR cannot merge until audit is complete and approved.

---

### **When to Invoke (Manual Triggers)**

Invoke the agent directly when you want to:

#### **1. Run a Full Macro Audit on a Metric Change**

```
@metrics-data-integrity Run Macro Audit on this metric change

Context: I'm changing the GDP calculation from sum to weighted average.
This affects 5M users' economic rankings. Please:
- Verify the calculation logic
- Run synthetic tests (normal, extreme, edge cases)
- Check for metric drift
- Report findings (Critical/High/Medium/Low)
- Block deployment until Critical findings resolved
```

**Agent will**:

- ✓ Review your change against the metric specification
- ✓ Run synthetic 5M-user economy simulation
- ✓ Report metric drift (must be <0.01%)
- ✓ Check for null/NaN values in critical fields
- ✓ Verify aggregation and rounding correctness
- ✓ Create audit checklist with findings
- ✓ Block merge until you approve

---

#### **2. Run Synthetic Economy Tests**

```
@metrics-data-integrity Run synthetic economy test (5M users)

Context: I want to validate my metric change before submitting for audit.
Please run the full synthetic test suite.
```

**Agent will**:

- ✓ Simulate 5M users with normal income/activity distribution
- ✓ Simulate extreme values (0 income, 99th percentile)
- ✓ Simulate temporal edge cases (leap year, timezone boundaries)
- ✓ Simulate rounding edge cases
- ✓ Report: metric drift, null/NaN values, aggregation correctness
- ✓ Pass/fail result with detailed metrics

---

#### **3. Check for Metric Drift in Production**

```
@metrics-data-integrity Check for metric drift in production

Context: I deployed a metric change 2 hours ago. I want to verify
there's no unexpected drift in the live data.
```

**Agent will**:

- ✓ Compare current metric values to baseline (pre-deployment)
- ✓ Calculate drift percentage
- ✓ Flag if drift >0.01% (Critical)
- ✓ If drift detected: trigger revert protocol
- ✓ Create incident if needed

---

#### **4. Verify Critical Findings Are Resolved**

```
@metrics-data-integrity Verify Critical findings are resolved

Context: The audit found 2 Critical findings. I've fixed them.
Please verify the fixes are correct before I deploy.
```

**Agent will**:

- ✓ Review your fix code
- ✓ Re-run synthetic tests with the fix applied
- ✓ Verify the specific failure is now impossible
- ✓ Check that test coverage exists for the fix
- ✓ Verify external auditor sign-off (if needed)
- ✓ Approve or flag remaining issues

---

#### **5. Create Audit Retrospective**

```
@metrics-data-integrity Create retrospective: Why did audit miss this?

Context: A Critical finding slipped through to production.
Please analyze why the audit missed it and update the audit process.
```

**Agent will**:

- ✓ Root cause analysis: Why did Macro Audit miss this?
- ✓ Recommend new synthetic scenario to catch it
- ✓ Update trigger rules (if needed)
- ✓ Update audit checklist with new line item
- ✓ Create task to implement the improvement

---

### **Workflow Example: Deploying a Metric Change**

Here's a real scenario from start to finish:

#### **Step 1: You Make a Change**

```
You modify: src/metrics/gdp-calculation.ts
Change: GDP calculation now uses weighted average instead of simple sum
```

#### **Step 2: Metrics Agent Detects It**

```
GitHub: PR created
Metrics Agent: Automatically triggered (change to canonical_metrics)
├─ Creates blocking issue: "Macro Audit Required: GDP Calculation Change"
├─ Assigns checklist:
│  ├─ [ ] Metric definition reviewed
│  ├─ [ ] Calculation logic verified
│  ├─ [ ] Synthetic tests run
│  ├─ [ ] Metric drift <0.01%
│  ├─ [ ] External auditor sign-off
│  └─ [ ] Deployment approval
└─ Blocks PR merge with: "Awaiting Macro Audit completion"
```

#### **Step 3: You Request Manual Audit**

```
You: @metrics-data-integrity Run Macro Audit on this metric change
Agent runs:
├─ Synthetic test (normal distribution): ✓ PASS
├─ Synthetic test (extreme values): ✓ PASS
├─ Synthetic test (rounding edge cases): ⚠️ FINDING
│  └─ "Weighted average rounding could lose 0.08% precision in edge cases"
├─ Metric drift: 0.003% ✓ PASS
└─ Report:
   ├─ Critical findings: 0
   ├─ High findings: 1 (rounding precision loss)
   ├─ Medium findings: 0
   └─ Low findings: 2 (documentation gaps)
```

#### **Step 4: You Address High Finding**

```
You: Add real-time alerting for rounding drift >0.05%
     Deploy alert threshold monitoring
Agent: Verifies mitigation
├─ Is alerting implemented? ✓ YES
├─ Is rollback configured? ✓ YES
├─ Is on-call engineer assigned? ✓ YES
└─ Mitigation qualifies for deployment ✓
```

#### **Step 5: You Request Approval**

```
You: @metrics-data-integrity Verify Critical findings are resolved
Agent:
├─ Critical findings: 0 ✓
├─ High findings: 1 (mitigation in place) ✓
├─ Synthetic tests: PASS ✓
└─ Ready for deployment ✓
```

#### **Step 6: Merge & Deploy**

```
You: Merge PR
Meta-Orchestrator: Runs full team review (Architecture, Security, Testing, etc.)
Testing-Release: Runs unit/integration tests
Deployment-Topology: Validates deployment config
You: Deploy to production
```

#### **Step 7: Post-Deployment Monitoring**

```
Observability Agent: Monitors for errors
Metrics Agent: Monitors for metric drift >0.01%
├─ 1 hour: drift 0.002% ✓ OK
├─ 2 hours: drift 0.001% ✓ OK
└─ 24 hours: drift 0.001% ✓ OK
Audit log: Records all findings, fixes, and approvals (immutable)
```

---

### **Blocking Behavior (What Stops Deployment)**

The Metrics Agent **blocks deployment** if:

| Condition                            | Status     | Resolution                                              |
| ------------------------------------ | ---------- | ------------------------------------------------------- |
| **Critical findings exist**          | 🛑 BLOCKED | Fix + re-verify all Critical findings                   |
| **High findings with NO mitigation** | 🛑 BLOCKED | Implement mitigation (alerting, rollback, feature flag) |
| **Synthetic tests fail**             | 🛑 BLOCKED | Fix code; re-run tests until PASS                       |
| **Metric drift >0.01%**              | 🛑 BLOCKED | Investigate; revert or hot-fix                          |
| **No external auditor sign-off**     | 🛑 BLOCKED | (if user-safety impact) Get auditor approval            |
| **Audit checklist incomplete**       | 🛑 BLOCKED | Complete all checklist items                            |

The agent **allows deployment** if:

- ✅ All Critical findings resolved + verified
- ✅ All High findings have documented mitigation (already implemented)
- ✅ Synthetic tests pass (<0.01% drift)
- ✅ External auditor signed off (if needed)
- ✅ Audit checklist complete
- ✅ You approve

---

### **Post-Deployment: Revert Protocol**

If metric drift >0.01% is detected **after deployment**:

```
Metrics Agent: Detects drift >0.01% in production
├─ Creates incident: "CRITICAL: Metric drift detected"
├─ Checks: Is metric affecting member credit grants? YES
├─ Checks: Can we hot-fix in <24hr? NO
├─ Action: IMMEDIATE REVERT
├─ Creates retrospective:
│  └─ "Why did Macro Audit miss this? Update synthetic tests."
└─ Escalates to Meta-Orchestrator for human review
```

---

### **Audit Log: What Gets Recorded**

Every audit creates an **immutable record**:

```json
{
  "timestamp": "2026-03-26T14:32:00Z",
  "metric_changed": "gdp_calculation",
  "trigger_rule": "calculation_logic_change",
  "audit_participants": ["you", "external_auditor"],
  "synthetic_test_results": {
    "normal_distribution": "PASS",
    "extreme_values": "PASS",
    "rounding_edge_cases": "FINDINGS"
  },
  "findings": {
    "critical": [],
    "high": [{ "id": "H001", "description": "rounding precision", "mitigation": "alerting" }],
    "medium": [],
    "low": [{ "id": "L001", "description": "docs gap" }]
  },
  "deployment_approval": "approved_by_you",
  "signed_by": "you",
  "immutable_hash": "sha256:abc123..."
}
```

This log is **searchable, auditable, and compliant** for incident response.

---

## Quick Reference Cheat Sheet

```
# Automatic (no invocation needed)
Any change to canonical_metrics → Metrics agent blocks + creates audit issue

# Manual invocations
@metrics-data-integrity Run Macro Audit on this metric change
@metrics-data-integrity Run synthetic economy test (5M users)
@metrics-data-integrity Check for metric drift in production
@metrics-data-integrity Verify Critical findings are resolved
@metrics-data-integrity Create retrospective: Why did audit miss this?

# Integration with other agents
Metrics Agent → Compliance-Safety (if user-safety impact)
Metrics Agent → Testing-Release (synthetic tests → unit tests → CI/CD)
Metrics Agent → Meta-Orchestrator (final approval + deployment gate)
```

---

## Key Takeaways

1. **Automatic blocking**: Any metric change is blocked until audit is complete
2. **Synthetic testing**: 5M-user economy simulations catch silent failures
3. **Immutable audit log**: Compliance, incident response, and legal discovery
4. **Clear escalation**: Critical findings → you → external auditor (if needed) → deployment
5. **Post-deployment monitoring**: Metric drift detection + revert protocol
6. **Retrospectives**: Learn from every audit to improve the process

This ensures **economic correctness for 5M vulnerable people** at every step.
