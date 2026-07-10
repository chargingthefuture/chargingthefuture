"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

// Shared accessible form field for the web app. It owns the label, the optional marker, the helper
// text, and the error region, and hands the wiring back to the caller so any input (native or custom)
// gets a properly-associated label and description.
//
// Convention (app-wide standard, see ctf/docs/developer/ACCESSIBLE_FORMS_STANDARD.md): fields are
// REQUIRED by default — only optional fields are marked, with a muted "(optional)". Required fields
// carry no marker.
//
// Accessibility this guarantees for every field that uses it:
// - the visible text label is tied to the control via `htmlFor`/`id`;
// - helper text and the error message are linked through `aria-describedby`, so a screen reader reads
//   them with the field;
// - when there is an error the control gets `aria-invalid` and the error is in a `role="alert"` live
//   region, so it is announced;
// - the control receives a render-time `id`, so callers can't forget to associate the label.
//
// Usage:
//   <FormField label="Title" error={titleError}>
//     {(a) => <input {...a} value={title} onChange={...} />}
//   </FormField>

type FieldChildProps = {
  id: string;
  "aria-describedby"?: string;
  // Always present (true/false) rather than true/undefined: when an error clears, the control goes to
  // an explicit aria-invalid="false" instead of the attribute vanishing, which some assistive tech
  // reads more reliably. The HTML/React spec allows the full boolean here.
  "aria-invalid"?: boolean;
};

type FormFieldProps = {
  label: string;
  /** Mark the field as optional. Required fields (the default) carry no marker. */
  optional?: boolean;
  /** Helper/hint text shown under the label and linked via aria-describedby. */
  hint?: ReactNode;
  /** Inline error message. When present the control is marked invalid and the text is announced. */
  error?: string | null;
  children: (props: FieldChildProps) => ReactNode;
  className?: string;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
};

export function FormField({ label, optional, hint, error, children, className, style, labelStyle }: FormFieldProps) {
  const reactId = useId();
  const id = `ff-${reactId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className} style={style}>
      <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6, ...labelStyle }}>
        {label}
        {optional ? <span style={{ color: "#6B7280", fontWeight: 400 }}> (optional)</span> : null}
      </label>
      {hint ? (
        <div id={hintId} style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, lineHeight: 1.5 }}>
          {hint}
        </div>
      ) : null}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : false })}
      {error ? (
        <div id={errorId} role="alert" style={{ fontSize: 12, color: "#EF4444", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
