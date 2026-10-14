# Audit Checklist: Metrics & Data Integrity

## Overview

This checklist is used by the **Metrics & Data Integrity Agent** to verify every metric change before deployment. It ensures that changes to economic data affecting 5M vulnerable users are correct, tested, and safe.

**Who completes this**: Metrics Agent (automated) + You (approver)
**When**: Automatically triggered for any metric change; must be 100% complete before deployment
**Blocking**: PR cannot merge until all items are checked and approved

---

## Pre-Audit Verification (Agent Auto-Checks)

### Change Detection
- [ ] **Change identified**: Metrics agent detected a change to `canonical_metrics`, ETL pipeline, or calculation logic
- [ ] **Trigger rule matched**: Change matches one of the automatic trigger rules (schema, new metric, calculation, ETL, economic flow, permission)
- [ ] **PR linked**: GitHub issue linked to PR with audit checklist
- [ ] **Scope documented**: Change description explains what metric is affected and why

### Change Classification
- [ ] **Change type identified**: Schema change / New metric / Calculation logic / ETL pipeline / Economic flow / Permission change
- [ ] **User impact assessed**: How many users affected? (e.g., "5M users' GDP rankings")
- [ ] **Economic impact assessed**: Does this affect payouts, rankings, or economic data? (YES/NO)
- [ ] **External auditor required**: Is external auditor sign-off needed? (Check: user-safety impact, payout changes, policy impact)

---

## Metric Specification Review (Agent + You)

### Documentation
- [ ] **Metric definition exists**: Metric is documented in `docs/metrics/` with clear specification
- [ ] **Specification matches code**: Code implementation matches written specification exactly
- [ ] **Calculation logic documented**: Formula/algorithm is written in plain English + pseudocode
- [ ] **Data sources identified**: All input data sources are documented (tables, APIs, external services)
- [ ] **Aggregation rules clear**: How individual values are aggregated (sum, average, weighted, etc.) is documented
- [ ] **Rounding rules documented**: If rounding is applied, the rule is explicit (e.g., "round to 2 decimal places")

### Correctness Verification
- [ ] **Calculation logic reviewed**: Independent code review confirms logic matches specification
- [ ] **Edge cases identified**: Code handles edge cases (zero division, null values, extreme values)
- [ ] **No silent failures**: Code fails loudly (exceptions, alerts) rather than silently (returning wrong values)
- [ ] **Test coverage exists**: Unit tests exist for the metric calculation

---

## Synthetic Data Testing (Agent Auto-Runs)

### Test Scenario 1: Normal Distribution
- [ ] **Setup**: 5M users with normal income/activity distribution
- [ ] **Success criteria met**: All metrics calculate without error
- [ ] **Range check**: Metric values within expected range (e.g., GDP $2.5B–$2.6B)
- [ ] **No null/NaN**: No null or NaN values in critical fields
- [ ] **Aggregation accuracy**: Aggregation matches expected totals (within ±0.001%)
- [ ] **Time-series continuity**: No gaps or duplicates in time-series data

### Test Scenario 2: Extreme Values
- [ ] **Setup**: Mix of extreme values (0 income, 99th percentile, 0 activity, 100+ activity)
- [ ] **No overflow/underflow**: Metric calculations don't overflow or underflow
- [ ] **No division by zero**: Code handles zero denominators safely
- [ ] **Ranking correctness**: Ranking/sorting handles ties and edge cases correctly
- [ ] **Percentile accuracy**: 1st, 50th, 99th percentiles calculated correctly
- [ ] **Extreme value handling**: Metric values correct for extreme inputs

### Test Scenario 3: Temporal Edge Cases
- [ ] **Setup**: 4-year period including leap year, timezone boundaries, DST transitions
- [ ] **Leap year handling**: February 29 exists; no duplicate data
- [ ] **Timezone boundaries**: UTC-12 to UTC+12 conversions accurate; no data loss
- [ ] **DST transitions**: Spring forward and fall back handled (no duplicate/missing hours)
- [ ] **Year boundaries**: Dec 31 → Jan 1 transitions correct; no gaps
- [ ] **Time-series continuity**: No gaps or duplicates across all temporal edge cases

