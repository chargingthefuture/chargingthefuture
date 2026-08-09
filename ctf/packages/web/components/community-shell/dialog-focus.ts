// Keyboard handling shared by the Commons shell's modal dialogs.
//
// A dialog that says `role="dialog" aria-modal="true"` is promising a keyboard member three things:
// focus starts inside it, Tab cannot wander out to the page behind the backdrop, and focus returns to
// whatever opened it when it closes. A mouse user never notices when those are missing; someone
// navigating by keyboard or screen reader loses their place entirely and can end up typing into a
// page they cannot see. This module holds that behavior once so each dialog does not re-derive it.

// Tab-focusable elements inside a dialog, used to cycle focus.
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Every focusable element currently inside `root`, in tab order. Hidden elements are dropped —
// `offsetParent` is null for anything `display: none` — but the currently focused element is kept
// even if it reports hidden, so focus is never lost mid-cycle.
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

// Focus trap for a single Tab / Shift+Tab press: keep focus cycling within the dialog root.
export function cycleFocusTrap(root: HTMLElement, event: KeyboardEvent) {
  const focusable = focusableWithin(root);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !root.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last || !root.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}
