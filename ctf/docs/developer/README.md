# Developer Docs

Runbooks, plans, and feature inventories. Indexed by concept below — each
concept points to the one file that owns it (multi-file topics were
consolidated). Authoritative implementation lives in code; these docs cover
what code does not.

## Infrastructure & Services

- [FORMANCE.md](FORMANCE.md) — Formance ledger: runtime contract, bootstrap, backup/restore.
- [OLLAMA.md](OLLAMA.md) — Ollama model management on Render (baking models, sizing, failures).

## Architecture

- [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md) — authentication architecture.
- [economic-models-plugin-plan.md](economic-models-plugin-plan.md) — economic models plugin design.
- [EXTERNAL_LINK_FEATURE.md](EXTERNAL_LINK_FEATURE.md) — external link feature.

## PM & Performance

- [PM.md](PM.md) — feedback → matching → approval → implementation pipeline (MCP server + agents).
- [PERFORMANCE.md](PERFORMANCE.md) — performance budgets + manual benchmark runbook.

## Process & Quality

- [COMMIT_WORKFLOW.md](COMMIT_WORKFLOW.md) — commit conventions.
- [REVERT_PROTOCOL.md](REVERT_PROTOCOL.md) — revert + incident escalation protocol.
- [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md) — release/security audit checklist.
- [SYNTHETIC_TEST_LIBRARY.md](SYNTHETIC_TEST_LIBRARY.md) — synthetic test library.

## CI, Secrets & Ops Runbooks

- [GITHUB_ACTIONS_BILLING_TOKEN_RUNBOOK.md](GITHUB_ACTIONS_BILLING_TOKEN_RUNBOOK.md) — Actions billing token.
- [PRODUCT_UPDATE_PIPELINE_SECRETS_RUNBOOK.md](PRODUCT_UPDATE_PIPELINE_SECRETS_RUNBOOK.md) — product-update pipeline secrets.
- [MOCKUPS_SUBMODULE_SYNC_RUNBOOK.md](MOCKUPS_SUBMODULE_SYNC_RUNBOOK.md) — design/mockups submodule sync.

## Per-Plugin References (policy-governed, not consolidated)

- `ctf-plugin-feature-inventories/` — one authoritative inventory per plugin (see its README).
- `../contracts/` — per-plugin command/access/audit contracts.
