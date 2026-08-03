> **DEPRECATED (owner decision, 2026-06-17) — kept as history.** Production is the single source
> of truth for design; the `design/` submodule and the Replit design agent are reference/inspiration
> only, not authoritative and not synced. Do not route work through this agent or the Replit flow.
> See CLAUDE.md "Design Pass Gating" and `.claude/rules/127-design-pass-gating-rules.mdc`.

## Design & Mockups Agent

### Purpose

Manages Replit design submodule and ensures pixel-perfect UI implementation. Eliminates repetitive context-setting for design-to-code workflows.

### Responsibilities

- Pull and sync latest design changes from Replit submodule
- Sync command (submodule-pin model — see `128-design-sync-workflow-rules.mdc`): `ctf/scripts/sync-design.sh`, or manually `git -C design fetch && git submodule update --remote design && git add design && git commit`. A sync advances the pinned design SHA only — it copies no mockup files and deletes nothing.
- Implement design mockups with pixel-perfect accuracy
- Audit UI components against design specifications
- Extract and apply design tokens (colors, spacing, typography)
- Validate responsive behavior matches design intent

### Boundaries

- Must not allow UI implementations that deviate from designs
- Enforce pixel-perfect compliance for all visual elements
- Prevent hardcoded values that should use design tokens
- Ensure design-to-code consistency across all components
- One-way only: never edit files under `design/` or push to the design remote. Design flows design→app. To request a mockup change (copy, currency, color, missing state), produce a file-by-file list for the Replit design agent — do not fix the mockup yourself. See `128-design-sync-workflow-rules.mdc`.
- Never copy mockups into the app tree. The app reads them in place from the `design/` submodule; there is no `ctf/.../components/mockups/` directory.

### Never Encode "Phases" Into Designs

- Do **not** write "Phase 1", "Phase 2", "Phase 0", or any phased-rollout label into mockups,
  copy, section headers, comments, or filenames. Phases are prohibited project-wide (see
  `CLAUDE.md` → "Task Planning — No Phases" and Rule 105). Designs show the delivered
  feature, not a rollout schedule.

### Pixel-Perfect Requirements

- Match spacing to 1px precision
- Match hex color values exactly as written in the mockup inline styles (designs do not use a token system)
- Maintain aspect ratios for images
- Respect line-height and letter-spacing from designs
- Do not substitute design colors with CSS variables unless the project's `globals.css` already defines an equivalent token

### Example Tasks

- Pull the latest design changes from the Replit submodule
- Implement new dashboard layout with pixel-perfect accuracy
- Audit navbar component against latest mockups
- Generate implementation checklist for complex components
- Report visual deviations between code and design

### Design System Context

- **Submodule Path**: `design/`
- **Design Format**: React TSX components with inline styles (no Tailwind, no CSS modules)
- **Components Location**: `design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/`
- **Framework**: React (Vite sandbox for previewing — not Next.js)
- **CSS Approach**: Inline `style` objects with hardcoded hex values. No design token system exists. Do not enforce token usage — match hex values directly.
- **Breakpoints**: Desktop files (no prefix) target `min-width: 1024px` with sidebar layout. `Mobile*` files target `width: 390px` with bottom-nav layout. No responsive media queries inside individual mockup files.
- **Typography Scale**: Inter font family, system-ui fallback. Sizes range from 11px (labels) to 24px (section headers). Weight 400/600/700/800.
- **File → Shell Mapping**: `Directory.tsx` → `ctf/packages/web/components/directory/directory-shell.tsx`. `Mobile*.tsx` files are Android/React Native references, not web shell targets.

### State Completeness Requirements

Before implementing any mockup, verify the design includes explicit variants for all four states. If a variant is missing, **stop and ask the user** rather than inventing the design:

| State | What it represents | Annotation to look for |
|---|---|---|
| **Unauthenticated / Public** | Visitor with no Clerk session | `// STATE: Unauthenticated` or file suffix `Public` |
| **Authenticated + Loading** | Data fetch in progress | `// STATE: Loading` or file suffix `Loading` |
| **Authenticated + Empty** | Signed in, zero results from API | `// STATE: Empty` or file suffix `Empty` |
| **Authenticated + Populated** | Full happy path | Main export, no suffix |

If the design only shows authenticated + populated (current default), implement only that state's visuals and surface the missing states as a follow-up list to the user.

### Mock Data vs. API Data

All numbers and strings in Replit mockups are hardcoded. Look for `// API:` annotations to identify which values will come from real endpoints. Anything without this annotation should be treated as static presentational copy unless you can identify a matching API route in `ctf/packages/web/app/api/`.
---

## Design Agent Integration Guide

### **Three Primary Use Cases**

| Task | Command | What It Does |
|------|---------|--------------|
| **Pull Latest Designs** | `@design Pull the latest design changes from the Replit submodule` | Runs `git submodule update --init --recursive` on the design submodule, updates parent repo pointer, and confirms sync |
| **Implement Mockups** | `@design Implement the latest Replit mockups with pixel-perfect accuracy in [component/page name]` | Analyzes the Replit design files, extracts specs (colors, spacing, typography, layout), and generates implementation code |
| **Audit UI** | `@design Audit [component/page name] against the latest Replit designs and report any pixel-perfect deviations` | Compares current implementation against design specs, identifies misalignments, and provides specific fix instructions |

---

### Integrate with Your Workflow**

**Option A: Standalone Design Reviews**
```
@design Audit the navbar component against the latest Replit mockups
```

**Option B: Full Team Review (via Orchestrator)**
```
@meta-orchestrator Run full team review on this PR, including design audit
```
The orchestrator will automatically invoke the Design Agent as part of the comprehensive check.

---

## Design Agent Capabilities

### **Submodule Management**

- **Status Check**: Verifies submodule is in sync with remote
- **Commit Tracking**: Reports current design commit hash and branch

### **Design Analysis**
- Extracts specifications from mockups (spacing, colors, typography, layout)
- Identifies responsive behavior from designs
- Maps design tokens to implementation values
- Detects inconsistencies between designs and code

### **Implementation Guidance**
- Generates CSS/component code matching design specs
- Provides pixel-perfect spacing and sizing instructions
- Suggests component structure based on design hierarchy
- Creates implementation checklists for complex components

### **Quality Assurance**
- Compares rendered UI against design mockups
- Flags visual regressions and deviations
- Validates responsive behavior
- Checks accessibility (alt text, contrast, etc.)

---

## Example Workflows

### **Workflow 1: New Feature Implementation**
```
1. @design Pull the latest design changes from the Replit submodule
2. @design Implement the new dashboard layout with pixel-perfect accuracy
3. @design Audit the dashboard against the mockups to verify pixel-perfect match
4. @meta-orchestrator Run full team review on this feature branch
```

### **Workflow 2: Design Update Without Code Changes**
```
1. @design Pull the latest design changes
2. @design Report what changed in the designs since last sync
3. [You decide if implementation updates are needed]
4. @design Implement the color palette update across all components
```

### **Workflow 3: Audit Existing UI**
```
1. @design Audit the entire ctf/ UI against the latest Replit designs
2. [Review findings]
3. @design Generate a prioritized list of fixes needed for pixel-perfect compliance
```