### Test Scenario 4: Rounding Edge Cases
- [ ] **Setup**: Values that round up/down; aggregation rounding compounding
- [ ] **Individual rounding**: Rounding variance <0.01% per user
- [ ] **Aggregation rounding**: Aggregation rounding variance <0.01% across 5M users
- [ ] **Cumulative error**: Cumulative rounding error within tolerance (<0.01%)
- [ ] **Rounding consistency**: Same input produces same output (deterministic)
- [ ] **Sum vs. round-of-sum**: Difference between "sum then round" vs. "round then sum" acceptable (<0.01%)

### Test Scenario 5: Permission & Access Control
- [ ] **Setup**: Users see own data; admins see all; analysts see anonymized cohorts
- [ ] **No data leakage**: User cannot access other users' economic data
- [ ] **Access control enforced**: Permission checks working correctly
- [ ] **Admin view correct**: Admin sees correct aggregated data for all users
- [ ] **Analyst anonymization**: Analyst view is properly anonymized (no PII)
- [ ] **Role-based accuracy**: Each role sees correct data for their role

### Test Scenario 6: Failover & Data Recovery
- [ ] **Setup**: Data source down; fallback metric works; late-arriving data backfill
- [ ] **Fallback metric accurate**: When primary data source fails, fallback metric is accurate
- [ ] **Graceful degradation**: System degrades gracefully (doesn't crash or return wrong data)
- [ ] **Backfill logic**: Late-arriving data backfill preserves correctness
- [ ] **No data loss**: No data lost during failover
- [ ] **Recovery validation**: System recovers correctly when primary source comes back online

### Overall Synthetic Test Results
- [ ] **All 6 scenarios pass**: All test scenarios pass (PASS/FAIL for each)
- [ ] **Metric drift <0.01%**: Drift between baseline and new metric <0.01% across all scenarios
- [ ] **No null/NaN in critical fields**: No null or NaN values detected in critical metric fields
- [ ] **No calculation errors**: No overflow, underflow, division-by-zero, or other calculation errors
- [ ] **Test evidence attached**: Synthetic test output/logs attached to GitHub issue

---

## Data Pipeline Validation (Agent + You)

### End-to-End Testing
- [ ] **Source data verified**: Input data is correct and complete
- [ ] **Transform logic tested**: ETL transformation produces expected output
- [ ] **Aggregation tested**: Aggregation logic produces expected totals
- [ ] **User view tested**: User sees correct data in UI/API
- [ ] **No data loss**: No records lost during pipeline
- [ ] **Latency acceptable**: Data latency meets SLA (e.g., <24 hours for daily metrics)

### Data Quality
- [ ] **Completeness**: All expected records present (no missing data)
- [ ] **Accuracy**: Data matches source (no corruption or transformation errors)
- [ ] **Consistency**: Data consistent across all views (UI, API, reports)
- [ ] **Timeliness**: Data updated on schedule (no out-of-date data)

---

## Downstream Impact Assessment (You)

### User Impact
- [ ] **User count affected**: Number of users affected by this change documented
- [ ] **Economic impact**: Does this affect payouts, rankings, or economic data? (YES/NO)
- [ ] **Payout impact**: If payouts affected, magnitude of impact documented (e.g., "0.1% of users see <1% payout change")
- [ ] **Ranking impact**: If rankings affected, number of users with rank changes documented

### Policy & Compliance Impact
- [ ] **Policy impact**: Does this change affect any policy decisions? (e.g., "affects GDP-based policy")
- [ ] **Compliance risk**: Any legal or compliance risk? (YES/NO)
- [ ] **Audit trail**: Change is logged in immutable audit trail
- [ ] **External auditor needed**: External auditor sign-off required? (YES/NO based on impact)

---

## Approval & Sign-Off (You)

### Critical Findings Resolution
- [ ] **Critical findings identified**: Any Critical findings from audit listed
- [ ] **All Critical findings fixed**: Every Critical finding has a fix in the code
- [ ] **Fixes verified**: Fixes verified via independent code review + synthetic re-run
- [ ] **Test coverage**: Test case added to prevent regression
- [ ] **Fix evidence attached**: Code changes + test cases attached to GitHub issue

### High Findings Mitigation
- [ ] **High findings identified**: Any High findings from audit listed
- [ ] **Mitigation implemented**: Every High finding has a documented mitigation (NOT "we'll fix next sprint")
- [ ] **Mitigation examples**:
  - [ ] Real-time alerting configured (pages on-call if drift >threshold)
  - [ ] Automatic rollback configured (reverts deployment if drift >threshold)
  - [ ] Feature flag configured (disables affected metric until fix ships)
- [ ] **Mitigation verified**: Mitigation is already implemented and working
- [ ] **Mitigation evidence attached**: Configuration/code for mitigation attached to GitHub issue

### External Auditor Sign-Off (If Required)
- [ ] **External auditor assigned**: Auditor assigned to review this change
- [ ] **Auditor review complete**: Auditor has reviewed metric change and findings
- [ ] **Auditor approval obtained**: Auditor has signed off on deployment
- [ ] **Auditor sign-off attached**: Auditor approval document attached to GitHub issue

### Final Approval
- [ ] **You approve**: You (solo) approve the audit and deployment
- [ ] **Audit checklist complete**: All items above are checked
- [ ] **Blocking criteria met**: All blocking criteria are satisfied (see below)
- [ ] **Ready for deployment**: Metric change is ready to merge and deploy

---

## Blocking Criteria (Must All Be Met)

Before this metric change can be deployed, **all of the following must be true**:

- [ ] ✅ **All Critical findings are resolved** (fixed + verified + tested)
- [ ] ✅ **All High findings have documented mitigation** (already implemented, not planned)
- [ ] ✅ **Synthetic tests pass** with <0.01% metric drift across all 6 scenarios
- [ ] ✅ **No null/NaN values** in critical metric fields
- [ ] ✅ **External auditor signed off** (if user-safety impact, payout changes, or policy impact)
- [ ] ✅ **This audit checklist is 100% complete** (all items checked)
- [ ] ✅ **Audit log entry created** (immutable record signed and stored)
- [ ] ✅ **You approve** (final human approval before merge)

**If any blocking criterion is not met, the PR cannot merge.**

---

## Post-Deployment Monitoring

### Real-Time Monitoring
- [ ] **Metric drift monitoring active**: System monitoring for metric drift >0.01%
- [ ] **Null/NaN monitoring active**: System monitoring for null/NaN values in critical fields
- [ ] **Permission leakage monitoring active**: System monitoring for unauthorized data access
- [ ] **On-call alert configured**: On-call engineer paged if any of the above detected

### Incident Response
- [ ] **Revert protocol ready**: Revert procedure documented and tested
- [ ] **Rollback tested**: Rollback to previous metric definition tested and verified
- [ ] **Incident response plan**: Steps to take if metric drift detected documented

---

## Audit Log Entry

**This section is auto-populated by the Metrics Agent**

```json
{
  "audit\_id": "AUDIT-2026-03-26-001",
  "timestamp": "2026-03-26T14:32:00Z",
  "metric\_changed": "[METRIC NAME]",
  "change\_type": "[CHANGE TYPE]",
  "trigger\_rule": "[TRIGGER RULE]",
  "pr\_url": "[GITHUB PR URL]",
  "audit\_participants": ["you", "external\_auditor (if applicable)"],
  "checklist\_completion": "100%",
  "synthetic\_test\_results": {
    "normal\_distribution": "PASS/FAIL",
    "extreme\_values": "PASS/FAIL",
    "temporal\_edge\_cases": "PASS/FAIL",
    "rounding\_edge\_cases": "PASS/FAIL",
    "permission\_access\_control": "PASS/FAIL",
    "failover\_recovery": "PASS/FAIL"
  },
  "findings": {
    "critical": [],
    "high": [],
    "medium": [],
    "low": []
  },
  "mitigation\_status": "All High findings have implemented mitigation",
  "external\_auditor\_approval": "approved / not\_required",
  "deployment\_approval": "approved\_by\_[YOU]",
  "signed\_by": "[YOU]",
  "signed\_timestamp": "2026-03-26T14:32:00Z",
  "immutable\_hash": "sha256:[HASH]",
  "notes": "[ANY ADDITIONAL NOTES]"
}
