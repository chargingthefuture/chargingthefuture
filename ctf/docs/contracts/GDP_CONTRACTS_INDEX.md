# GDP Contracts Index

This index groups the Gross Domestic Product (GDP) plugin planning contracts for review, approval, and PR evidence.

## Core GDP Contracts

1. Profile and deletion contract:
   - `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md`
2. Command contracts:
   - `ctf/docs/contracts/GDP_PLUGIN_COMMAND_CONTRACTS.yaml`
3. Access policy contracts:
   - `ctf/docs/contracts/GDP_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
4. Audit contracts:
   - `ctf/docs/contracts/GDP_PLUGIN_AUDIT_CONTRACTS.yaml`

## Related Inventory Artifacts

1. Feature inventory:
   - `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md`
2. Build Checklist (in the feature inventory above):
   - `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md`

## Template and Rule References

1. Profile/deletion template:
   - `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`
2. Command template:
   - `.claude/rules/201-plugin-command-schema-template.mdc`
3. Access policy template:
   - `.claude/rules/202-plugin-access-policy-schema-template.mdc`
4. Audit template:
   - `.claude/rules/203-plugin-audit-schema-template.mdc`
5. Canonical metric registry rules:
   - `.claude/rules/121-canonical-metric-registry-rules.mdc`
6. Schema drift predeployment rules:
   - `.claude/rules/122-schema-drift-predeployment-rules.mdc`

## Review Sign-Off Checklist

- [ ] Product approved GDP transparency scope and language.
- [ ] Engineering approved command, policy, and audit contracts.
- [ ] Compliance/privacy approved deletion and retention behavior.
- [ ] Metrics owners approved canonical GDP metric definitions.
- [ ] Parity plan and deferrals are captured in the rewrite checklist.
