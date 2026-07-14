# Accessible forms standard

One way to build every form in the app, so members always know what a field is for, what's required,
and what to fix — and so screen-reader and keyboard users have a first-class experience. New forms
follow this from the start; existing forms are converted in a tracked rollout.

## Required vs optional: mark optional

Owner decision (2026-06-12): **fields are required by default.** Only optional fields are marked, with
a muted **"(optional)"** after the label. Required fields carry no marker (no asterisk, no color-only
cue — those fail accessibility and add noise).

- ✅ `City (optional)`
- ❌ `City *`  /  a red label to mean "required"

## Field anatomy

Every field is built from the shared field component, never hand-rolled, so it always has:

1. **A visible label tied to the control** — `htmlFor`/`id` on web, the label text passed to the
   control on mobile. Tapping the label focuses the field.
2. **Helper text linked to the control** — short guidance under the label, associated via
   `aria-describedby`, so a screen reader reads it with the field.
3. **An error region that is announced** — when a field is invalid the control gets `aria-invalid`
   and the message sits in a `role="alert"` live region (web) / an accessible alert (mobile).
4. **A friendly, field-specific message** — never a raw server error. Tell the member exactly what to
   fix: "Add a short title for your request." not "Invalid payload."

### Components

- Web: `ctf/packages/web/components/shared/form-field.tsx` — `FormField` (render-prop: it owns the
  label/optional marker/hint/error chrome and hands `{ id, aria-describedby, aria-invalid }` to your
  input).
- Mobile: `ctf/packages/mobile/src/components/shared/FormField.tsx` — same contract for React Native
  (`accessibilityLabel`, `accessibilityHint`, and an announced error).

### Validation

- Validate on submit (and optionally on blur), client-side, before calling the server.
- One message per problem, in plain language, naming the field and the fix.
- Surface the message inline at the field when the problem is field-specific; a form-level summary is
  fine for cross-field problems.

## Accessibility baseline (applies app-wide, not just forms)

The product's conformance target is WCAG 2.2 Level AA, with selected AAA enhancements where feasible.
See `ACCESSIBILITY_STATEMENT.md` for the target, current status, and how it is maintained. The
checklist below is the working baseline that keeps each screen on track toward AA.

Checklist for every screen as it's touched:

- **Labels on every control**, including icon-only buttons (share, copy, nav rails, close, back) —
  `aria-label` (web) / `accessibilityLabel` (mobile).
- **Visible focus** — never remove the focus ring without replacing it; keyboard users must see where
  they are.
- **Logical focus/tab order**, and focus moved to errors/dialogs when they open.
- **Color contrast** — text and meaningful UI meet WCAG AA against the dark theme; never rely on color
  alone to carry meaning (pair it with text/shape/icon).
- **Hit targets** ≥ 44×44px for touch controls.
- **Alt text / labels** on meaningful images and icons; decorative ones are hidden from assistive tech.
- **Status announcements** — loading, success, and error states are announced (`role="status"` /
  `role="alert"`), not just shown.

## Rollout

The shared components + this standard land first; forms are then converted one plugin at a time, plus
the icon-button-label sweep, tracked in the accessibility rollout issue. Each rollout PR converts a
plugin's forms to `FormField`, applies the "(optional)" convention, replaces generic errors with
friendly ones, and runs the baseline checklist for that surface. Reference conversion: SocketRelay's
"Post a Request" form.
